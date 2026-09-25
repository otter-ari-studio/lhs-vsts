# PRD: 浏览器双手追踪与标定

## Goal

在训练页接入浏览器内 MediaPipe HandLandmarker：摄像头 → 双手骨架跟随，含顶摄端坐标定/重标定与 pinch 状态（交互消费后置）。

## Parent

`09-25-appliance-sim-redesign` D-arch / D-device；依赖已完成的 `09-25-greenfield-scaffold`。

## Requirements

- **R1** `getUserMedia` + 权限拒绝/重试 UI。
- **R2** HandLandmarker VIDEO 模式，双手；结果进 `HandHub`。
- **R3** AxisMap + RelativeDrive + 默认休息位；Recalibrate。
- **R4** Pinch 滞回；丢检短 hold；骨架可见。
- **R5** 顶摄端坐引导文案；WASM 资源 pin 版本（勿 `@latest`）。
- **R6** lint/test/build 绿；可在无摄像头 CI 下对纯函数单测。

## Acceptance Criteria

- [ ] AC1：授权摄像头后训练页双手跟随（笔记本顶摄场景）。
- [ ] AC2：重标定有效；丢检有提示/hold。
- [ ] AC3：无 Python/WS；pin 的 WASM 加载路径。
- [ ] AC4：lint/test/build 通过。

## Out of Scope

零件抓取、MachineDef、Kitbash 机型（后续子任务）。
