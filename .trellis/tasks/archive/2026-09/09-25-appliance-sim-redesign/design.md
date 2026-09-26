# Design: 纯 Web 大家电拆洗训练平台（推倒重做）

## 1. 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (single app)                                        │
│                                                              │
│  Camera ──► HandTracker (MediaPipe HandLandmarker)           │
│                │                                             │
│                ▼                                             │
│           HandHub (latest L/R, pinch, landmarks, ts)         │
│                │                                             │
│       AxisMap + RelativeDrive + Calibrate UX                 │
│                │                                             │
│                ▼                                             │
│  ┌─────────────┴──────────────┐                              │
│  │ TrainingSession            │◄── MachineDef (JSON)         │
│  │  StepGraph / ScoreBook     │◄── Curriculum (必选步骤表)   │
│  └─────────────┬──────────────┘                              │
│                ▼                                             │
│  InteractionRuntime (hover / grab / clip / nut-dwell / clean)│
│                │                                             │
│                ▼                                             │
│  SceneView (R3F) ◄── PartVisualAdapter (Kitbash | future GLTF)│
│  TrainingChrome (步骤条 / tip / 分数 / 结束页 / 标定)         │
└─────────────────────────────────────────────────────────────┘

部署：静态托管（任意 HTTPS 源，摄像头需安全上下文）
```

**硬边界**

| 模块           | 负责                                                 | 不负责         |
| -------------- | ---------------------------------------------------- | -------------- |
| `hand/`        | 摄像头、MediaPipe、滤波、pinch、标定、虚拟手渲染输入 | 零件逻辑、评分 |
| `machine/`     | MachineDef 解析、步骤图、状态、得分、错因            | 网格形状       |
| `interaction/` | 命中、抓取、卡扣、螺母停留、清洁停留/UI 事件         | 课件文案布局   |
| `visual/`      | Kitbash/GLTF 适配器、锚点挂载                        | 改写步骤图     |
| `ui/`          | 步骤条、tip、结束页、权限/标定引导                   | 3D 命中算法    |
| 旧 Python / WS | **无**                                               | 全部退役       |

## 2. 动捕方案（D-arch / D-device）

### 选型

- **MediaPipe Tasks Vision — `HandLandmarker`**（WASM，浏览器内），双手数、VIDEO 模式。
- 输入：`getUserMedia`，偏好 `facingMode: 'user'`；UI 预览可镜像，**世界坐标约定与预览一致并文档化**。
- Pinch：拇指尖–食指尖距离阈值（可配置）；边沿触发 grab start/end，带短滞回防抖。
- 丢失：`HAND_HOLD_MS` 内保持最后一帧；超时隐藏骨架并提示「双手入画」。
- 驱动：保留「相对腕位 + 默认休息位」思想（适配顶摄端坐）；提供 Recalibrate。
- **不做**：Python 进程、WebSocket 手部桥、首期 WebXR。

### 坐标与标定（笔记本顶摄）

1. 开机引导：坐正、双手举到胸前入画、手心朝向屏幕大致方向 →「开始标定」。
2. 首帧/显式标定：记录左右腕原点；世界位 = 休息位 + (当前 − 原点)。
3. 轴映射：单一处配置（避免双处翻轴）；默认按自拍镜像与 Y-up Three 场景调试表验收。
4. 交互用**掌根/捏合中点**（非仅腕）做距离判定，半径按零件 collider 分级。

## 3. 机型与课程契约

### MachineDef（替换旧 JSON + PART_LAYOUT 分裂）

```ts
// 概念契约（实现时可拆文件）
type MachineDef = {
  machineId: string;
  displayName: string;
  scoring: { baseScore: number; deductIllegalOrder: number; deductClipPry: number /* … */ };
  assemblyDefaults: { snapRangeMeters: number /* … */ };
  parts: PartDef[];
  cleanSpots: CleanSpotDef[]; // 新增
};

type PartDef = {
  partId: string;
  displayName: string;
  kind: "fixed_shell" | "grabbable" | "clip" | "rotate_nut";
  anchor: { position: Vec3; rotation?: Vec3 }; // 逻辑锚点，单位米
  visual: { adapter: "kitbash" | "gltf"; kitbashKey?: string; gltfUrl?: string; nodeName?: string };
  removePrereqs: string[]; // step ids
  installPrereqs: string[];
  tips: { removeLocked?: string; installLocked?: string; pry?: string; wrongDirection?: string };
  snapRangeMeters?: number;
  thread?: "normal" | "reverse"; // nut
};

