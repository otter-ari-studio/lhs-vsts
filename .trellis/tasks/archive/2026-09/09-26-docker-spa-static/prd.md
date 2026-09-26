# Docker SPA static serve via Nest

## Goal

生产部署时把前端 Rsbuild 产物拷入后端 `public`，由 Nest 同端口对外提供 SPA 与 `/api/*`；适配现有 `docker/` 骨架，并用根脚本 `build:docker` / `start:docker`（pnpm）完成构建与启动。

## Background

- 前端产物：`apps/frontend/dist/`（含 `mediapipe/` WASM）；API 已用相对路径 `/api/*`。
- 前端 hash 路由（`#train`），适合根路径静态托管。
- 后端无 ServeStatic；`GET /` 为 hello；CORS 仅 `localhost:3000`；默认端口 `3001`。
- 现有 Dockerfile 调用不存在的根 `npm run build/start`；无 `FROM`（平台注入基座）。

## Requirements

- R1. 构建：`@lhs-vsts/machine` → frontend → 拷贝 `apps/frontend/dist` → `apps/backend/public` → nest build。
- R2. Nest 同端口提供 SPA（根路径）与 `/api/*`；静态中间件不得吞掉 API。
- R3. 更新 `docker/Dockerfile` + `docker/start.sh`：`pnpm install` + `pnpm run build:docker` / `start:docker`；保留 sshd/crond 语义。
- R4. SPA 占根路径；静态目录 `apps/backend/public`；hello 改为 `/api/health`（或等价）。
- R5. `PORT` 默认 `3001`；开发 CORS 保留 `http://localhost:3000`；生产同域不强制跨域，可用 `CORS_ORIGIN`。
- R6. 根 `package.json` 提供 `build:docker` / `start:docker`（pnpm 可跑，不依赖全局 `vp`）。
- R7. 本地双进程 `dev:frontend` / `dev:backend` 保持可用，不强制开发期拷贝 public。

## Acceptance Criteria

- [x] AC1. 生产启动后访问根路径加载 SPA（含 JS/CSS/WASM）。 → R1, R2, R4
- [x] AC2. 同端口 `/api/machines`、`/api/scores` 可用，不被静态层拦截。 → R2
- [x] AC3. Dockerfile/`start.sh` 使用 `pnpm run build:docker` / `start:docker`，不再依赖根 `npm run build/start`。 → R3, R6
- [x] AC4. `vp run dev:backend` + `dev:frontend` 仍可本地开发。 → R7
- [x] AC5. `/api/health`（或约定路径）返回健康信息；根路径不再返回纯文本 hello。 → R4
- [x] AC6. `PORT` / `CORS_ORIGIN` 行为符合 R5。 → R5

## Out of Scope

- 独立 nginx / K8s 编排
- History 路由改造
- 更换无 `FROM` 的基座约定
- SPA 子路径挂载
- 容器默认绑 80
- 全局安装 `vp` 作为唯一构建入口

## Decisions

| ID | Decision |
|----|----------|
| D1 | Nest 静态 + 现有 docker 骨架（C） |
| D2 | SPA 占根；`apps/backend/public`；hello → `/api/health` |
| D3 | `PORT` 默认 3001；开发 CORS `:3000`；生产同域 + 可选 `CORS_ORIGIN` |
| D4 | pnpm + 根脚本 `build:docker` / `start:docker`（M） |
