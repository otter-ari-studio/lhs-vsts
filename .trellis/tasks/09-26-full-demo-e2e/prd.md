# PRD: Playwright 完整训练演示端到端

## Goal

用真实浏览器把「引导 → 训练 → 按 SOP 合格整局（拆→清→装）→ 结束写分」跑通自动化，演示/回归不必手点 3D。

## Background

- 已有 Playwright 单步：`e2e/drag-oil-box.spec.ts`（`oil_box` 入栏），`vp run test:e2e` 可通过。
- 种子机型 `range_hood_generic` 交互：grabbable 拖拆/拖装、clip 点击、rotate_nut 点击拧（鼠标路径一键 `tryNutAction`）、拆完后「家电清洗」蒙层约 3s 后 `completeAllCleans()`。
- 结束页在 `passed`/`finished` 时出现，并 `POST /api/scores`。
- E2E 瞄准：`/?e2e=1` + `window.__lhsE2e`；整局需扩展 harness。
- 已知：跑 E2E 时偶发 `removeChildFromContainer` 浏览器报错，单步仍绿。

## Decisions

| ID | Decision | Status |
| -- | -------- | ------ |
| D1 | Playwright + 现有 webServer（backend+frontend）；扩展用例与 harness，不换栈。 | decided |
| D2 | 范围 = **合格整局**：拆卸 → 清洗蒙层 → 回装 → 结束页 → 写分。 | decided |
| D3 | 仅鼠标 `PointerInteraction` 路径；不做 hand/摄像头 E2E。 | decided |
| D4 | MVP 只做零扣分合格路径；非法顺序/扣分负例不做。 | decided |
| D5 | 成绩断言 = **合格且满分**：结束页合格、得分 100、无错因；`GET /api/scores` 命中该局 `passed: true` 且 score 100。不做管理页二次断言。 | decided |
| D6 | 中途断言粒度（见 Q3）。 | open |

## Requirements

- **R1** 从引导进入训练，真实 pointer 按 SOP 跑完拆 → 清（蒙层）→ 装。
- **R2** 覆盖 grabbable / clip / rotate_nut；清洁走现有清洗蒙层，不强制逐点 dwell。
- **R3** 结束页「合格」、得分 100、错因列表为空；`GET /api/scores` 可见对应记录。
- **R4** `drag-oil-box` 仍通过；整局用例纳入 `vp run test:e2e`。
- **R5** 阻断稳定性的 React/卸载错误（含 `removeChildFromContainer`）必须修到连续 ≥2 次通过。

## Acceptance Criteria

- [ ] AC1：`vp run test:e2e` 含合格整局用例，本地连续 ≥2 次通过。
- [ ] AC2：断言引导→训练、结束页「合格」、得分展示为 100、无错因。
- [ ] AC3：`GET /api/scores` 命中本局，`passed: true` 且 `score: 100`。
- [ ] AC4：既有 `oil_box` 单步用例仍通过。
- [ ] AC5：中途断言粒度符合 D6（Q3 裁定后填入）。

## Out of Scope

- hand / MediaPipe E2E
- 多机型、登录、学员档案
- 像素截图门禁
- 用 Rstest 头测替代本演示 E2E
- 扣分/非法顺序负例
- 管理页 `#admin` 二次验收

## Open Questions

- **Q3**：中途断言粒度（见下轮提问）。
