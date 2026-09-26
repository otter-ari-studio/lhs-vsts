# Implement: Kitbash 3D visual polish

## Checklist

1. **Materials** — Adjust `apps/frontend/src/visual/materials.ts` metal/plastic/glass contrast for teaching readability; keep shared presets.
2. **Geometry** — Small high-leverage edits in `apps/frontend/src/visual/kitbash/parts.tsx` (shell silhouette, detachable cues); preserve local origins / mounts.
3. **Scene** — Rebalance lights + floor/backdrop in `apps/frontend/src/scene/TrainingScene.tsx`; add light `Environment` preset if metal still flat; shadow map ≤2048; **no** EffectComposer.
4. **Manual look check** — Default orbit framing: chassis readable, metal≠plastic, no bloom/washout.
5. **Validate** — Unit tests + frontend e2e (drag / SOP paths).

## Validation commands

```bash
vp run test:frontend   # or package-local rstest if that is the project script
vp run test:e2e        # from repo root when backend+frontend available
vp check               # fmt/lint/types as configured
```

Confirm exact script names in root `package.json` before running.

## Risky files / rollback

| File | Risk |
|------|------|
| `TrainingScene.tsx` | Environment load / brightness affecting SOP readability |
| `parts.tsx` | Accidental local offset drift → grab/e2e miss |
| `materials.ts` | Low risk if preset-only |

Rollback: restore those three files.

## Ready-for-start gate

- [x] `prd.md` converged (no open product questions)
- [x] `design.md` + `implement.md` present
- [x] User reviews artifacts / approves `task.py start`
- [x] `implement.jsonl` + `check.jsonl` have real spec entries
- [x] Implement + check green (`vp check`, unit, e2e)
