# PRD: 测试加固与 legacy 删除

## Goal

收尾首期可训闭环：补强测试与文档，删除 `legacy/`，根 README 仅保留纯 Web 产品路径，满足父任务 AC5–AC6。

## Parent

`09-25-appliance-sim-redesign` 产品验收 AC5–AC6。

## Depends on

`09-25-interaction-sop-clean`（即将完成）。

## Requirements

- **R1** 删除 `legacy/`（python-hand-ws + web-mvp）；仓库无产品依赖指向 legacy。
- **R2** 根 `README.md` / `web/README.md` 仅描述纯 Web：安装、dev、摄像头、标定、SOP 训练；不出现 Python WS 联调为主路径。
- **R3** 关键路径单测覆盖：StepGraph 合格、非法顺序扣分不挡合格、clean dwell/UI 完成语义（若已有则补缺口）。
- **R4** `pnpm run lint` / `test` / `build` 绿。
- **R5** 确认换 visual 适配器（kitbash→gltf 接口）不改 StepGraph 逻辑（文档或测试断言边界）。

## Acceptance Criteria

- [x] AC1：无 `legacy/` 目录；无主路径引用。
- [x] AC2：README 纯 Web。
- [x] AC3：lint/test/build 绿。
- [x] AC4：父任务产品 AC5–AC6 可勾选。

## Out of Scope

新功能、正式 GLTF 资产制作、账号/LMS。
