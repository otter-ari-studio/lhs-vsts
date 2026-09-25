# LHA Virtual Simulation — Hand Tracking UDP Sender

Python 3.9 + uv 工程：本机摄像头实时双手识别，按 Unity `UdpHandDataReceiver` 报文经 UDP `127.0.0.1:9999` 驱动虚拟手。

## 目录结构

```
.
├── config.py           # UDP / FPS / MediaPipe / 捏合阈值 / 坐标标定 / 滤波
├── udp_sender.py       # UDP JSON 发送（失败只警告）
├── hand_processor.py   # 摄像头 + MediaPipe Hands + pinch/pos/rot + 可替换手腕接口
├── main.py             # 主循环、预览、键盘控制
├── requirements.txt
├── pyproject.toml
└── README.md
```

## 环境安装（uv + Python 3.9）

```bash
# 已安装 uv 则可跳过
curl -LsSf https://astral.sh/uv/install.sh | sh

cd lha-virtual-simulation-training-system-python
uv python install 3.9
uv sync
```

或使用 pip：

```bash
python3.9 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 启动步骤

1. 确认本机摄像头可用；Unity 样机已启动并监听 `127.0.0.1:9999`。
2. 运行：

```bash
uv run python main.py
# 或
source .venv/bin/activate && python main.py
```

3. OpenCV 窗口预览骨架；控制台打印手数量 / pinch / 手腕坐标。
4. 键盘：`空格` 暂停/继续，`q` 退出。

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
    },
    {
      "id": 1,
      "pinch": 0,
      "pos": [x, y, z],
      "rot": [x, y, z, w],
      "lms": [[x,y,z], ... 共21个 ...]
    }
  ]
}
```

- `id=0` 左手，`id=1` 右手  
- `pinch`：拇指–食指指尖距离 < `PINCH_DISTANCE_THRESHOLD` 为 1  
- `pos` / `rot` / `lms`：**默认同一动捕原始系**；协议要求 **`pos == lms[0]`**  
- Unity `VirtualHandDriver`：首帧以腕部为原点，之后 `世界位 = 默认休息位 + (当前 − 原点)`，因此端坐顶摄时双手默认停在油烟机前，只跟相对移动  
- `SEND_LANDMARKS=False` 可关闭骨架；`LMS_RAW_CAPTURE_SPACE=False` 时 Python 对三者统一走 `POS_*`（此时 Unity 轴映射应恒等）

MediaPipe 索引：`0` 腕，`1–4` 拇指，`5–8` 食指，`9–12` 中指，`13–16` 无名指，`17–20` 小指。

与 Unity 交付对接：`HandDataHub` / `UdpHandDataReceiver` / `VirtualHandDriver` / `HandLandmarkRig`；`JsonUtility` 侧会把嵌套 `lms` 压平为 63 元一维数组解析。详见 [`docs/unity-hand-udp-alignment.md`](docs/unity-hand-udp-alignment.md)。

## 摄像头标定说明

端坐 + 显示器顶摄 + Unity 相对驱动（默认）：

1. 双手自然放在镜头前，点 Unity Play，再开本程序。  
2. 虚拟手应出现在油烟机正前方；移动手应同向跟随。若首帧姿势别扭，在 Unity 调 `VirtualHandDriver.Recalibrate()` 或左右 `defaultPosition`。  
3. 轴反了：改 Unity `UdpHandDataReceiver` 的 invertX/Y/Z（不要再用 Python `POS_*` 与 Unity 双重翻轴）。

`POS_*` 仅在 `LMS_RAW_CAPTURE_SPACE=False`（或无 lms 回退）时使用：

| 参数 | 作用 |
|------|------|
| `POS_SCALE` | 归一化坐标放大到米级尺度 |
| `POS_AXIS_REMAP` | 轴置换/取反（MediaPipe → Unity） |
| `POS_OFFSET` | 平移到 Unity 场景原点附近 |
| `PINCH_DISTANCE_THRESHOLD` | 捏合灵敏度 |
| `LPF_POS_ALPHA` / `LPF_ROT_ALPHA` / `LPF_LMS_ALPHA` | 越大越跟手、越小越稳 |
| `FLIP_HORIZONTAL` | 自拍镜像；与 MediaPipe 左右标签一致 |
| `TARGET_FPS` | 限制 UDP 发包频率 |

## 后续升级：双目反光标记定位

`hand_processor.py` 将手腕位置抽象为 `WristPositionProvider`：

- 默认：`MediaPipeWristProvider`（当前实现）  
- 升级：实现自定义 Provider，只输出手腕 `pos`（米）

```python
from hand_processor import WristPositionProvider, HandProcessor

class MarkerWristProvider(WristPositionProvider):
    def get_wrist_pos(self, landmarks, handedness, image_size):
        # TODO: 双目反光点解算 → [x, y, z] Unity 米
        return [0.0, 1.2, 0.5]

processor = HandProcessor(wrist_provider=MarkerWristProvider())
# 或运行时：
# processor.set_wrist_provider(MarkerWristProvider())
```

**复用不变**：`pinch` 仍由 MediaPipe 指尖距离判定；UDP 报文结构、`udp_sender`、`main` 组装逻辑无需修改。

## 异常策略

摄像头打不开、读帧失败、未检测到手、UDP 发送失败时，仅打印警告，主循环持续运行。
