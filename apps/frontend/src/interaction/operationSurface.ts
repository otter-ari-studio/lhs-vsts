/**
 * Operation-surface model for laptop top-cam SOP training.
 *
 * Hands only reliably provide screen XY. Interaction happens on discrete
 * depth layers of the appliance face — not in free 3D space.
 */

export type SurfaceLayer = "front" | "mid" | "deep";

/** Scene Z for each face layer (range-hood kitbash anchors). */
export const SURFACE_LAYER_Z: Record<SurfaceLayer, number> = {
  /** Clips, oil box, panel front */
  front: 0.22,
  /** Filters, nut */
  mid: 0.16,
  /** Wheel / deep cover */
  deep: 0.1,
};

export function layerForPartZ(partZ: number): SurfaceLayer {
  const front = SURFACE_LAYER_Z.front;
  const mid = SURFACE_LAYER_Z.mid;
  const deep = SURFACE_LAYER_Z.deep;
  const dFront = Math.abs(partZ - front);
  const dMid = Math.abs(partZ - mid);
  const dDeep = Math.abs(partZ - deep);
  if (dFront <= dMid && dFront <= dDeep) return "front";
  if (dMid <= dDeep) return "mid";
  return "deep";
}

export function layerZ(layer: SurfaceLayer): number {
  return SURFACE_LAYER_Z[layer];
}

/** Snap a free hand point onto the active face layer (keep XY, lock Z). */
export function projectToSurface(
  handXy: readonly [number, number, number],
  surfaceZ: number,
): [number, number, number] {
  return [handXy[0], handXy[1], surfaceZ];
}

/**
 * Distance on the operation surface: XY dominates; residual Z is down-weighted
 * so leftover depth noise cannot steal hits.
 */
export function surfaceDistance(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  zWeight = 0.15,
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = (a[2] - b[2]) * zWeight;
  return Math.hypot(dx, dy, dz);
}

/** Pick surface Z from one or more SOP part anchor Z values. */
export function surfaceZFromPartAnchors(partZs: readonly number[]): number {
  if (partZs.length === 0) return SURFACE_LAYER_Z.front;
  let sum = 0;
  for (const z of partZs) sum += layerZ(layerForPartZ(z));
  return sum / partZs.length;
}
