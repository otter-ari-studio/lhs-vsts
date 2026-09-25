# PRD: MachineDef 与 Kitbash 油烟机场景

## Goal

落地 MachineDef 契约与中保真 Kitbash 油烟机可视（可辨识零件 + 锚点），逻辑与渲染解耦。

## Parent

`09-25-appliance-sim-redesign` D-asset / D-scope-mvp。可与 hand-tracking 并行（不依赖双手，但训练页需能挂载场景）。

## Requirements

- **R1** 新 MachineDef JSON（无 Unity prefabPath）；含 parts 锚点与 cleanSpots 字段骨架。
- **R2** Kitbash 适配器按 partId 渲染可辨识机身/零件。
- **R3** 训练场景灯光/地面/合理默认相机；Orbit 限制。
- **R4** lint/test/build 绿。

## Acceptance Criteria

- [x] AC1：训练页可见可辨识油烟机与零件（非旧大方块玩具感）。
- [x] AC2：partId 与锚点表一致，可供后续交互挂载。
- [x] AC3：lint/test/build 通过。

## Out of Scope

抓取/SOP/清洁交互逻辑（interaction-sop-clean）。
