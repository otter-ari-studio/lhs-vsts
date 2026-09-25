# PRD: Greenfield 脚手架与旧栈归档

## Goal

建立纯 Web 新产品骨架，切断对 Python/WS 动捕的运行时依赖，并将旧动捕栈移出主路径。

## Parent

继承 `.trellis/tasks/09-25-appliance-sim-redesign` 的 D-arch / D-rewrite；详见父 `design.md` P1。

## Requirements

- **R1** `web/` 为唯一产品入口：引导页（权限说明）→ 训练页占位可路由切换。
- **R2** 删除运行时 WS 手部连接；无 `handSocket` 联调路径。
- **R3** 根目录 Python 动捕移入 `legacy/python-hand-ws/`（或等价），主 README 标明非产品。
- **R4** 加入 `@mediapipe/tasks-vision` 依赖与 WASM 加载占位（完整追踪在下一子任务）。
- **R5** `pnpm run lint` / `test` / `build` 通过。

## Acceptance Criteria

- [x] AC1：`pnpm run dev` 可开引导/训练占位页，无 WS 连接尝试。
- [x] AC2：根目录无产品必需的 Python 运行步骤；旧代码在 `legacy/`。
- [x] AC3：lint/test/build 绿。

## Out of Scope

完整 HandLandmarker 驱动、Kitbash 机型、拆装交互（后续子任务）。
