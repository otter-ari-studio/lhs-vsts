# LHS-VSTS Monorepo

Training client (`apps/web`) and API (`apps/backend`) share machine SOP rules via `@lhs-vsts/machine`.

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

- Run the development server (website template):

```bash
vp run dev
```

Training client and API: from the repo root run `vp run dev:backend` (port 3001) and `vp run dev:web` (port 3000). Both scripts build `@lhs-vsts/machine` first. The web app proxies `/api` to the backend.

## Coverage (AC9)

Line coverage must be ≥ 90% for machine, backend, and web (web gate covers API client, AdminPage, score submit, and related pure helpers — see `apps/web/rstest.config.ts` excludes).

```bash
vp run --filter @lhs-vsts/machine test:cov
vp run backend#test:cov
vp run web#test:cov
# or all three from repo root:
vp run -w test:cov
```

## E2E (AC8)

Automated flow without 3D mouse: temp `DATA_DIR` Nest app → PUT machine → drive `TrainingSession` → POST score → GET list.

```bash
vp run -w test:e2e
# equivalent: vp run lhs-vsts#test:e2e
```

This builds `@lhs-vsts/machine` then runs `apps/backend` Vitest e2e (`test/*.e2e-spec.ts`), including `training-flow.e2e-spec.ts`.
