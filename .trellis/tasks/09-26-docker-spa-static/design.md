# Design: Docker SPA static via Nest

## Architecture

```
[Browser] --:PORT--> Nest
                ├─ /api/*     Controllers (machines, scores, health)
                └─ /*         ServeStatic → apps/backend/public (SPA)
```

Dev (unchanged): browser → :3000 Rsbuild → proxy `/api` → :3001 Nest (no public required).

## Boundaries

| Area | Change |
|------|--------|
| Root `package.json` | Add `build:docker`, `start:docker` (and small helper script if needed) |
| `apps/backend` | `@nestjs/serve-static`, ServeStaticModule, CORS/`PORT`, `/api/health`, remove root hello |
| `apps/backend/public/` | Build artifact sink (gitignored contents + `.gitkeep`) |
| `docker/Dockerfile`, `docker/start.sh` | pnpm install + build:docker / start:docker |
| Frontend source | No route change (already `/api` + hash) |

## Build pipeline (`build:docker`)

1. `pnpm --filter @lhs-vsts/machine build`
2. `pnpm --filter frontend build` (exact package name from workspace)
3. Sync `apps/frontend/dist/` → `apps/backend/public/` (rm + cp; include mediapipe)
4. `pnpm --filter backend build` (nest)
5. Ensure runtime can resolve `public`: either nest-cli assets copy into `dist/public`, or `ServeStatic` root = `join(process.cwd(), 'apps/backend/public')` when cwd is repo root (Docker `/home`).

**Preferred resolve**: `STATIC_ROOT` env override via `ServeStaticModule.forRootAsync` (factory returns options **array**; reads env at app boot). Default `join(process.cwd(), 'apps/backend/public')` so Docker cwd `/home` works without nesting public inside `dist/`. Document that `start:docker` must run with monorepo root as cwd.

## Nest static + API

- `ServeStaticModule.forRoot({ rootPath, exclude: ['/api/{*any}'] })` — Nest 12 / path-to-regexp v8: legacy `/api*` throws and breaks SPA fallback (500)
- Move health to `@Controller('api/health')` or `@Get('api/health')` on a dedicated controller; remove `AppController` `@Get()` hello conflict with SPA index.
- CORS: if `CORS_ORIGIN` set, use it (comma-separated optional); else if `NODE_ENV === 'production'` and no override, skip `enableCors` or reflect same-origin only; else default `http://localhost:3000` for dev.

## Docker

Keep platform shape:

```dockerfile
ADD . /home/
RUN chmod +x /home/docker/start.sh
RUN cd /home/ && corepack enable && pnpm install && pnpm run build:docker
ENTRYPOINT ... sshd && crond && /home/docker/start.sh && sleep ...
```

`start.sh`:

```bash
cd /home/ && pnpm run start:docker
```

`start:docker` → `node apps/backend/dist/main.js` (or package `start:prod` with cwd root). Verify nest ESM entry filename (`main.js`).

Optional `.dockerignore` later — out of MVP if not blocking.

## Compatibility

- Playwright e2e stays on :3000/:3001 split — unaffected.
- Backend unit/e2e tests: update any assertion on `GET /` hello → `/api/health`.

## Rollback

Revert ServeStatic + docker scripts; restore hello controller. Remove `public/` artifacts.
