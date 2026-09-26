# LHS-VSTS

三维 SOP 训练客户端与评分 API 的 Monorepo。前端（Rsbuild / React / R3F）与后端（NestJS）通过共享包 `@lhs-vsts/machine` 共用机器定义、步骤图与训练会话规则。

[概览](#概览) · [仓库结构](#仓库结构) · [快速开始](#快速开始) · [本地开发](#本地开发) · [前端](#前端) · [后端](#后端) · [离线运行时资源](#离线运行时资源) · [测试与覆盖率](#测试与覆盖率) · [Docker](#docker)

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.18-3c873a?style=flat-square)
![pnpm](https://img.shields.io/badge/pnpm-12.6-f69220?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)
![ari](https://storage.360buyimg.com/store-jddj-pro/otter-ari/built-with-love.svg)

## 概览

本仓库用于鼠标演示路径下的机台拆装 / 清洗训练：学员按 SOP 在 WebGL 场景中完成步骤，结束后写入匿名分数。机器 SOP 与步骤图由 `@lhs-vsts/machine` 定义；JSON 与分数由后端提供；前端负责交互、场景与引导 UI。

| 包 | 职责 |
| --- | --- |
| `apps/frontend` | 训练客户端（Rsbuild / React 19 / Three.js · R3F） |
| `apps/backend` | Nest API：机台定义、匿名训练分数；可托管前端静态资源 |
| `packages/machine` | 共享 `MachineDef` / `StepGraph` / `TrainingSession` |

工具链使用 [Vite+](https://viteplus.dev/guide/)（全局 CLI：`vp`）。`vp <name>` 为内置命令；`vp run <name>` 运行 `package.json` 脚本或 `vite.config.ts` 任务。

## 仓库结构

```text
apps/
  frontend/     # 训练客户端 + Playwright e2e
  backend/      # Nest API + seed 数据
packages/
  machine/      # 共享 SOP / 会话规则
docker/         # 镜像入口脚本
```

## 快速开始

**环境要求**

- Node.js ≥ 22.18
- pnpm 12.6（可通过 Corepack 启用）

```bash
corepack enable
vp install
```

> [!TIP]
> 拉取远程变更后、开始开发前先执行 `vp install`。环境或包管理异常时可运行 `vp env doctor`。

一键自检（格式 / 类型检查 / 测试 / 构建）：

```bash
vp run ready
```

## 本地开发

分别启动 API 与训练端（两个终端）。两个脚本都会先构建 `@lhs-vsts/machine`；前端将 `/api` 代理到后端。

```bash
vp run dev:backend   # http://localhost:3001
vp run dev:frontend  # http://localhost:3000
```

常用根命令：

| 命令 | 说明 |
| --- | --- |
| `vp fmt` / `vp lint` / `vp check` | 格式化、Lint、类型检查 |
| `vp run -r test` | 各包单元测试 |
| `vp run -r build` | 各包构建 |
| `vp run test:e2e:api` | API + 写分 e2e（Vitest，无浏览器） |
| `vp run test:e2e` | Playwright 真实浏览器 e2e |

## 前端

路径：`apps/frontend`。技术栈为 Rsbuild + React 19 + Three.js / R3F（鼠标演示）。机器规则来自 `@lhs-vsts/machine`；机台 JSON 与分数来自后端。

### 模块划分

| 目录 | 职责 |
| --- | --- |
| `src/api/` | 同源 `/api` 客户端与 `loadMachineDef` |
| `src/hand/` | 遗留摄像头 / MediaPipe（训练页未使用） |
| `src/interaction/` | 指针抓取 / 卡扣 / 螺母、库存 |
| `src/visual/` | Kitbash 适配；可换 GLTF，不改动 StepGraph |
| `src/ui/` | 引导、训练、管理、结束页 |
| `src/scene/` | R3F 训练场景 |
| `src/e2e/` | `/?e2e=1` Playwright 辅助 |
| `e2e/` | Playwright 用例 |

> [!IMPORTANT]
> 视觉适配边界：只改 `visual.adapter` / kitbash 实现；`TrainingSession` / `StepGraph` 始终基于 `partId`、锚点与前置条件。

### 包内脚本

| 命令 | 说明 |
| --- | --- |
| `vp run frontend#dev` | 开发服务 |
| `vp run frontend#build` | 生产构建 |
| `vp run frontend#test` | 单元测试（Rstest） |
| `vp run frontend#test:cov` | 覆盖率 |
| `vp run frontend#lint` | Rslint |

## 后端

路径：`apps/backend`。NestJS API，提供机台 SOP 定义与匿名训练分数。共享规则在 `@lhs-vsts/machine`；种子数据在 `data/seed/`。

```bash
vp run dev:backend   # http://localhost:3001
```

| 命令 | 说明 |
| --- | --- |
| `vp run backend#start:dev` | Watch 模式 |
| `vp run backend#build` | 编译 |
| `vp run backend#test` | 单元测试 |
| `vp run backend#test:e2e` | API e2e（Vitest） |
| `vp run backend#test:cov` | 覆盖率 |
| `vp run backend#lint` | Oxlint |

## 离线运行时资源

内网 / Docker 部署时，运行时**不得**请求 Google、jsDelivr、githack 等外网 CDN。相关资源已 vendor 到 `apps/frontend/public/`（构建进入 `dist/`，`build:docker` 会拷贝到后端 `public/`）：

| 路径 | 来源 / 许可说明 |
| --- | --- |
| `/models/hand_landmarker.task` | MediaPipe Hand Landmarker float16（Apache-2.0） |
| `/hdri/empty_warehouse_01_1k.hdr` | pmndrs/drei-assets 仓库 HDR |
| `/mediapipe/*` | `@mediapipe/tasks-vision` WASM（Rsbuild `output.copy` 自 `node_modules`） |

字体使用 `@fontsource/*`（随包构建）。请勿在 `src/` 中为 MediaPipe、IBL 或字体重新引入 CDN URL。

## 测试与覆盖率

### 覆盖率

`machine`、`backend`、`frontend` 行覆盖率须 ≥ 90%（前端门禁覆盖 API 客户端、AdminPage、写分，以及共享三维指针拖拽模块，详见 `apps/frontend/rstest.config.ts`）。

```bash
vp run --filter @lhs-vsts/machine test:cov
vp run backend#test:cov
vp run frontend#test:cov
# 或根目录一次跑完：
vp run -w test:cov
```

### E2E

- **API e2e**（Vitest，无浏览器）：会话写分等。

```bash
vp run test:e2e:api
```

- **浏览器 e2e**（Playwright）：`/?e2e=1` + `window.__lhsE2e` 瞄准，再对 WebGL canvas 做 OS 级鼠标操作。

```bash
vp run test:e2e
```

| Spec | 覆盖内容 |
| --- | --- |
| `drag-oil-box.spec.ts` | 单步：将 `oil_box` 拖入库存 |
| `full-demo-session.spec.ts` | 完整合格路径：拆卸 → 清洗 overlay → 复装 → 结束页 100 + `GET /api/scores` |

首次需安装浏览器：`playwright install`。完整会话超时 ≥ 8 分钟；worker 数保持为 1。

## Docker

将前端构建产物拷入后端静态目录后，由 Nest 统一对外提供服务：

```bash
pnpm run build:docker
pnpm run start:docker
```

镜像相关文件在 `docker/`（`Dockerfile`、`start.sh`）。容器内默认监听 `PORT`（默认 `3000`）。
