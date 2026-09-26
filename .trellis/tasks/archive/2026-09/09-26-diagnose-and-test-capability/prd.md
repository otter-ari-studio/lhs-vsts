# 排查问题并构建测试能力

## Goal

稳住油烟机训练闭环的**共享瞄准/高亮**：双手同时靠近时目标不再在两手之间乱跳；半径边缘 `inRange` 不再裸闪。修复后用 Rstest 纯函数回归锁住仲裁与滞回行为。

## Background

- 产品：纯浏览器 MediaPipe + React/Three 拆洗训练（`09-25-appliance-sim-redesign`）。
- 现状：`InteractionRouter` 每帧将双手 `hoverCand` 按 priority→distance 合并为单一 global hover，写入 `aimTargetHub`（`HandAimCursor` + HUD 共用）。**无 global sticky** → 双手互抢时 hub `id` 帧级抖动。
- 同手 hover 已有 `findHoverTargetSticky`（`exitScale=1.45`）；aim `inRange` 用裸 `distance ≤ interactionRadius`。
- 已有单测覆盖 nearest / 同手 sticky / grab；**无** `aimTargetHub` 与双手共享仲裁测例。

## Decisions

| ID          | Decision                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| D-purpose   | 先修闭环再补测试                                                                                           |
| D-priority  | 瞄准/高亮 > 抓取 > 追踪 > SOP                                                                              |
| D-aim-mode  | 目标乱跳 > inRange 闪烁 > 指错件 > 远距离瞎指                                                              |
| D-repro     | 主复现 = 双手同时靠近、两手目标互抢                                                                        |
| D-arbitrate | 有 SOP 候选则 SOP 优先；否则 global sticky（滞回）                                                         |
| D-mvp       | **B**：仲裁 + aim `inRange` 滞回；单测覆盖仲裁/互抢/进出半径；不含 capture 回放/CI 大改、不含抓取/追踪专项 |

## Requirements

- **R1** 双手各持不同 hover 目标且距离接近时，共享瞄准目标（`aimTargetHub.id` / HUD 高亮）不得帧级来回切换。
- **R2** 任一双手 hover 候选为当前 SOP（`pickPriority ≥ SOP_PICK_PRIORITY`）时，共享目标必须落在 SOP 候选上（多 SOP 时仍按 priority→distance，并对胜者做 sticky）。
- **R3** 无 SOP 候选时，保持上一帧共享胜者，直至挑战方满足明确更优条件（更高 priority，或明显更近——见 `design.md` 滞回常量）。
- **R4** `aimTargetHub.inRange` 采用与 hover 同哲学的进出滞回，避免半径边缘闪烁。
- **R5** 将可测仲裁 / `inRange` 滞回 / `aimTargetHub` 行为抽成可单测纯函数或模块，并补充 Rstest 回归（含双手互抢、进出半径）。
- **R6** 不改变「单共享瞄准 + 茎画在距目标更近的那只手」的产品形态。

## Acceptance Criteria

- [x] AC1：模拟双手各 hover 不同非 SOP 件、距离交替略优时，共享 `id` 在 sticky 窗口内保持不变（单测）。
- [x] AC2：一手 hover SOP、一手 hover 更近非 SOP 时，共享目标为 SOP（单测）。
- [x] AC3：目标在半径内 → 略出 enter 半径但仍在 exit 滞回内时，`inRange` 保持 true；超出 exit 后变 false（单测）。
- [x] AC4：`aimTargetHub` 同值不重复通知；`id`/`inRange`/position 变化可订阅（单测）。
- [x] AC5：`cd web && pnpm run test` 全绿（51 tests）；本轮改动文件无新增 lint 问题（仓库仍有既有 R3F `no-unknown-property` 等噪声）。
- [ ] AC6：人工顶摄冒烟（可选但建议）：双手同时靠近不同件时，茎/高亮不再肉眼乱跳。

## Out of Scope

- 取消共享 hub、每手独立瞄准
- 远距离 SOP 瞎指专项、抓取/吸附专项、追踪/标定专项、SOP 步骤逻辑大改
- Capture 回放基建、CI 门禁重构
- 指错件专项核对（观察是否随 R1–R3 自然改善；不达标则另开任务）

## Technical Notes

- 详见 `design.md`；执行清单见 `implement.md`。
- 主要改动面：`InteractionRouter` 的 global hover / aim 写入；建议抽出 `pickSharedHover`（名以实现为准）与 `stickyInRange`；常量放 `defaults.ts`。

## Open Questions

无（规划已收敛，待用户批准后 `task.py start`）。
