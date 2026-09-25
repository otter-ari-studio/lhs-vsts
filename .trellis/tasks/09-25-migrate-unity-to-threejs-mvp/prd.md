# PRD: Unity 油烟机样机 → Three.js Web（MVP A）

## Goal

用 `lhs-vsts/web` 的 Three.js 场景替代 Unity 作为手部动捕的可视化接收端；`lhs-vsts`（Python）经本机 WebSocket 直连浏览器，不再通过 UDP 与 Unity 交互。首期只验证「双手相对跟随 + 简化机壳场景」，不做拆装交互。

## Background / Confirmed Facts

- Python 现状：摄像头 + MediaPipe Hands → UTF-8 JSON → UDP `127.0.0.1:9999`（见 `udp_sender.py`、`config.py`、`README.md`）。
- 协议字段：`{ t, hands:[{ id, pinch, pos, rot, lms×21 }] }`；`id` 0=左 1=右；`pos == lms[0]`；默认 `LMS_RAW_CAPTURE_SPACE=True`（MediaPipe 原始系）。
- Unity 现状：`UdpHandDataReceiver` 轴映射（默认翻 Y/Z）→ `HandDataHub` → `VirtualHandDriver` 相对腕位驱动 + `HandLandmarkRig` 骨架；交互链（Grab/Clip/Nut/Lock/Score）本 MVP 不移植。
- 默认休息位（Unity）：左 `(-0.18, -0.05, 0.80)`，右 `(0.18, -0.05, 0.80)`，朝向 Y180；左青右橙骨架。
- `lhs-vsts/web`：Rsbuild + React 19 脚手架，无 Three.js、无仿真逻辑；仓库无现成 GLTF，零件为 Unity Prefab。

## Decisions (locked)

| ID | Decision |
|----|----------|
| D1 | MVP = 手部数据通路 + 场景/骨架可视化；拆装交互后置 |
| D2 | Python 起本机 WebSocket 服务；浏览器为客户端；JSON 结构沿用现 UDP 协议 |
| D3 | Python 继续发 MediaPipe 原始系；轴映射 + 相对腕位驱动在 web 完成 |
| D4 | 场景 = 程序化简化机壳 + 地面/墙面参考 + 双手 21 点骨架；无可拆零件 |
| D5 | 硬切：WS 替换 UDP；不再维护 Unity UDP 联调路径 |
| D6 | 保留 OpenCV 预览窗口（空格暂停 / q 退出）作动捕排障 |

## Requirements

- **R1** Python 主循环在发帧时通过 WebSocket 广播手部 JSON（≤`TARGET_FPS`），无客户端时不崩溃，仅警告。
- **R2** 删除/替换 UDP 发送路径（`udp_sender` → WS sender；config/README 同步）。
- **R3** `web` 连接 `ws://127.0.0.1:<port>`，断线自动重连；展示连接状态与手数量。
- **R4** web 内对每手：首帧校准原点，世界位 = 默认休息位 + (样本 − 原点)；lms 驱动 21 关节 + 连线；无 lms 时仅掌根；样本停滞 >0.3s 隐藏骨架、位姿保持。
- **R5** 轴映射默认与 Unity 一致（Y/Z 翻转），可在 web 配置常量中调整。
- **R6** 场景含简化机壳、地面、墙面；双手始终可见（无数据时停在默认休息位）。
- **R7** pinch 状态在骨架/掌根上有可见反馈（如高亮），暂不触发交互。

## Acceptance Criteria

- [ ] AC1：仅启动 Python + `pnpm run dev`，浏览器可见机壳与双手；捏合/移动时骨架同向跟随（相对驱动）。
- [ ] AC2：断掉 WS 或空手后，手不消失；骨架在停滞超时后隐藏；重连后可重新校准（或提供 Recalibrate 入口）。
- [ ] AC3：工程内无运行时依赖 UDP→Unity；README 联调步骤改为 Python WS + web。
- [ ] AC4：OpenCV 窗口仍可用；空格/q 行为不变。

## Out of Scope

- Grab / Clip / Nut / DisassemblyLock / Scoring / 机型 JSON 驱动拆装
- 正式 GLTF 资产、物理引擎级碰撞
- 浏览器内 MediaPipe（动捕仍在 Python）
- LAN/多机部署；与 Unity 双发或对照开关
- 修改 `lha-virtual-simulation-training-system-unity` 工程（可保留作参考）

## Open Questions

无（规划已收敛）。
