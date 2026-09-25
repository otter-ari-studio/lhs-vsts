"""LHA Virtual Simulation — Hand Tracking WebSocket Sender

Python 3.9 + uv 工程：本机摄像头实时双手识别，经 WebSocket `ws://127.0.0.1:8765`
推送到 `web/` Three.js 客户端，驱动虚拟手骨架。

## 目录结构

```
.
├── config.py           # WS / FPS / MediaPipe / 捏合阈值 / 坐标标定 / 滤波
├── ws_sender.py        # WebSocket JSON 广播（无客户端不崩）
├── hand_processor.py   # 摄像头 + MediaPipe Hands + pinch/pos/rot
├── main.py             # 主循环、OpenCV 预览、键盘控制
├── web/                # Rsbuild + React + Three.js 接收端
├── requirements.txt
├── pyproject.toml
└── README.md
```

## 环境安装（uv + Python 3.9）

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh

cd lhs-vsts
uv python install 3.9
uv sync
```

或使用 pip：

```bash
python3.9 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Web 端：

```bash
cd web
pnpm install
```

## 启动步骤

1. 确认本机摄像头可用。
2. 启动动捕（会监听 WebSocket）：

```bash
uv run python main.py
# 或
source .venv/bin/activate && python main.py
```

3. 另开终端启动 web：

```bash
cd web && pnpm run dev
```

4. 浏览器打开 http://localhost:3000 ；OpenCV 窗口仍可预览骨架。
5. 键盘：`空格` 暂停/继续，`q` 退出。

## 通信协议（勿改结构）

```json
{
  "t": 123.456,
  "hands": [
    {
      "id": 0,
      "pinch": 1,
      "pos": [x, y, z],
      "rot": [x, y, z, w],
      "lms": [[x,y,z], ... 共21个 ...]
    }
  ]
}
```

- `id=0` 左手，`id=1` 右手
- `pinch`：拇指–食指指尖距离 < `PINCH_DISTANCE_THRESHOLD` 为 1
- `pos` / `rot` / `lms`：默认同一动捕原始系；协议要求 **`pos == lms[0]`**
- Web `RelativeHandDriver`：首帧以腕部为原点，之后 `世界位 = 默认休息位 + (当前 − 原点)`
- `SEND_LANDMARKS=False` 可关闭骨架；`LMS_RAW_CAPTURE_SPACE=False` 时 Python 对三者统一走 `POS_*`（此时 web 轴映射应恒等）

MediaPipe 索引：`0` 腕，`1–4` 拇指，`5–8` 食指，`9–12` 中指，`13–16` 无名指，`17–20` 小指。

## 摄像头标定说明

端坐 + 显示器顶摄 + web 相对驱动（默认）：

1. 双手自然放在镜头前，先开本程序，再开浏览器（或依赖自动重连）。
2. 虚拟手应出现在油烟机正前方；移动手应同向跟随。若首帧姿势别扭，点页面 **Recalibrate**。
3. 轴反了：改 web `axisMap` 配置（不要再用 Python `POS_*` 与 web 双重翻轴）。

| 参数 | 作用 |
|------|------|
| `POS_SCALE` | 归一化坐标放大到米级尺度（仅 `LMS_RAW_CAPTURE_SPACE=False`） |
| `POS_AXIS_REMAP` | 轴置换/取反 |
| `POS_OFFSET` | 平移 |
| `PINCH_DISTANCE_THRESHOLD` | 捏合灵敏度 |
| `LPF_*_ALPHA` | 越大越跟手、越小越稳 |
| `FLIP_HORIZONTAL` | 自拍镜像 |
| `TARGET_FPS` | 限制 WS 发包频率 |
| `WS_HOST` / `WS_PORT` | WebSocket 监听地址 |

## 异常策略

摄像头打不开、读帧失败、未检测到手、无 WS 客户端时，仅打印警告，主循环持续运行。
