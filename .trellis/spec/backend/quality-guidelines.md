# Quality Guidelines

> Code quality standards for backend development.

---

## Nest ServeStatic (SPA)

When serving a frontend SPA from Nest with `@nestjs/serve-static` (Nest 12 / path-to-regexp v8):

- **Exclude API with** `exclude: ['/api/{*any}']` — do **not** use `/api*`. The legacy glob throws at runtime and SPA fallback returns 500 for non-file paths.
- Prefer `ServeStaticModule.forRootAsync({ useFactory: () => [{ rootPath, exclude }] })` so `STATIC_ROOT` / cwd resolution runs at app boot (factory must return an **array** of options).
- Assert static + exclude with `NestFactory.create` e2e tests; `Test.createTestingModule` often resolves `NoopLoader` because `HttpAdapterHost` is unset when the loader factory runs.

---

## Overview

(To be filled by the team)

---

## Forbidden Patterns

- ServeStatic `exclude: ['/api*']` under Nest 12 (invalid path-to-regexp v8 pattern)

---

## Required Patterns

- ServeStatic API exclusion: `exclude: ['/api/{*any}']` (or equivalent RegExp)

---

## Testing Requirements

- Health/API controller changes: unit + e2e
- SPA static wiring: NestFactory-based e2e covering `/`, `/api/*`, and SPA fallback

---

## Code Review Checklist

- [ ] Static exclude does not use legacy `/api*` under Nest 12
- [ ] Production CORS skips `enableCors` unless `CORS_ORIGIN` is set
