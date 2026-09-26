# LHS-VSTS Monorepo

Training client (`apps/frontend`) and API (`apps/backend`) share machine SOP rules via `@lhs-vsts/machine`.

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Run the development server (website template, if present):

```bash
vp run dev
```

Training client and API: from the repo root run `vp run dev:backend` (port 3001) and `vp run dev:frontend` (port 3000). Both scripts build `@lhs-vsts/machine` first. The frontend app proxies `/api` to the backend.

## Coverage (AC9)

Line coverage must be ≥ 90% for machine, backend, and frontend (frontend gate covers API client, AdminPage, score submit, and the shared 3D pointer-drag modules — see `apps/frontend/rstest.config.ts`).

```bash
vp run --filter @lhs-vsts/machine test:cov
vp run backend#test:cov
vp run frontend#test:cov
# or all three from repo root:
vp run -w test:cov
```

## E2E and automated 3D drag (AC8 / AC10)

- **AC8** — API + session write-score (Vitest, no browser):

```bash
vp run test:e2e:api
```

- **AC10** — **real browser** (Playwright): `/?e2e=1` + `window.__lhsE2e` aim, then OS mouse on the WebGL canvas.

```bash
vp run test:e2e
# or: vp run frontend#test:e2e
```

Suites under `apps/frontend/e2e/`:

| Spec | What it covers |
| ---- | -------------- |
| `drag-oil-box.spec.ts` | Single-step: drag `oil_box` into inventory |
| `full-demo-session.spec.ts` | Full合格 path: teardown → wash overlay → reinstall → end screen 100 + `GET /api/scores` |

Requires Playwright browsers (`playwright install` once). Full-session timeout is ≥ 8 minutes; workers stay at 1.
