# LHS-VSTS Frontend

Rsbuild + React 19 + Three.js / R3F training client (mouse demo). Machine rules come from `@lhs-vsts/machine`; JSON and scores from `apps/backend`.

Setup and scripts: see the [root README](../../README.md).

```bash
vp run dev:backend   # :3001
vp run dev:frontend  # :3000 — proxies /api
```

## Module layout

| Folder             | Responsibility                                        |
| ------------------ | ----------------------------------------------------- |
| `src/api/`         | Homologous `/api` client and `loadMachineDef`         |
| `src/hand/`        | Legacy camera / MediaPipe (not used on train page)    |
| `src/interaction/` | Pointer grab / clip / nut, inventory                  |
| `src/visual/`      | Kitbash adapter; swap GLTF without touching StepGraph |
| `src/ui/`          | Guide, train, admin, end screens                      |
| `src/scene/`       | R3F training scene                                    |
| `src/e2e/`         | `/?e2e=1` harness for Playwright                      |
| `e2e/`             | Playwright specs                                      |

Visual adapter boundary: change `visual.adapter` / kitbash implementation only; `TrainingSession` / `StepGraph` stay on `partId`, anchors, and prereqs.
