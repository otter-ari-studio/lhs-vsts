# Design: Playwright 合格整局 E2E

## Boundaries

- **In**：`apps/frontend` Playwright 用例与 `E2eHarness`；必要时修交互/UI 卸载导致的稳定性问题。
- **Out**：改 SOP 规则、改种子机型语义、hand 路径、后端成绩 schema。

## Flow

```
goto /?e2e=1 → 进入训练 → wait __lhsE2e.ready
→ for each remove/open/nut step: aim + pointer act → (spot-check asserts)
→ wait 家电清洗蒙层结束 (completeAllCleans)
→ for each install/close/nut: aim offer/slot + pointer act
→ end screen 合格 / 100
→ GET http://localhost:3001/api/scores 命中
```

## Contracts

### Harness (`window.__lhsE2e`) — extend

| Method | Purpose |
| ------ | ------- |
| `projectPart(id)` | 已有：零件世界位 → 屏幕坐标 |
| `inventory` / `completedSteps` / `currentStepLabel` / `canvasRect` | 已有 |
| `currentStepId()` | 新增：当前 chrome `stepId`（抽检/调度） |
| `score()` / `passed()` / `faultCount()` | 新增：结束前轮询，避免只靠 DOM |
| `projectOfferOrPart(id)` | 可选：回装时优先投影 offer 位姿态（若与 park 不同） |

瞄准仍只用于定位；**完成动作必须走真实 `page.mouse` / click**，禁止 `tryBeginRemove` 等业务捷径。

### Pointer recipes（与产品行为对齐）

| Kind | Recipe |
| ---- | ------ |
| grabbable remove | down on part → drag to canvas left → up（同现有 oil_box） |
| grabbable install | down on offered part → drag toward anchor/slot → up |
| clip open/close | click on projected clip |
| rotate_nut remove/install | click（remove）；install 为 offer 拖回槽或 click+drag 按现网 |
| wash | 等待蒙层出现后消失 / `appliance_wash` done（约 3s + buffer） |

### Assertion plan (D6)

**Gates**

1. 全部拆卸相关 `remove_*` / `open_clip_*` / `remove_nut_wind` 完成后，清洗开始或 `applianceWashPending`
2. 清洗结束后首个 `install_*` 为 current（或 chrome 显示回装）
3. `passed === true` 且结束页可见

**Spot checks**

- `remove_oil_box` ∈ completed；inventory 含 `oil_box`
- 完成一侧 `open_clip_left` 或 `open_clip_right` 后断言该 step
- `remove_nut_wind` ∈ completed
- 一次回装（推荐 `install_wind_wheel` 或当前 FIFO 首个 install）∈ completed

**Final**

- DOM：合格、得分 100、无错因块（或空）
- API：`GET /api/scores` 最新或按 session 命中 `score: 100`, `passed: true`

## Trade-offs

| Choice | Why |
| ------ | --- |
| 清洗走 UI 蒙层而非逐点 dwell | 与鼠标演示产品路径一致；省时 |
| 满分硬门槛 | 误触 Orbit/错序会失败 → 需锁 orbit、准瞄准；换稳定性 |
| 代表步抽检 | 比逐步全断言更稳，比纯关卡更好定位 |
| 扩展 harness 而非 DOM 猜坐标 | WebGL 无稳定命中测试 id |

## Compatibility / Rollback

- 不改对外 API schema；仅前端测试与 harness。
- 若整局过脆：可临时提高 timeout / 加重试，不降 AC 满分（产品已定 D5）。
- 单步 `drag-oil-box` 保持独立，整局失败不删掉它。

## Risks

1. **OrbitControls 抢拖** → 确认 grab 时 `orbitLockHub`；必要时 e2e 禁用 orbit。
2. **零件入栏后不可见** → `projectPart` 对 park/offer 位；回装前等 offer 弹出。
3. **`removeChildFromContainer`** → 查 R3F 卸载（inventory hide）；整局前必须修稳。
4. **FIFO 回装顺序** → 驱动顺序必须跟 `buildChromeSteps` current，不能写死错序。
5. **时长** → 多步拖拽，单测 timeout 建议 ≥ 5–8 min；workers=1。
