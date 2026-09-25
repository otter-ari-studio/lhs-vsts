# LHS-VSTS — 纯 Web 大家电拆洗训练

浏览器内手部追踪 + Three.js 油烟机拆洗训练。学员打开网页、授权摄像头即可开训，**无需 Python 或本机 WebSocket**。

## 快速开始

```bash
cd web
pnpm install
pnpm run dev
```

打开 http://localhost:3000 。摄像头需要安全上下文（`localhost` 或 HTTPS）。

## 使用流程

1. **引导页**：说明顶摄端坐姿势与摄像头权限 → 进入训练
2. **标定**：双手入画后一键标定（可随时重标定）
3. **训练 SOP**：按步骤条完成 **拆卸 → 清洁示意 → 回装**
   - 拆装：接近高亮、捏合抓取、松手吸附
   - 清洁：手在热点停留约 1.5s，或点「标记已清洁」兜底
4. **结束页**：合格/不合格（必选步骤是否全部完成）+ 得分 + 错因；可再训

过程扣分与乱序 tip 只作反馈，不挡通关；未完成必选步骤则为不合格。

## 验证

```bash
cd web
pnpm run lint
pnpm run test
pnpm run build
```

## 目录

| 路径 | 说明 |
|------|------|
| `web/` | 唯一产品入口（Rsbuild + React 19 + R3F + MediaPipe HandLandmarker） |

### 逻辑与视觉边界

`machine/`（StepGraph / TrainingSession / ScoreBook）只消费 MachineDef 的零件、锚点、prereqs 与清洁点；`visual/` 的 Kitbash / 未来 GLTF 适配器可热替换，无需改步骤逻辑。

> 历史：早期曾用本机 Python MediaPipe + WebSocket 联调，已退役，仓库不再包含该路径。
