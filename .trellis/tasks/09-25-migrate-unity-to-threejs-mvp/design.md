# Design: Python WS → Three.js 手部可视化（MVP A）

## Architecture

```
[Camera] → MediaPipe (Python)
              ↓  HandProcessor (unchanged payload shape)
         WebSocketServer (localhost, replace UDP)
              ↓  UTF-8 JSON frames ≤30fps
         Browser (lhs-vsts/web)
              ↓  HandDataHub (latest per handId)
         AxisMapper → RelativeHandDriver → LandmarkRig
              ↓
         Three.js scene (shell + floor/wall + hands)
```

## Boundaries

| Layer | Owns | Does not own |
|-------|------|--------------|
| Python `lhs-vsts` | Capture, MediaPipe, LPF, pinch, WS broadcast, OpenCV preview | Scene, axis map, relative drive |
| `web` | WS client, axis map, relative drive, skeleton, placeholder scene | Camera / MediaPipe |
| Unity repo | Reference only | Runtime path |

## Data contract (unchanged shape)

```json
{
  "t": 123.456,
  "hands": [
    {
      "id": 0,
      "pinch": 1,
      "pos": [x, y, z],
      "rot": [x, y, z, w],
      "lms": [[x,y,z], ... 21 ...]
    }
  ]
}
```

- Nested `lms` kept as `[[x,y,z]×21]`（web 原生 JSON，无需 Unity 式压平）。
- 空 `hands`：不更新该帧双手；驱动器按时间戳停滞隐藏骨架。

## Transport

- Python：`websockets`（或标准库可行方案）在 `WS_HOST`/`WS_PORT`（建议 `127.0.0.1:8765`）上 listen；每帧 `broadcast` 给所有已连接客户端。
- 无订阅者：`send` 跳过或 no-op，主循环不抛。
- Browser：`WebSocket` + 指数退避重连；开发期页面 `http://localhost:3000` 连 `ws://127.0.0.1:8765`（非加密本机回环）。

## Web rendering stack

- `three` + `@react-three/fiber` + `@react-three/drei`（与现有 React 19 / Rsbuild 对齐）。
- 模块建议：
  - `hand/protocol.ts` — 类型与校验
  - `hand/axisMap.ts` — MediaPipe→Three 轴映射（默认 invert Y/Z）
  - `hand/HandDataHub.ts` — 最新样本
  - `hand/RelativeHandDriver.ts` — 校准 + 相对位姿 + 掌根/骨架平滑
  - `hand/LandmarkRig.tsx` — 21 球 + HAND_CONNECTIONS
  - `scene/RangeHoodShell.tsx` — 程序化简化机壳
  - `net/handSocket.ts` — WS 连接/重连
  - UI：连接状态、手数量、Recalibrate 按钮

## Coordinate & drive (port of Unity behavior)

1. 解析后对 `pos`/`rot`/`lms` 应用 `mapMatrix`（与 `UdpHandDataReceiver` 默认一致）。
2. 每手首帧：`originPos = wrist`，`originRot = rot`。
3. 掌根目标：`defaultPos + (wrist - originPos)`；旋转：`defRot * inv(originRot) * rawRot`。
4. Landmark：`defaultPos + (lms[i] - originWrist)`。
5. 默认位姿：左 `(-0.18,-0.05,0.80)`，右 `(0.18,-0.05,0.80)`，Euler Y=180°。
6. 平滑：掌根按渲染 `delta` 指数趋近；骨架按采样间隔趋近（对齐 Unity 修复）。

## Python file changes

- Add `ws_sender.py`（或等价）；`main.py` 改用 WS。
- `config.py`：`UDP_*` → `WS_HOST`/`WS_PORT`；移除 UDP 专用项。
- Remove or stop shipping `udp_sender.py`。
- `requirements.txt` / `pyproject.toml`：加 `websockets`；描述改为 Web 联调。
- `README.md`：启动顺序 = Python 先起 WS → `web` dev → 浏览器打开。

## Compatibility / migration

- Unity 工程不改、不删；文档声明 runtime 路径已切到 web。
- 协议字段名保持，便于日后移植交互时复用 hub 语义。

## Trade-offs

- 本机 WS vs 浏览器内 MediaPipe：保留 Python 与现有滤波/标定，符合 D2/D3。
- R3F vs 裸 three：R3F 利于 React 状态（连接 UI）与组件化场景。
- 硬切 UDP：无双发分叉；回滚靠 git。

## Ops / rollback

- 回滚：恢复 `udp_sender` + Unity 监听；web 可留作实验。
- 风险点：WS 依赖未装、端口占用、轴映射与休息位手感；用 OpenCV 对照排查。
