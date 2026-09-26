# Playwright Frontend E2E (Training Client)

> Executable conventions for `apps/frontend` real-browser E2E under `/?e2e=1`.

## Scope / Trigger

Use when adding or changing Playwright tests that drive the R3F training canvas, scores write path, or `window.__lhsE2e`.

## Contracts

### Entry

- Open `/?e2e=1` then navigate to `#train` (keep the query string).
- Wait until `window.__lhsE2e?.ready === true`.
- Aim with harness projections; **complete actions only via real `page.mouse` / click** — never call `tryBeginRemove` / `completeAllCleans` from the test as a shortcut (wash overlay may call `completeAllCleans` as product UI).

### Harness (`window.__lhsE2e`)

Typical fields: `projectPart`, `projectOfferOrPart`, `projectAnchor`, `inventory`, `completedSteps`, `currentStepId` / `currentStepLabel`, `score` / `passed` / `faultCount`, `sessionId`, `canvasRect`.

**Serialization trap**: `page.evaluate(() => window.__lhsE2e)` drops methods. Always call methods inside `page.evaluate(() => window.__lhsE2e?.score())`.

### webServer

- Prefer `localhost`, not `127.0.0.1` — Rsbuild often binds IPv6 `localhost` only; ready checks on `127.0.0.1` hang.
- Do not start servers via `vp` inside Playwright `webServer` (EINVAL spawn). Use `exec` + local `nest` / `rsbuild` bins under `apps/*`.
- Omit `gracefulShutdown.signal: "SIGKILL"` — types only allow `SIGINT` | `SIGTERM`; default teardown already SIGKILLs the process group.
- Quote `package#script` if ever invoking through a shell that treats `#` as a comment.

### Scores assertion (cross-layer)

- Snapshot `GET /api/scores` ids **before** the run.
- After end screen, assert a **new** id with `passed: true` and expected `score` — do not `find` any historical perfect score.

## Stability Gotchas

| Symptom | Fix |
| --- | --- |
| `removeChildFromContainer` during E2E | Skip drei `Html` overlays in e2e; unmount SOP highlights for inventoried parts |
| Orbit steals drag | Disable OrbitControls when `isE2eMode()` |
| Canvas black / `__lhsE2e.ready` never true | drei `Environment` still suspends while loading local HDR — wrap in `<Suspense fallback={null}>` and skip Environment when `isE2eMode()` so harness mounts without waiting on IBL. Keep IBL on local `/hdri/` files (no CDN `preset`) |
| Nut install click no-ops | Ensure pointer session engages install-offer nuts and clears lockout |
| Clean steps flaky | Mouse demo uses wash overlay (~3s) then `completeAllCleans` — wait for overlay / chrome, do not hover each clean spot unless testing hand path |

## Tests Required

- Keep `e2e/drag-oil-box.spec.ts` green when changing helpers.
- Full session: `e2e/full-demo-session.spec.ts` — gates + representative spot checks; end screen + new score row.
- Exclude Playwright `e2e/` from rstest include globs.

## Wrong vs Correct

```ts
// Wrong — methods stripped
const api = await page.evaluate(() => window.__lhsE2e);
api.inventory();

// Correct
await page.evaluate(() => window.__lhsE2e?.inventory() ?? []);
```

```ts
// Wrong — may match yesterday's perfect run
scores.find((s) => s.passed && s.score === 100);

// Correct — new id since baseline
const after = await getScores();
expect(after.some((s) => !beforeIds.has(s.id) && s.passed && s.score === 100)).toBe(true);
```
