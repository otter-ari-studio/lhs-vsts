# Implement: coverage ≥ 90% + E2E

Monorepo split (AC1–AC7) is done. This pass closes AC8–AC9.

## Checklist

1. `packages/machine`: add unit tests for parse / StepGraph / ScoreBook / TrainingSession / wash / sessionEvents. Script `test` + `test:cov` with line threshold 90.
2. `apps/backend`: raise scores/machines branch coverage (invalid score bodies, corrupt scores.json, ensureRuntime paths). Keep `test:cov` threshold lines ≥ 90.
3. `apps/web`: enable Rstest coverage; cover `src/api/*`, AdminPage score list / save, end-screen submit-once. Threshold lines ≥ 90 on included sources. Exclude pure R3F/Three visual meshes if needed, but **do not** exclude `api/`, `ui/AdminPage`, or score-submit path. Document excludes in rstest config.
4. E2E (one automated flow, no 3D mouse):
   - Spin Nest with temp `DATA_DIR` (or reuse integration harness).
   - PUT machine with changed `deductIllegalOrder` (or displayName).
   - Load def via same path web uses (`parseMachineDef` + GET).
   - Drive `TrainingSession` through required steps to finished/passed.
   - POST score payload matching TrainPage contract.
   - GET `/api/scores` contains the record; no student fields.
   - Prefer `apps/backend/test/*.e2e-spec.ts` or `apps/web/tests/*e2e*` that hits a live Nest app. Root script `test:e2e` runs it.
5. Root README: how to run `test:cov` / E2E.

## Validation

```bash
vp run --filter @lhs-vsts/machine test:cov
vp run backend#test:cov
vp run web#test:cov
vp run test:e2e   # or documented equivalent
```

All three coverage reports must show **lines ≥ 90**. E2E must pass without a browser 3D playthrough.

## Rollback

Revert only the new test/coverage config and E2E files if the gate fails; do not undo the monorepo layout.
