# Design: Kitbash 3D visual polish

## Architecture / Boundaries

| Layer | Touch? | Notes |
|-------|--------|-------|
| `TrainingScene.tsx` | Yes | Lighting, floor/backdrop, optional `Environment`, canvas tone hints |
| `materials.ts` | Yes | Shared `MAT` presets only |
| `kitbash/parts.tsx` | Yes | High-leverage silhouette / segmentation; keep group origins |
| `MachineView` / Grab/Clip/Nut | No (unless shadow flags only) | Interaction + part roots stay stable |
| `packages/machine`, backend seed | No | Anchors / StepGraph unchanged |
| New GLTF adapter / assets | No | Out of scope |

Contract: visual polish is a **presentation-only** change behind existing Kitbash keys. World-space part roots and grab handles must not drift.

## Data flow

Unchanged: `GET /api/machines/current` → `MachineDef` → `MachineView` → Kitbash registry → meshes.

Polish does not alter MachineDef JSON or visual adapter selection.

## Planned changes (balanced)

### 1. Scene / lighting (`TrainingScene.tsx`)

- Rebalance ambient / hemisphere / key so metal reads without washing plastic.
- Tighten directional shadow frustum to machine AABB (reduce peter-panning / soft mush).
- Optional: `@react-three/drei` `Environment` with a **studio/warehouse-style preset** (no custom HDR files in-repo if preset suffices).
- Floor / backdrop: subtle value separation so chassis edge reads; keep dark training mood.
- Canvas `gl`: keep antialias; optional `toneMappingExposure` nudge only — no EffectComposer.

### 2. Materials (`materials.ts`)

- Tune metal vs plastic metalness/roughness contrast for teaching readability.
- Glass: keep transparent but reduce “flat cyan blob” (slightly higher roughness or clearer rim via dark frame in parts).
- Prefer extending `MAT` keys over inline hex in parts; allow 1–2 justified local overrides (e.g. wind cover emissive already present).

### 3. Geometry (`parts.tsx`)

High-leverage only (not a full remodel):

- `ShellMainKitbash`: stronger side-suction face / chimney read (extra bevel strips or canopy lip).
- Filters / oil box / clips: slight frame or handle emphasis so detachables scan faster.
- Impeller / wind cover: leave topology strategy (cyl + blades) unless a cheap segment bump helps ID.
- **Do not** change mesh local offsets that encode mount pose relative to anchors.

## Compatibility

- E2E: behavior/DOM/`__lhsE2e` only — color/light changes safe.
- SOP `Html` overlays: ensure Environment brightness does not crush highlight contrast; if needed, keep highlight materials emissive as today.
- Bundle: drei already depended; Environment preset may pull small CDN/runtime assets — prefer bundled preset path drei documents; avoid large custom HDR in `public/`.

## Trade-offs

| Choice | Pros | Cons |
|--------|------|------|
| Environment preset | Cheap metal readability | Slight GPU + load; need fallback if offline CDN fails (prefer drei default that packs or document offline risk) |
| Shadow 1024→2048 | Cleaner contact | Cost; default stay 1024 unless soft shadows look bad after light rebalance |
| More box segments | Better silhouette | Clutter / draw calls — cap additions |

## Rollback

Revert the three files above (or git revert the polish commit). No schema migration.
