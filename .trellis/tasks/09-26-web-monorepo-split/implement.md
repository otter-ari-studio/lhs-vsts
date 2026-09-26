# Implement: 将 web 拆入 monorepo

## Checklist

1. 创建 `packages/machine`：移入 `web/src/machine/`，去掉 `loadMachineDef.ts`。相对导入改为 `.js` 后缀。`tsc` 输出 `dist`，包名 `@lhs-vsts/machine`。
2. 将其余 `web/` 移到 `apps/web/`。不移动 `pnpm-lock.yaml` 和 `public/machines/`。包名改为 `web`，依赖 `@lhs-vsts/machine`。
3. 机型 JSON 放到 `apps/backend/data/seed/`。`data/runtime/` 写入 `.gitignore`。
4. 后端依赖该包。端口改为 `3001`，开启给 `localhost:3000` 的 CORS。
   - `GET/PUT /api/machines/current`：读 runtime，缺省时从 seed 复制；PUT 先 `parseMachineDef`。
   - `GET/POST /api/scores`：追加无学员字段的成绩。
5. 前端：`/api` 代理到 `3001`。训练开局 GET 机型。结束页出现时 POST 一次成绩。`#admin` 编辑显示名、前提、清洁点、扣分、提示，kitbash 键用现有注册表。同页列出成绩。
6. 原测试里读取 `public/machines/*.json` 的断言改读 seed 文件。machine import 改为包名。
7. 删除 `web/`。根脚本增加 `dev:web`、`dev:backend`。根目录安装，只更新根 lockfile。

## Validation

```bash
vp run --filter @lhs-vsts/machine build
vp run web#test
vp run web#build
vp run backend#test
```

后端测试覆盖：非法机型 JSON 被拒绝；合法 PUT 后 GET 返回新内容；POST 成绩后 GET 能看到，且没有学员字段。

手动：同时启动两端，训练页能加载油烟机；改一处扣分或前提并保存，重新进入训练后生效；结束一局后 `#admin` 出现这条成绩。

`apps/website` 与 `packages/utils` 无 diff。

## Rollback

恢复根 `pnpm-lock.yaml`，再恢复 `web/` 并删除 `apps/web`、`packages/machine` 和后端新增模块。不要在 `apps/web` 生成独立 lockfile。
