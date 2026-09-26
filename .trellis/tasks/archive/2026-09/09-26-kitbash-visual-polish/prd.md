# Kitbash 3D visual polish

## Goal

在不引入 GLTF/写实资产的前提下，把现有侧吸油烟机 Kitbash 训练场景打磨到「可演示的中保真教具」观感，提升结构可信度与零件可识别性。

## Background

- 运行时视觉为程序化 Kitbash（`parts.tsx` + `materials.ts`），非导入模型。
- 场景灯光在 `TrainingScene.tsx`：ambient + hemisphere + directional，阴影 1024；无 Environment/IBL、无后处理。
- `partId` / 锚点 / StepGraph / 交互契约必须保持不变；frontend e2e 验行为不验像素。
- 产品设备假设为笔记本顶摄像头浏览器；历史 PRD 将正式 GLTF 热换与手机优化划为后续。

## Requirements

- R1. 仅改 Kitbash 与场景呈现层；不新增 `.glb`/`.gltf`，不实现 `adapter: "gltf"` 运行时。
- R2. 保持 `partId`、锚点、Grab/Clip/Nut 交互与 SOP 高亮可用；不得破坏 e2e 拖拽流程。
- R3. 材质继续集中在共享 `MAT`（可扩展），避免零件内魔法色值扩散。
- R4. **均衡小步**：灯光/场景、材质、几何三面都做高杠杆改动；任一面不做深度重做。
- R5. 观感档位 = **清晰教具**：结构清楚、零件可辨；可读性优先于炫技。
- R6. 性能预算 = **笔记本友好**：允许 drei 轻量 `Environment` preset；阴影保持 1024 或最多升到 2048；禁止 EffectComposer / bloom 等后处理栈。

## Acceptance Criteria

- [x] AC1. 默认训练视角下，机壳与主要可拆零件一眼可识别为侧吸油烟机结构。 → R4, R5
- [x] AC2. 仓库无新增外部 3D 资产；视觉层仍为程序化 Kitbash。 → R1
- [x] AC3. `apps/frontend` 现有 e2e（拖拽 / SOP 相关）通过。 → R2
- [x] AC4. 灯光/场景、材质、`parts.tsx` 几何三面均有相对 baseline 的可观察提升。 → R4
- [x] AC5. 默认机位无明显 bloom/过曝；金属与塑料区分明确。 → R5, R6
- [x] AC6. 未引入后处理 composer；若使用 Environment，仅为轻量 preset 且不阻塞首屏交互。 → R6

## Out of Scope

- 写实 GLTF/GLB 与 `GltfAdapter`
- Admin 网格编辑 / 换模 UI
- 改 StepGraph、MachineDef 锚点语义、后端 seed 业务步骤
- LandmarkRig 写实化
- 单面深度重做（全面倒角系统、PBR 贴图流水线、重度后处理）
- 产品展示档（bloom、营销 tone-mapping、秀场级 IBL）
- 手机 / 平板 / 低端 GPU 专项优化

## Decisions

| ID | Decision |
|----|----------|
| D1 | Kitbash only（不做 GLTF 路径） |
| D2 | 打磨重心 = 均衡小步（灯光 + 材质 + 几何） |
| D3 | 观感 = 清晰教具（T） |
| D4 | 性能 = 笔记本友好（L）：轻量 Environment 可上；阴影 ≤2048；无后处理 |
