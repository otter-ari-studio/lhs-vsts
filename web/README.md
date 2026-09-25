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

## 拆装交互（MVP B）

- 机型配置：`public/machines/range_hood_generic.json`
- 捏合靠近零件可抓取（集油盒等）；顺序错误会提示并扣分
- 卡扣捏合开合；螺母暂仅提示（旋转手势后置）
- 顶栏显示分数与 tip
