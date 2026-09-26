# Intranet offline runtime assets

## Goal

公司内网 Docker 部署下，训练客户端运行时不访问 Google / jsDelivr / githack 等外网 CDN；手势模型、WASM、场景 HDR 全部走本地静态资源。

## Background

- 字体已改为 `@fontsource` 本地打包（完成）。
- 仍会外网拉取：
  - `HAND_LANDMARKER_MODEL` → `storage.googleapis.com`（`.task`）
  - `MEDIAPIPE_WASM_CDN` → `cdn.jsdelivr.net`（WASM 回退）
  - drei `Environment preset="warehouse"` → `raw.githack.com` HDR
- WASM 本地路径 `/mediapipe` 已由 rsbuild 从 `node_modules` 拷贝；问题在 **CDN 回退 + 模型 URL + HDR preset**。

## Requirements

- R1. Hand Landmarker `.task` 以仓库内静态文件提供（如 `/models/hand_landmarker.task`），运行时 `modelAssetPath` 仅用同源路径。
- R2. MediaPipe WASM **只**使用本地 `/mediapipe`；删除 jsDelivr CDN 回退与相关导出/测试断言。
- R3. 场景 IBL：去掉 `Environment preset="warehouse"` 的外网 HDR；改为本地 HDR（或等价本地 `files`/`path`）；e2e 仍可跳过 Environment。
- R4. 前端生产构建产物 + `build:docker` 拷贝到 `apps/backend/public` 后，上述资源仍可从同域访问。
- R5. 文档/spec 注明：内网运行时零外网依赖（运行时资产层面）。

## Acceptance Criteria

- [ ] AC1. `apps/frontend/src` 中无 `googleapis` / `jsdelivr` / `githack` / `fonts.googleapis` 运行时 URL。
- [ ] AC2. `createHandLandmarker` 仅尝试本地 WASM；模型路径为同源静态文件。
- [ ] AC3. `TrainingScene` Environment 不使用外网 `preset`；本地 HDR（或明确关闭 IBL）在断网下可用。
- [ ] AC4. 相关单元测试更新并通过；`vp check` 通过。
- [ ] AC5. `pnpm run build:docker` 后 `public` 内含模型/HDR（或经 frontend dist 拷贝可见）。

## Out of Scope

- MediaPipe 推理改本地替代方案（仍用 `@mediapipe/tasks-vision`）
- 公司内部 npm/镜像源配置
- Docker 构建期无网（假设构建机能 `pnpm install`；运行时无网）
- 第三方 skill/文档目录里的 Google URL 示例

## Decisions

| ID | Decision |
|----|----------|
| D1 | 完整离线化：`.task` + 去 CDN WASM + 本地 HDR |
| D2 | 二进制提交进仓库 `apps/frontend/public/`（构建可拷到 dist），不依赖运行时/部署机下载外网 |
