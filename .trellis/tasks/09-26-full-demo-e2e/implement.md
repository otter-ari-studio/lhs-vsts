# Implement: Playwright 合格整局 E2E

## Checklist

1. **Harness** — 扩展 `E2eHarness`：`currentStepId`、`score`、`passed`、`faultCount`（及回装投影如需要）；更新 `env.d.ts`。
2. **Shared e2e helpers** — 从 `drag-oil-box.spec.ts` 抽出 `waitForE2e` / `dragPartToCanvasLeft` / `clickPart` / `dragPartToAnchor` 到 `e2e/helpers.ts`；单步用例改为引用。
3. **Full-session spec** — 新增 `e2e/full-demo-session.spec.ts`：按 chrome current 驱动整局；关卡 + D6 抽检；结束页 + `GET /api/scores`。
4. **Stability** — 复现并修 `removeChildFromContainer`（优先 inventory/hide 与 Canvas 子树）；必要时 `?e2e=1` 下禁用 Orbit。
5. **Config** — `playwright.config.ts`：整局 timeout（test ≥ 8 min）；保持 localhost webServer。
6. **Docs** — README E2E 节补充整局用例说明。
7. **Validate** — `vp run test:e2e` 连续 2 次；`vp lint --fix` 相关文件。

## Validation

```bash
vp run test:e2e
vp run test:e2e   # second run
vp lint --fix
```

## Risky files

- `apps/frontend/src/e2e/E2eHarness.tsx`
- `apps/frontend/src/interaction/GrabPart.tsx` / `grabbableDragApi.ts` / `partInventory.ts`（卸载）
- `apps/frontend/src/ui/TrainPage.tsx`（清洗蒙层 / 结束写分）
- `apps/frontend/e2e/*`
- `apps/frontend/playwright.config.ts`

## Rollback points

- Harness API 向后兼容（只增字段）；单步用例不依赖新字段也可跑。
- 整局 spec 可单独 skip而不影响 `drag-oil-box`。

## Review gate before `task.py start`

- [x] `prd.md` 已收敛（无未决 Open Questions）
- [x] `design.md` / `implement.md` 已写
- [ ] 用户审阅并通过后执行 `task.py start`
