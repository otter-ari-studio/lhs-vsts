# LHS-VSTS Backend

NestJS API for machine SOP definitions and anonymous training scores.
Shared rules live in `@lhs-vsts/machine`; seed data under `data/seed/`.

## Run

From the repo root:

```bash
vp run dev:backend   # http://localhost:3001
```

## Scripts

| Command | Purpose |
| --- | --- |
| `vp run backend#start:dev` | Watch mode |
| `vp run backend#build` | Compile |
| `vp run backend#test` | Unit tests |
| `vp run backend#test:e2e` | API e2e (Vitest) |
| `vp run backend#test:cov` | Coverage |
| `vp run backend#lint` | Oxlint |

See the [root README](../../README.md) for monorepo setup, frontend, and Playwright.
