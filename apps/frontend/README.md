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

## Offline runtime assets

Intranet / Docker deployments must not fetch Google, jsDelivr, or githack at runtime. Vendored under `public/` (copied into `dist/` and `build:docker` → backend `public/`):

| Path                              | Source / license note                                                      |
| --------------------------------- | -------------------------------------------------------------------------- |
| `/models/hand_landmarker.task`    | MediaPipe Hand Landmarker float16 (Apache-2.0)                             |
| `/hdri/empty_warehouse_01_1k.hdr` | pmndrs/drei-assets warehouse HDR                                           |
| `/mediapipe/*`                    | `@mediapipe/tasks-vision` WASM (rsbuild `output.copy` from `node_modules`) |

Fonts use `@fontsource/*` (bundled). Do not reintroduce CDN URLs in `src/` for MediaPipe, IBL, or fonts.
