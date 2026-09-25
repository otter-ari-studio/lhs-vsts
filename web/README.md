# LHA VSTS Web (Three.js)

Rsbuild + React + Three.js 接收端：连接本机 Python WebSocket（默认 `ws://127.0.0.1:8765`），
相对腕位驱动双手骨架，并显示简化油烟机场景。

## Setup

```bash
pnpm install
```

## Dev

1. 先在仓库根目录启动 Python：`uv run python main.py`（会监听 WS）
2. 再启动本应用：

```bash
pnpm run dev
```

打开 http://localhost:3000 。顶栏显示连接状态；**Recalibrate** 可重新归零相对原点。

## Scripts

- `pnpm run build` — production build
- `pnpm run preview` — preview build
- `pnpm run lint` / `pnpm run test` — lint & tests

可选：改 `src/hand/defaults.ts` 中的 `WS_URL` 覆盖默认 WebSocket 地址。
