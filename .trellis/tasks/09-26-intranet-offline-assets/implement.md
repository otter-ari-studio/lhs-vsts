# Implement: Intranet offline runtime assets

## Checklist

1. Download/vendor `.task` + warehouse HDR into `apps/frontend/public/{models,hdri}/`.
2. Update `mediapipeLoader.ts` — local model path; remove jsDelivr fallback.
3. Update `TrainingScene.tsx` — local Environment `files`/`path`.
4. Fix frontend tests that assert CDN URLs.
5. Note offline assets in frontend README or `.trellis/spec/guides`.
6. Validate: `vp check`, frontend tests, confirm built `dist` contains models/hdri; optional `build:docker` smoke.

## Validation

```bash
rg -n "googleapis|jsdelivr|githack|fonts\.googleapis" apps/frontend/src
vp check
pnpm --filter frontend test
pnpm --filter frontend build && ls apps/frontend/dist/models apps/frontend/dist/hdri
```

## Ready-for-start gate

- [x] prd / design / implement
- [x] jsonl curated
- [ ] User approves `task.py start`
