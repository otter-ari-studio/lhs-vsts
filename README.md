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

- **AC8** — API + session write-score flow (no browser):

```bash
vp run -w test:e2e
```

- **AC10** — automated 3D drag (press → drag → release) via the same `createPointerDragSession` used by `PointerInteraction`. Covered in `apps/frontend/tests/pointer-drag-3d.test.ts` (runs with `vp run frontend#test`).
