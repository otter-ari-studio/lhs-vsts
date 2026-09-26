# PRD: Frontend Swiss Minimalism UI

## Goal

用 Minimalism & Swiss Style 统一 `apps/frontend` 视觉：浅色高对比、锐角网格、品牌优先引导页，训练/管理页共用同一套 token。

## Background

- 原 UI 为深色圆角卡片 + 绿色 CTA，与 Swiss / Minimalism 方向不一致。
- 通过 ui-ux-pro-max `--design-system` 对齐风格；字体避开 Inter，采用 Space Grotesk + IBM Plex Sans。
- 实现已在 commit `61ecd55` 落地；本任务负责需求留档、spec 约定与归档。

## Decisions

| ID | Decision |
| -- | -------- |
| D1 | 浅色单色系（白底近黑字）；主 CTA 黑底白字；成功/警告/危险仅用语义色。 |
| D2 | `border-radius: 0`；细线分割；无阴影卡片。 |
| D3 | 引导页品牌名英雄级展示；说明 + 主/次 CTA；下方 `01 \| 02` 双栏网格。 |
| D4 | 3D 视口保持深色；Chrome / 侧栏 / 蒙层跟 Swiss 浅色 chrome。 |
| D5 | 可见 `focus-visible`；尊重 `prefers-reduced-motion`。 |

## Requirements

- **R1** 引导 / 训练 / 管理共用 CSS 变量 token（颜色、字体、间距、焦点、动效）。
- **R2** 引导页符合品牌优先 + 锐角网格，无装饰性圆角卡片。
- **R3** 清洗 overlay 为几何图形，无气泡 skeuomorphism。
- **R4** 既有前端单测与 E2E 选择器不因文案/结构破坏而失败（按钮「进入训练」等保留）。

## Acceptance Criteria

- [x] AC1：`App.css` 提供 Swiss token，全站浅色锐角、可见 focus、reduced-motion。
- [x] AC2：`GuidePage` 品牌英雄 + 双栏编号说明 + 主/次 CTA。
- [x] AC3：`TrainPage` / `AdminPage` chrome 与 token 一致；清洗为几何旋转框。
- [x] AC4：`vp run --filter frontend test` 通过。

## Out of Scope

- 暗色主题切换；引入组件库 / Lucide 图标包
- 像素回归门禁；改动 SOP / 3D 交互逻辑
- 持久化 `design-system/` MASTER.md（可选后续）
