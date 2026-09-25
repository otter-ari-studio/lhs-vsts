# Implement: MVP A checklist

## Order

1. **Python WS 硬切**
   - [ ] `config.py`：`WS_HOST`/`WS_PORT`（默认 `127.0.0.1:8765`），移除 UDP 配置
   - [ ] 新增 `ws_sender.py`：listen + broadcast JSON；无客户端不崩
   - [ ] `main.py` 改用 WS；窗口标题/日志改为 Web
   - [ ] 删除或停用 `udp_sender.py`
   - [ ] `requirements.txt` / `pyproject.toml` 增加 `websockets`；更新 README 联调步骤

2. **Web 依赖与骨架场景**
   - [ ] `web/package.json` 增加 `three`、`@react-three/fiber`、`@react-three/drei`、`@types/three`
   - [ ] 搭建 Canvas + 灯光 + 地面/墙 + `RangeHoodShell`
   - [ ] 连接状态条 + Recalibrate

3. **手部管线**
   - [ ] `handSocket` 订阅 → `HandDataHub`
   - [ ] `axisMap`（默认翻 Y/Z）
   - [ ] `RelativeHandDriver` + `LandmarkRig`（左青右橙、pinch 高亮）
   - [ ] 停滞隐藏骨架；无数据保持默认休息位

4. **联调验证**
   - [ ] Python + `pnpm run dev` 端到端
   - [ ] 对照 OpenCV：同向跟随、相对驱动、捏合反馈
   - [ ] 断线重连 / 空手行为符合 AC2

## Validation

```bash
# Python
cd lhs-vsts && uv sync   # or pip install -r requirements.txt
uv run python main.py

# Web (another terminal)
cd lhs-vsts/web && pnpm install && pnpm run dev
# open http://localhost:3000
```

- `pnpm run lint` / `pnpm run test`（web）在改动后通过或按需补测 hub/axisMap 纯函数。

## Risky files

- `main.py` / `config.py`：联调入口，易漏 README
- Unity 轴映射语义：web `axisMap` 必须与 `UdpHandDataReceiver` 默认一致，否则手感镜像

## Rollback

- `git checkout` 恢复 `udp_sender.py` + 旧 config；停用 web 手部模块即可回到 Unity UDP。

## Before `task.py start`

- 用户已批准本 PRD/Design/Implement
- 本环境 Shell hook 若仍失败，改为会话内直接实现（inline），不依赖 sub-agent JSONL 门禁
