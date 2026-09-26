# Design: 共享瞄准仲裁 + inRange 滞回

## Problem

`InteractionRouter` 每帧裸合并双手 `hoverCand` → 写入 `aimTargetHub`。双手距离接近时胜者帧级翻转，表现为引导茎/HUD 高亮乱跳。`inRange` 无滞回，半径边缘闪烁。

## Architecture

保持单共享目标模型不变。把「选胜」与「inRange」从 `useFrame` 里抽成纯函数，便于单测：

```
per-hand hoverCand (existing sticky)
        │
        ▼
pickSharedHover(cands[], prev, opts) ──► globalHover / selectionHub
        │
        ▼
resolveAimInRange(dist, radius, prevInRange) ──► aimTargetHub.inRange
        │
        ▼
aimTargetHub.set({ id, position, inRange })
HandAimCursor / TrainPage HUD (unchanged consumers)
```

## Contracts

### `pickSharedHover`

Inputs:

- `candidates`: 0–2 个 `{ it: HandInteractable, dist: number }`（来自有 pose 的手的 `hoverCand`）
- `prev: HandInteractable | null`（上一帧 global 胜者）
- constants: `SOP_PICK_PRIORITY`, sticky 距离滞回（建议：挑战方须比 prev 更近至少 `SHARED_HOVER_STICK_SLACK_M`，或 prev 已不可交互 / 不在候选里）

Rules (D-arbitrate):

1. 过滤掉 `!isInteractableNow()`。
2. 若存在 `pickPriority ≥ SOP_PICK_PRIORITY` 的候选 → 只在 SOP 集合内选胜（priority desc，再 dist asc）；对 `prev` 若仍在 SOP 集合内则套 sticky。
3. 否则在全部候选内选胜；`prev` 仍在候选且挑战未突破 sticky → 保持 `prev`。
4. 无候选 → `null`（后续 aim 仍可走现有 SOP fallback 远距离引导，本任务不改 fallback 策略）。

### `resolveAimInRange` / sticky inRange

- Enter: `dist ≤ radius` → true  
- Exit: 仅当 `dist > radius * AIM_IN_RANGE_EXIT_SCALE`（建议与 hover 一致 `1.45`，或抽共享常量）→ false  
- 中间带保持上一值

### `aimTargetHub`

行为保持；补单测证明去重与订阅。无需改对外 API。

## Trade-offs

| 选择 | 收益 | 代价 |
|------|------|------|
| 抽纯函数 | 可测、Router 变薄 | 多一个小模块 |
| SOP 优先于 sticky | 跟教学步骤 | 双手都非 SOP 时才完全 sticky |
| 保留远距 SOP fallback | 不扩大范围 | D 级「瞎指」仍可能存在 |

## Compatibility

- 不改 MachineDef / SOP 步骤图 / 抓取 commit 时序。
- `pickPendingTarget(highlighted)` 仍跟 global hover；共享目标稳住后，指错件预期改善（不保证，Out of Scope 专项）。

## Rollback

还原 `InteractionRouter` 合并逻辑与新模块/测例即可；无数据迁移。
