# PRD: MVP B — 拆装零件交互（抓取 / 顺序锁）

## Goal

在 MVP A 手部可视化之上，用机型 JSON 驱动程序化零件代理，支持捏合抓取、顺序锁提示与回装吸附；卡扣可开合，螺母本阶段仅提示（旋转拧卸后置）。

## Requirements

- **R1** 加载 `public/machines/range_hood_generic.json`，渲染非 `fixed_shell` 零件代理。
- **R2** 捏合 + 距离内：`grabbable` 可抓取跟手；已安装时校验 `removePrereqs`，失败提示并扣分。
- **R3** 松手：在 `snapRange` 内且 `installPrereqs` 满足则回装并记步骤；否则保持拆卸位。
- **R4** `clip`：捏合切换 open/close（校验 prereqs / pry 提示）。
- **R5** `rotate_nut`：捏合仅提示「请旋转拆卸」（本 MVP 不做旋转手势）。
- **R6** 顶栏/浮层显示 tip；显示当前分数。

## Out of Scope

- 真实物理刚体、正式 GLTF、螺母旋转手势、考核报表 UI
