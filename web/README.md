# LHS-VSTS Web

纯浏览器大家电拆洗训练客户端：Rsbuild + React 19 + Three.js / R3F。当前为 **3D 鼠标演示**（拖动旋转视角，点击 / 拖拽零件完成 SOP）。

## Setup

```bash
pnpm install
```

## Dev

```bash
pnpm run dev
```

打开 http://localhost:3000 。

流程：引导页 → 3D 训练（拆 → 清洁 → 回装）→ 结束页。

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm run dev` | 本地开发服务器 |
| `pnpm run build` | 生产构建 |
| `pnpm run preview` | 预览构建产物 |
| `pnpm run lint` | Rslint |
| `pnpm run test` | Rstest 单测 |

## Module layout

| Folder | Responsibility |
|--------|----------------|
| `src/hand/` | 遗留摄像头 / MediaPipe 代码（训练页已不再启用） |
| `src/machine/` | MachineDef、StepGraph、ScoreBook、TrainingSession（与网格无关） |
| `src/interaction/` | 鼠标点击拖拽、grab / clip / nut、物品栏 |
| `src/visual/` | Kitbash 适配器；未来可换 GLTF，不改 StepGraph |
| `src/ui/` | 引导、步骤条、tip、结束页 |
| `src/scene/` | R3F 训练场景 |

### Visual adapter boundary

换零件网格（`visual.adapter: kitbash` → `gltf`）只需改 MachineDef 的 `visual` 字段与适配器实现；`TrainingSession` / `StepGraph` 只认 `partId`、锚点与步骤 prereqs。
