# LHS-VSTS Web

纯浏览器大家电拆洗训练客户端：Rsbuild + React 19 + Three.js / R3F。当前为 **3D 鼠标演示**（拖动旋转视角，点击 / 拖拽零件完成 SOP）。

机型规则在 workspace 包 `@lhs-vsts/machine`；机型 JSON 与成绩由 `apps/backend` 提供。

## Setup

从仓库根目录：

```bash
vp install
vp run --filter @lhs-vsts/machine build
```

## Dev

先启动后端（3001），再启动本应用（3000）：

```bash
vp run dev:backend
vp run dev:web
```

打开 http://localhost:3000 。`/api` 在开发与 preview 下代理到 `http://localhost:3001`。

流程：引导页 → 3D 训练（拆 → 清洁 → 回装）→ 结束页。管理页：`#admin`。

## Scripts

| Command | Purpose |
|---------|---------|
| `vp run web#dev` | 本地开发服务器 |
| `vp run web#build` | 生产构建 |
| `vp run web#preview` | 预览构建产物 |
| `vp run web#lint` | Rslint |
| `vp run web#test` | Rstest 单测 |

## Module layout

| Folder | Responsibility |
|--------|----------------|
| `src/api/` | 同源 `/api` 客户端与 `loadMachineDef` |
| `src/hand/` | 遗留摄像头 / MediaPipe 代码（训练页已不再启用） |
| `src/interaction/` | 鼠标点击拖拽、grab / clip / nut、物品栏 |
| `src/visual/` | Kitbash 适配器；未来可换 GLTF，不改 StepGraph |
| `src/ui/` | 引导、训练、管理、结束页 |
| `src/scene/` | R3F 训练场景 |

领域规则（MachineDef、StepGraph、ScoreBook、TrainingSession）在 `@lhs-vsts/machine`。

### Visual adapter boundary

换零件网格（`visual.adapter: kitbash` → `gltf`）只需改 MachineDef 的 `visual` 字段与适配器实现；`TrainingSession` / `StepGraph` 只认 `partId`、锚点与步骤 prereqs。
