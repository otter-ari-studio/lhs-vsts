# Design: Intranet offline runtime assets

## Targets

| Current | Replacement |
|---------|-------------|
| `https://storage.googleapis.com/.../hand_landmarker.task` | `/models/hand_landmarker.task` under `apps/frontend/public/models/` |
| `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@…/wasm` | Remove; only `MEDIAPIPE_WASM_LOCAL=/mediapipe` |
| `Environment preset="warehouse"` → raw.githack HDR | `Environment files="…hdr" path="/hdri/"` (or single file URL) from `public/hdri/` |

## Layout

```
apps/frontend/public/
  models/hand_landmarker.task   # vendored MediaPipe float16
  hdri/empty_warehouse_01_1k.hdr  # vendored drei-assets warehouse
```

Rsbuild serves `public/` at site root; `output.copy` already places WASM at `mediapipe/`. `build:docker` copies entire `dist/` → `backend/public`, so `/models/…` and `/hdri/…` ship with SPA.

## Code changes

### `mediapipeLoader.ts`

- `HAND_LANDMARKER_MODEL = "/models/hand_landmarker.task"`
- Remove `MEDIAPIPE_WASM_CDN` (or stop exporting/using)
- `bases = [MEDIAPIPE_WASM_LOCAL]` only
- Update `ensureMediapipeVisionReady` detail string
- Update `hand-tracking.test.ts` / `index.test.tsx`

### `TrainingScene.tsx`

```tsx
<Environment files="empty_warehouse_01_1k.hdr" path="/hdri/" environmentIntensity={0.32} />
```

Keep Suspense + `isE2eMode()` skip.

### Spec

- Extend Playwright or Swiss/frontend guide: no runtime CDN for MediaPipe/IBL
- Optional short note in `apps/frontend/README.md`

## Vendoring procedure (implement)

On a machine that can reach the sources **once**:

```bash
mkdir -p apps/frontend/public/models apps/frontend/public/hdri
curl -L -o apps/frontend/public/models/hand_landmarker.task \
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
curl -L -o apps/frontend/public/hdri/empty_warehouse_01_1k.hdr \
  "https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/empty_warehouse_01_1k.hdr"
```

Commit binaries (Apache-2.0 MediaPipe models / drei-assets license — keep attribution in README snippet if required).

## Rollback

Revert loader + scene; delete `public/models` and `public/hdri`.
