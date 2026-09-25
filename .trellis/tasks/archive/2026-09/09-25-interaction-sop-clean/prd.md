# PRD: 拆装交互 SOP 清洁与结束页

## Goal

在已有双手追踪 + Kitbash 机型上，完成可训闭环：拆装交互、步骤图、轻量清洁（dwell + UI 兜底）、过程分反馈、结束页合格判定。

## Parent

`.trellis/tasks/09-25-appliance-sim-redesign` — D-pedagogy=通关即合格；D-clean-ux=dwell+UI；螺母首期 dwell 简化。

## Depends on

- `09-25-browser-hand-tracking`（已归档）
- `09-25-kitbash-machine-def`（进行中/即将归档）

## Requirements

- **R1** StepGraph / ScoreBook / faultLog；必选步骤全部完成 → passed；扣分不挡合格。
- **R2** Hover 高亮 + Grab/Snap + Clip toggle + Nut dwell；非法顺序 tip + 扣分。
- **R3** Clean：热点 dwell（默认 ~1.5s）或「标记已清洁」UI → complete `clean_*`。
- **R4** 步骤条、tip、结束页（合格/得分/错因/再训）。
- **R5** 捏合来自 HandHub；交互用掌根/捏合中点距离 + collider。
- **R6** lint/test/build 绿；StepGraph/ScoreBook 纯函数可单测。

## Acceptance Criteria

- [x] AC1：可按 SOP 完成拆→清洁→回装并「合格」。
- [x] AC2：乱序触发 tip/扣分，仍可完成并合格；结束页列出错因。
- [x] AC3：清洁可用停留或 UI 完成。
- [x] AC4：lint/test/build 通过。

## Out of Scope

分数线考核模式、精细螺母旋转手势、删 legacy（harden 子任务）、量产 GLTF。
