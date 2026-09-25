# Unity 侧交付对齐说明（Python 端）

来源：UDP手部数据接收与骨架驱动 · 交付文档

## 端坐顶摄用法（目标体验）

1. 人端坐电脑前，显示器顶部摄像头拍双手。
2. Unity 首页：左右手默认停在油烟机正前方两侧（相对驱动的 `defaultPosition`）。
3. 首帧校准后，虚拟手只跟**相对位移**；物理手移动 → 操作油烟机零件。

## 协议分工

| 字段 | Python 发送（默认 `LMS_RAW_CAPTURE_SPACE=True`） | Unity 消费 |
|------|--------------------------------------------------|----------|
| `id` | 0=左 1=右 | 同左 |
| `pinch` | 0/1 | 交互分发 |
| `pos` | **必须等于 `lms[0]`**，动捕原始系 | `MapPoint` 后作腕部样本；无 lms 时回退 |
| `rot` | 动捕原始系四元数 xyzw（不预乘 `POS_*`） | `MapRotation` |
| `lms` | MediaPipe 动捕原始系 21×`[x,y,z]` | `MapPoint` 后相对骨架：`defaultPose + (lms[i]−origin)` |

**禁止**：raw 模式下对 `pos` 单独做 `POS_SCALE/OFFSET`，而对 `lms` 保持原始值——会把相对驱动打崩（手飞到场景外/骨架拉长）。

## Python 配置

- `SEND_LANDMARKS=True`：报文带 `lms`
- `LMS_RAW_CAPTURE_SPACE=True`（默认）：`pos`/`lms`/`rot` 同动捕原始系；Unity 负责轴映射 + 相对驱动
- `LMS_RAW_CAPTURE_SPACE=False`：Python 对 `pos`/`lms`/`rot` 全部走 `POS_*`；此时 Unity 轴映射应恒等，避免双重翻轴
- `POS_*`：仅非 raw 回退路径；端坐顶摄默认路径不依赖它们把手放进油烟机前

## Unity 挂载（摘录）

1. `HandDataHub`
2. `UdpHandDataReceiver`（`listenPort=9999`，`loopbackOnly=true`；默认 invertY/invertZ）
3. 每手一个 `VirtualHandDriver`（`handId` 0/1，`enableLandmarkDriving`）
   - 左手默认位约 `(-0.18, -0.05, 0.8)`，右手约 `(0.18, -0.05, 0.8)`（主相机在 +Z）
   - 有 `lms` 时校准原点用 `landmarks[0]`
   - `palmSmoothSpeed`（默认 20）：掌根每渲染帧趋近最新目标，消除 ~30Hz 阶梯；设 `0` 可硬跟随对比。OpenCV 预览镜像 ≠ Unity 操作同向（后者靠 invertY/Z + 相对驱动）
4. `HandLandmarkRig` 运行时自动生成，无需预制体

## 启动

```bash
uv run python main.py
```

发往 `127.0.0.1:9999`。先开 Unity Play，再开 Python。
