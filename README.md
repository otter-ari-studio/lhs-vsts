# LHS-VSTS — 纯 Web 大家电拆洗训练

浏览器内手部追踪 + Three.js 训练场景。**无需 Python / WebSocket。**

旧本机摄像头 + WS 动捕栈已归档到 [`legacy/python-hand-ws/`](legacy/python-hand-ws/)（非产品路径）。

## 快速开始

```bash
cd web
pnpm install
pnpm run dev
```

打开 http://localhost:3000 （摄像头需要 HTTPS 或 localhost）。

## 流程

1. **引导页**：说明摄像头权限与顶摄端坐姿势 → 进入训练
2. **训练页**：场景占位（后续接入 HandLandmarker / 机型 / 拆装 SOP）

## 验证

```bash
cd web
pnpm run lint
pnpm run test
pnpm run build
```

## 目录

| 路径 | 说明 |
|------|------|
| `web/` | 唯一产品入口（Rsbuild + React 19 + R3F） |
| `legacy/python-hand-ws/` | 已退役的 Python WS 动捕（参考用） |
| `legacy/web-mvp/` | 重写前 Web MVP 快照（参考用） |
