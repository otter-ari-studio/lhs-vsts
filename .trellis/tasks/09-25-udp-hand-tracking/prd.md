# PRD: Unity 泛型抽油烟机实训样机 — 双手 UDP 推送

## Goal

用本机摄像头 + MediaPipe Hands 实时识别双手，按 Unity `UdpHandDataReceiver` 约定的 JSON 报文，经 UDP `127.0.0.1:9999` 驱动虚拟手。

## Acceptance Criteria

- [ ] `config.py` 集中存放 UDP、FPS、MediaPipe、捏合阈值、坐标转换、低通滤波参数
- [ ] `udp_sender.py` 提供 `send_json`；发送失败只警告，不崩溃
- [ ] `hand_processor.py`：摄像头采集、21 点推理、pinch、手腕 pos、手部 rot、低通滤波；手腕位置可替换接口
- [ ] `main.py`：主循环 + OpenCV 预览/骨架绘制；空格暂停、q 退出；控制台打印手数量/pinch/手腕坐标
- [ ] 报文仅含 `t` / `hands`（id/pinch/pos/rot），无额外字段；id=0 左、id=1 右
- [ ] `cv2.VideoCapture(0)`；依赖含 opencv-python、mediapipe
- [ ] 控制发包帧率；摄像头/读帧/无手/UDP 异常均只警告并继续
- [ ] `requirements.txt` + `README.md`（安装、启动、标定、双目升级指引）

## Constraints

- Python 3.9 + uv
- 禁止修改 Unity 报文结构
- 坐标转换参数全部在 config