type CleanSpotDef = {
  cleanId: string;
  displayName: string;
  partId: string; // 所属零件；通常要求该 part 已 removed
  position: Vec3; // 世界或 part-local（需在 def 标明 space）
  radiusMeters: number;
  dwellMs: number; // 默认 1500
  stepId: string; // e.g. clean_oil_box
};
```

- **删除**运行时对 Unity `prefabPath` 的依赖。
- 步骤 ID 约定：`remove_*` / `install_*` / `open_*` / `close_*` / `clean_*`。
- 首期 SOP：以现有 `range_hood_generic` 拆装图为基，在「零件拆下后、回装前」插入对应 `clean_*` 必选步（至少：滤网、集油盒、风轮等相关清洁点；具体列表在实现子任务写进 MachineDef）。

### Curriculum / 合格（D-pedagogy）

- `requiredSteps: string[]`：全集完成 → `passed = true`。
- `ScoreBook`：扣分与 `faultLog[]`；**不影响** `passed`。
- 结束页绑定：`passed`、`score`、`faultLog`、`completedSteps`。

## 4. 交互运行时

### 命中与反馈

- 每手维护：hover 最近可交互体（距离 ≤ collider）、engaged 目标。
- 视觉：hover 描边/高亮；当前 SOP 目标额外脉冲；非法尝试 tip。
- Grab：pinch↓ 在半径内且 `tryBeginRemove` 通过 → 跟手；pinch↑ → snap 判定 `tryInstall`。
- Clip：pinch 边沿 toggle（保留 pry 扣分）。
- Nut（首期简化）：在半径内 pinch 停留 `N_ms` → remove/install；反牙仅 tip + 可选「方向练习」后置。
- Clean（D-clean-ux）：热点在满足 prereq 时激活；手进入半径累计 dwell；或 UI「标记已清洁」直接 `complete(clean_*)`。

### 与旧代码关系

| 旧模块                           | 新去向                                     |
| -------------------------------- | ------------------------------------------ |
| `LockManager` 顺序/扣分思想      | 保留并扩展 `clean_*`、faultLog；API 可重写 |
| `GrabPart` 腕距 8cm              | 重写为 collider + hover 引导               |
| `RelativeHandDriver`             | 思想保留；输入改为 HandHub（无 WS）        |
| `handSocket` / Python            | 删除                                       |
| `RangeHoodShell` + `PART_LAYOUT` | 由 Kitbash 适配器 + MachineDef.anchor 取代 |

## 5. 视觉（D-asset）

- **Kitbash 适配器**：按 `kitbashKey` 组合中保真几何（拉伸体、圆角、简单滤网栅格、半透明面板），比例接近真机，材质分金属/塑料/玻璃三档即可。
- 每个 `partId` 绑定锚点 Group；抓取时移动该 Group。
- **未来 GLTF 适配器**：同 `partId`/`anchor`，只换 visual 层；禁止把逻辑写进网格组件。

## 6. 应用骨架与部署

- 目录建议（实施时可微调）：
  - 仓库根改为以 `web/`（或重命名 `app/`）为唯一产品；Python 文件移 `legacy/python-hand-ws/` 后删除。
  - 路由：`/` 引导+权限 → `/train/:machineId` 训练 → 结束态可用同页 modal。
- 静态部署：Rsbuild `build` 产物；**必须 HTTPS**（或 localhost）才能开摄像头。
- 配置：`VITE_`/`PUBLIC_` 式环境变量仅用于默认约束（dwell、pinch），无后端亦可。

## 7. 技术栈推荐

| 层   | 选择                                       | 理由                   |
| ---- | ------------------------------------------ | ---------------------- |
| 构建 | 继续 Rsbuild + React 19 + TS               | 已有工程与 AGENTS 约定 |
| 3D   | three + R3F + drei                         | 已有依赖               |
| 动捕 | `@mediapipe/tasks-vision` HandLandmarker   | 官方浏览器路径，双掌   |
| 测试 | rstest：StepGraph/ScoreBook/命中纯函数优先 | 交互可测核             |

备选：若 Tasks 包体积/兼容成问题，可评估 `@tensorflow-models/hand-pose-detection`；需在实现子任务做一次 spike 后写回 research。

## 8. 旧代码退役图

```
Phase 0（实现启动时）:
  legacy/  ← 移入根目录 Python + 旧 net/handSocket（可选）
  新建 app 入口与模块骨架（可在清空后的 web/src 上重建）

Phase N（首期 AC5 前）:
  删除 legacy/ 与 README 中的 uv/python 联调
  根 README 改为纯 Web
```

不保留「WS 与浏览器动捕双模开关」。

## 9. 关键权衡

| 决策            | 取          | 舍                                 |
| --------------- | ----------- | ---------------------------------- |
| 纯浏览器动捕    | 真·在线单页 | 本机 Python 滤波成熟度；需重做标定 |
| Kitbash 先行    | 不堵开发    | 观感非量产；换模要严守契约         |
| 通关即合格      | 降挫败      | 考核严谨性后置                     |
| 清洁 dwell + UI | 不卡关      | 非真实擦拭                         |
| 螺母 dwell 简化 | 可训闭环    | 反牙手感弱                         |

## 10. 风险与缓解

| 风险                | 缓解                                      |
| ------------------- | ----------------------------------------- |
| 顶摄 MediaPipe 不稳 | 强引导、hold、UI 清洁兜底、pinch 滞回     |
| Kitbash 仍被嫌丑    | 提高轮廓辨识度 + 零件色标；并行正式资产线 |
| 包体过大            | MediaPipe WASM CDN/本地缓存；按需加载     |
| 标定失败            | 强制引导流，未标定不可抓取                |

## 11. 回滚

- Git 回退至重写前 tag/commit；`legacy/` 可临时恢复 Python 演示（非产品路径）。
- 无数据迁移（无用户库）。
