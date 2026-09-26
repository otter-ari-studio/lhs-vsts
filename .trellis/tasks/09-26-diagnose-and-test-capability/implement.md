# Implement: 共享瞄准仲裁 + 测试

## Checklist

1. [x] 在 `defaults.ts` 增加共享瞄准 sticky / `AIM_IN_RANGE_EXIT_SCALE` 常量（值写入注释与测例）。
2. [x] 新增纯模块（建议 `web/src/interaction/sharedAim.ts`）：
   - `pickSharedHover(...)`
   - `resolveAimInRange(...)`（或等价命名）
3. [x] 改 `InteractionRouter`：用 `pickSharedHover` 替代裸 priority/distance 合并；写 hub 前用 `resolveAimInRange`；保留无 hover 时的 SOP fallback。
4. [x] 测例（建议扩 `interaction-grab.test.ts` 或新 `shared-aim.test.ts`）：
   - 双手非 SOP 距离交替略优 → sticky 保持（AC1）
   - 一手 SOP 一手更近非 SOP → SOP 胜（AC2）
   - inRange 进出滞回（AC3）
   - `aimTargetHub` 去重与订阅（AC4）
5. [x] `cd web && pnpm run test`（+ 必要 lint）全绿（AC5）。
6. [ ]（可选）顶摄冒烟双手互抢（AC6）。

## Validation

```bash
cd web && pnpm run test && pnpm run lint
```

## Risky files

- `web/src/interaction/InteractionRouter.tsx` — 每帧交互主路径
- `web/src/interaction/defaults.ts` — 常量影响手感

## Before `task.py start`

- [x] `prd.md` 已收敛
- [x] `design.md` / `implement.md` 已就位
- [ ] 用户批准本方案

## Context manifests

实现前为 `implement.jsonl` / `check.jsonl` 补真实条目（替换 seed），至少包含：

- `design.md`（本任务）
- `web/src/interaction/InteractionRouter.tsx` / `registry.ts` / `aimTargetHub.ts` / `defaults.ts`
- 现有 `web/tests/interaction-grab.test.ts` 作测例风格参考
