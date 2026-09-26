# Design: 将 web 拆入 monorepo

## Boundaries

```
apps/web (#guide #train #admin)     packages/machine
  场景 / 交互 / 视觉 / 手部            MachineDef、parseMachineDef
  TrainingSession（浏览器）            StepGraph、ScoreBook
  管理页：SOP 表单、成绩列表            无 React / Three，tsc 产出 dist
        |  /api/*                              ^
        v                                      | workspace:*
apps/backend :3001
  GET/PUT /api/machines/current
  GET/POST /api/scores
  data/seed（提交） + data/runtime（本地，gitignore）
```

开局：`GET /api/machines/current` → `parseMachineDef` → `new TrainingSession(def)`。之后的抓取和步骤判定只走本地会话。

结束：`snap.finished || snap.passed` 时 POST 一次。重复渲染不重复提交。

管理页保存：PUT 整份 MachineDef。服务端用 `parseMachineDef` 拒绝非法文档。`kitbashKey` 的可选值由前端 `listKitbashKeys()` 限制；服务端不引用 React 组件。

`getTrainingSession()` 只留在浏览器。后端只调用包里的纯函数。

## Persistence

- `apps/backend/data/seed/range_hood_generic.json`：现有机型文件，入库。
- 首次读取时若 `data/runtime/machine.json` 不存在，从 seed 复制。PUT 写 runtime。
- `data/runtime/scores.json`：数组追加。不存在则从 `[]` 开始。
- `data/runtime/` 不提交。成绩和配置修改留在本机。

成绩记录：

```ts
{
  id: string;
  machineId: string;
  score: number;
  passed: boolean;
  faults: {
    key: string;
    reason: string;
    amount: number;
  }
  [];
  finishedAt: string;
}
```

无姓名、无账号。

## Package contract

`@lhs-vsts/machine` 用 TypeScript 6 编译到 `dist`（与 web、backend 一致，不用根 catalog 的 TypeScript 7）。`exports` 指向 `dist/index.js` 和声明文件。

包内相对导入写成 Node 能解析的 `.js` 后缀，这样 Nest 的 `nodenext` 可以直接加载 `dist`。Rsbuild 同样认这种写法。

`loadMachineDef` 不放进包。它依赖具体的 `/api` 地址，留在 `apps/web`。

## HTTP

后端端口 `3001`，并允许 `http://localhost:3000`。前端只请求同源 `/api/*`。Rsbuild dev / preview 把 `/api` 代理到 `3001`。

根 `dev` 仍启动 website。另加 `dev:web` 与 `dev:backend`。

## Coverage and E2E (AC8–AC10)

- Line coverage ≥ 90% for `@lhs-vsts/machine`, `apps/backend`, and `apps/frontend` (frontend may exclude pure R3F mesh files; must include API client, AdminPage, and score submit).
- AC8 E2E = Nest + TrainingSession + scores API (Vitest).
- AC10 E2E = Playwright real-browser canvas drag (`/?e2e=1`, `window.__lhsE2e`).

## Trade-offs

- 规则进共享包、文档进后端文件：改 SOP 不用复制 StepGraph，拖拽也不跟着网络走。
- 文件而不是数据库：单机型、单机成绩够用。换数据库要改后端仓储，不改包的类型。
- 管理页放在训练应用里：少一个前端。Vue 脚手架继续空着。
- 无登录：本机打开 `#admin` 就能改机型和看成绩。
