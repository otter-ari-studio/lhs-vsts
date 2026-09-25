# LHS-VSTS Web

纯浏览器大家电拆洗训练客户端：Rsbuild + React 19 + Three.js / R3F。

手部追踪使用 `@mediapipe/tasks-vision` HandLandmarker（浏览器内 WASM），**不连接**本机 Python WebSocket。

## Setup

```bash
pnpm install
```

## Dev

```bash
pnpm run dev
```

打开 http://localhost:3000 。引导页说明摄像头权限后进入训练占位场景。

摄像头需要安全上下文（`localhost` 或 HTTPS）。

## Scripts

- `pnpm run build` — production build
- `pnpm run preview` — preview build
- `pnpm run lint` / `pnpm run test` — lint & tests

## Module layout

| Folder | Responsibility |
|--------|----------------|
| `src/hand/` | MediaPipe loader / tracking (stub → full in next task) |
| `src/machine/` | MachineDef / StepGraph / ScoreBook |
| `src/interaction/` | Hover / grab / clip / nut / clean |
| `src/visual/` | Kitbash / GLTF adapters |
| `src/ui/` | Guide, chrome, tips, end screen |
| `src/scene/` | R3F canvas / training viewport |
