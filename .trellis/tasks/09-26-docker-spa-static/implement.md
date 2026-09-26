# Implement: Docker SPA static via Nest

## Checklist

1. Add `@nestjs/serve-static`; wire `ServeStaticModule` with `exclude: ['/api*']`; resolve `public` via cwd/STATIC_ROOT.
2. Replace root hello with `/api/health`; adjust CORS/`PORT` per D3.
3. Root scripts: `build:docker` (machine → frontend → sync public → backend), `start:docker`.
4. `apps/backend/public/.gitkeep` + gitignore built assets under `public/` (keep `.gitkeep`).
5. Update `docker/Dockerfile` + `docker/start.sh` for pnpm + scripts.
6. Fix backend tests that expect `GET /` hello.
7. Validate: `vp check` / backend tests; smoke `pnpm run build:docker` if environment allows.

## Validation

```bash
pnpm run build:docker          # or via packageManager after install
pnpm run start:docker          # hit / and /api/health /api/machines/current
vp check
vp run backend#test            # exact script per workspace
```

## Risky files

| File | Risk |
|------|------|
| `app.module.ts` / ServeStatic order | `/api` swallowed if exclude wrong |
| `main.ts` CORS | Breaks local frontend :3000 |
| `start:docker` cwd | Wrong `public` path → 404 SPA |
| Dockerfile `corepack`/`pnpm` | Base image may lack Node 22 — document assumption |

## Ready-for-start gate

- [x] `prd.md` converged
- [x] `design.md` + `implement.md`
- [x] jsonl curated
- [ ] User review / approve `task.py start`
