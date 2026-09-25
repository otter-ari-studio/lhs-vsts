# Implement: 推倒重做 — 分阶段执行规划

> 本文件是执行清单与子任务地图。**在用户批准 PRD/Design 之前不要 `task.py start` 写业务代码。**

## 子任务地图（建议 parent = 本任务）

创建 children 时用：

```bash
python3 ./.trellis/scripts/task.py create "<title>" --slug <slug> --parent 09-25-appliance-sim-redesign
```

| 顺序 | Slug（建议） | 标题 | 可独立验收 |
|------|--------------|------|------------|
| 1 | `greenfield-scaffold` | Greenfield 脚手架 + 旧栈退役/归档 | 纯 Web 可启动；无 WS 依赖；README 草案 |
| 2 | `browser-hand-tracking` | 浏览器 HandLandmarker + 标定 + 虚拟手 | 顶摄端坐双手跟随/重标定 |
| 3 | `kitbash-machine-def` | MachineDef 契约 + Kitbash 油烟机场景 | 可辨识机身/零件；锚点正确 |
| 4 | `interaction-sop-clean` | 拆装交互 + 步骤图 + 清洁 dwell/UI + 结束页 | AC2–AC4 可训闭环 |
| 5 | `harden-docs-retire` | 测试加固、legacy 删除、README 定稿 | AC5–AC6 |

依赖关系（写在各 child PRD，非系统强制）：1 → 2 与 3 可并行 → 4 依赖 2+3 → 5 收尾。

## Phase 清单（若暂不拆 child，按此顺序 inline）

### P0 — 批准后门禁

- [ ] 用户批准本 `prd.md` / `design.md` / `implement.md`
- [ ] （可选）创建上表 child；从 child-1 `task.py start`
- [ ] 实现前跑 `trellis-before-dev` 读相关 spec

### P1 — Scaffold & retire path

- [ ] 重建 `web/src` 应用骨架（路由/布局：引导 → 训练）
- [ ] 移除运行时对 `net/handSocket`、Python WS 的引用
- [ ] 根目录 Python 移入 `legacy/python-hand-ws/`（或等价）并在 README 标明「非产品」
- [ ] 接入（或确认）`@mediapipe/tasks-vision` 依赖与 WASM 加载策略

**验证**

```bash
cd web && pnpm install && pnpm run dev
# 页面可开，无 WS 连接逻辑
pnpm run lint && pnpm run test
```

### P2 — Hand tracking

- [ ] `getUserMedia` + 权限/拒绝 UI
- [ ] HandLandmarker 双掌 → HandHub
- [ ] AxisMap + RelativeDrive + 休息位；Recalibrate
- [ ] Pinch 滞回；丢检 hold；骨架渲染
- [ ] 顶摄端坐引导文案

**验证**：笔记本顶摄下双手同向跟随；重标定有效。

### P3 — Machine + Kitbash

- [ ] 新 `MachineDef`（无 Unity prefabPath）；迁移旧零件图并加 `cleanSpots`
- [ ] Kitbash 适配器按 `partId` 挂锚点
- [ ] 场景灯光/地面；Orbit 限制保持可训视角

**验证**：零件外形可辨；ID 与锚点表一致。

### P4 — Interaction + SOP + Clean + End

- [ ] StepGraph / ScoreBook / faultLog（通关=必选步完成）
- [ ] Hover 高亮 + Grab/Snap + Clip + Nut-dwell
- [ ] Clean dwell +「标记已清洁」按钮
- [ ] 步骤条、tip、结束页（合格/得分/错因/再训）

**验证**：完整跑通拆→清洁→回装；乱序扣分仍可合格；UI 可完成清洁。

### P5 — Harden & delete legacy

- [ ] 纯函数单测：prereqs、合格判定、dwell
- [ ] 删除 `legacy/`；根 README 仅纯 Web
- [ ] 确认无 Python 运行说明残留于主路径

## 验证命令（总）

```bash
cd web
pnpm install
pnpm run lint
pnpm run test
pnpm run build
pnpm run dev
# 人工：摄像头授权 → 标定 → 全流程 SOP → 结束页
```

## 风险文件 / 回滚点

| 点 | 风险 | 回滚 |
|----|------|------|
| 清空 `web/src` | 丢失可参考交互 | git；或先搬 `legacy/web-mvp` |
| MediaPipe WASM | 加载失败/CORS | CDN↔本地切换；spike 换手检测库 |
| MachineDef 迁移 | 步骤 ID 与旧 tip 不一致 | 对照旧 `range_hood_generic.json` 做表 |

## Spike（P1 内可选，1 天内）

- 浏览器 HandLandmarker 在目标笔记本上的稳定性与包体；结论写入 `.trellis/tasks/.../research/`（若建 research）。

## JSONL（子代理）

若使用 `trellis-implement` / `trellis-check`：在 `task.py start` 前把 `implement.jsonl` / `check.jsonl` 的 `_example` 换成真实 spec/research 条目（如 `.trellis/spec/guides/cross-layer-thinking-guide.md`、本任务 `design.md` 可通过 research 摘录，**不要**把业务代码路径当 spec）。

## Before `task.py start`

- [x] 产品 D-* 已锁定并写入 PRD
- [x] design / implement 已写
- [ ] **用户明确批准「可以按该方案开写」**
- [ ] 再 start（建议 start 第一个 child，而非空转 parent）
