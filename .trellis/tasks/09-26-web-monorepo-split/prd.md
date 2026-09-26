# PRD: 将 web 拆入 monorepo

## Goal

把训练客户端纳入 pnpm workspace。机型、SOP 和分数归后端保存；浏览器只负责 3D 训练过程，开局拉取机型，结束时提交这一局的成绩。

## Background

- 根 workspace 含 `apps/*`、`packages/*`、`tools/*`。产品代码在 `web/`（包名 `lha-vsts-web`，Rsbuild + React 19 + Three / R3F，自带 lockfile），不在 workspace 内。
- `apps/backend` 是 NestJS `Hello World`，默认端口 3000，与训练客户端冲突。`apps/frontend` 是 Vue 脚手架。`apps/website` 与 `packages/utils` 是模板。
- `web/src/machine/` 不依赖 React 或 Three。训练场景用 `loadMachineDef()` 读取 `public/machines/range_hood_generic.json`，再在浏览器里创建 `TrainingSession`。
- SOP 不是单独文档。步骤由零件的 `removePrereqs` / `installPrereqs`、清洁点 `cleanSpots` 和扣分 `scoring` 推导（`StepGraph.buildStepPrereqs`）。
- 结束页在 `snap.finished || snap.passed` 时出现。成绩目前只在内存里。
- 抓取和步骤判定在每一帧完成，不能改成每次交互请求后端。

## Decisions

| ID  | Decision                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 训练客户端位于 `apps/frontend`（包名 `frontend`；由原 `apps/web` 改名）。                                                          |
| D2  | 机型、SOP、分数的数据归属是 `apps/backend`。本任务做读取、保存配置和写入成绩。                                                     |
| D3  | 纯规则放在 `@lhs-vsts/machine`：类型、`parseMachineDef`、StepGraph、ScoreBook。前后端共用。                                        |
| D4  | `TrainingSession` 仍在浏览器推进。后端不持有这个单例。                                                                             |
| D5  | 不改 `packages/utils`（若仍存在）。                                                                                                |
| D6  | 管理页在 `apps/frontend`（`#admin`）：编辑当前这一份油烟机的 SOP 字段，并列出成绩。无登录。                                        |
| D7  | 成绩不区分学员。每条只有时间、机型、得分、是否合格、错因。                                                                         |
| D8  | 持久化用后端数据目录里的文件，不引入数据库。                                                                                       |
| D9  | 验收必须含端到端链路，且 `@lhs-vsts/machine`、`apps/backend`、`apps/frontend` 行覆盖率各自 ≥ 90%。                                 |
| D10 | 端到端以「API + 会话逻辑 + 管理页/写分」为准；**必须**有自动化 3D 拖拽（按下 → 拖动 → 松手）用例，覆盖可抓零件拆下入栏与回装吸附。 |

## Requirements

- **R1** 前端在 `apps/frontend`，后端在 `apps/backend`。根目录能分别启动二者，端口不冲突。
- **R2** `@lhs-vsts/machine` 被前端和后端以 workspace 依赖引用。领域规则源码不留在前端目录。
- **R3** 训练页的机型定义来自后端，不再来自前端 `public/machines`。
- **R4** 现有 Rstest 通过。拖拽、步骤判定和结束页判定行为不变。
- **R5** 删除旧 `web/` 及其 lockfile。依赖只锁在根 lockfile。
- **R6** 管理页可改并保存当前机型的显示名、步骤前提、清洁点、扣分常量和提示文案。再次进入训练用的是保存后的定义。几何 `kitbashKey` 只能从现有注册表里选。
- **R7** 结束页出现时把该局得分、是否合格、错因写入后端。管理页能看到这些记录。
- **R8** 一条自动化端到端用例覆盖：改机型 → 训练会话用新定义完成一局 → 写分 → 列表可见。
- **R9** `packages/machine`、`apps/backend`、`apps/frontend` 各自行覆盖率 ≥ 90%，有可运行的 coverage 脚本与门禁。

- **R10** 自动化测试必须驱动与训练页相同的指针拖拽会话：在操作面上按下、拖动、松手，完成至少一次可抓零件拆下入栏，以及一次拖回安装位吸附。

## Acceptance Criteria

- [x] AC1：根目录能分别启动 `apps/frontend`（3000）和 `apps/backend`（3001）。
- [x] AC2：`apps/frontend/src` 无 `machine/`；前端 `public/` 无机型 JSON。
- [x] AC3：训练页机型来自后端接口，解析使用 `@lhs-vsts/machine`。
- [x] AC4：现有 Rstest 通过；引导、训练、结束的交互行为不变。
- [x] AC5：`packages/utils` 源码无因本任务改动（若仍存在）。
- [x] AC6：在管理页改前提或扣分并保存后，新开的训练使用新定义。
- [x] AC7：打完一局后，管理页能看到该局的得分、是否合格和错因，且没有学员字段。
- [x] AC8：自动化端到端用例通过（改机型 → 会话完成 → POST 分数 → GET 列表命中），不依赖人工点 3D。
- [x] AC9：`vp run` 覆盖率命令对 machine / backend / frontend 行覆盖率均 ≥ 90%。
- [x] AC10：自动化 3D 拖拽用例通过——油烟机可抓零件经指针会话拆下入栏，并经拖回安装位完成回装（不依赖人工操作浏览器）。

## Out of Scope

- 不拆 interaction、visual、scene、ui、hand。
- 不把前端换成 Vite 或 Vue，不删 Vue 脚手架。
- 不合并 hand 与 machine 的 `Vec3`。
- 不做多机型目录、登录、权限和学员档案。
- 不在管理页里改零件网格或新增 kitbash 几何。
- 不要求 Playwright 驱动完整整局 3D 动画作为唯一 E2E；AC10 的拖拽自动化跑在 Rstest 指针会话上，与 `PointerInteraction` 共用控制器。

## Open Questions

无。
