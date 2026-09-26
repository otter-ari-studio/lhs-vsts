# PRD: Playwright 完整训练演示端到端

## Goal

用真实浏览器把「引导 → 训练 → 合格整局（拆→清→装）→ 结束写分」自动化，演示/回归不必手点 3D。

## Background

- 已有单步 Playwright：`apps/frontend/e2e/drag-oil-box.spec.ts`（`oil_box` 入栏），`vp run test:e2e` 可通过。
- 种子机型 `range_hood_generic`：grabbable 拖拆/拖装、clip 点击、rotate_nut 点击拧（鼠标路径一键 `tryNutAction`）；拆完后「家电清洗」蒙层约 3s 后 `completeAllCleans()`。
- 结束页在 `passed`/`finished` 时出现并 `POST /api/scores`。
- 瞄准：`/?e2e=1` + `window.__lhsE2e`；整局需扩展 harness。
- 已知：E2E 中偶发 `removeChildFromContainer`，单步仍绿。

## Decisions

| ID | Decision |
| -- | -------- |
| D1 | Playwright + 现有 webServer；扩展用例与 harness。 |
| D2 | 范围 = 合格整局：拆卸 → 清洗蒙层 → 回装 → 结束页 → 写分。 |
| D3 | 仅鼠标 `PointerInteraction`；不做 hand E2E。 |
| D4 | MVP 只做零扣分合格路径；负例不做。 |
| D5 | 成绩 = 合格且满分：结束页 100 分、无错因；`GET /api/scores` 命中 `passed: true` 且 `score: 100`。不做管理页二次断言。 |
| D6 | 中途 = **关卡断言 + 代表步抽检**：拆完 / 清洗结束 / 装完 / 结束写分；另抽检 `remove_oil_box`、开一侧卡扣、`remove_nut_wind`、一次回装（如 `install_wind_wheel`）。 |

## Requirements

- **R1** 从引导进入训练，真实 pointer 跑完拆 → 清（蒙层）→ 装。
- **R2** 覆盖 grabbable / clip / rotate_nut；清洁走清洗蒙层。
- **R3** 结束页「合格」、得分 100、错因空；`GET /api/scores` 命中对应记录。
- **R4** `drag-oil-box` 仍通过；整局纳入 `vp run test:e2e`。
- **R5** 阻断稳定性的卸载错误（含 `removeChildFromContainer`）修到连续 ≥2 次通过。
- **R6** 断言粒度符合 D6。

## Acceptance Criteria

- [x] AC1：`vp run test:e2e` 含合格整局用例，本地连续 ≥2 次通过。
- [x] AC2：结束页「合格」、得分 100、无错因文案。
- [x] AC3：`GET /api/scores` 命中本局，`passed: true` 且 `score: 100`。
- [x] AC4：既有 `oil_box` 单步用例仍通过。
- [x] AC5：关卡断言（拆完、清洗结束、装完）+ 代表步抽检（`remove_oil_box`、一侧 `open_clip_*`、`remove_nut_wind`、一次 `install_*`）均通过。

## Out of Scope

- hand / MediaPipe E2E；多机型 / 登录 / 学员档案
- 像素截图门禁；Rstest 头测替代本 E2E
- 扣分/非法顺序负例；`#admin` 二次验收
