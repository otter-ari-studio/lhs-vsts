import type { Vector3 } from 'three';

export type InteractableKind = 'grabbable' | 'clip' | 'rotate_nut' | 'clean';

export interface HandInteractable {
  readonly id: string;
  readonly kind: InteractableKind;
  readonly interactionRadius: number;
  isInteractableNow(): boolean;
  /** Distance from interaction point (palm / pinch midpoint) to collider. */
  distanceTo(handPos: Vector3): number;
  onPinchStart(handPos: Vector3): void;
  onPinchHold(handPos: Vector3, dtSec: number): void;
  onPinchEnd(handPos: Vector3): void;
  /** Optional hover enter/leave for highlight. */
  onHover?(active: boolean): void;
  /**
   * Higher wins when multiple targets are in range.
   * SOP current target should return ≥ 2 so dropped parts don't steal grabs.
   */
  pickPriority?(): number;
}

const list: HandInteractable[] = [];

export function registerInteractable(it: HandInteractable): void {
  if (!list.includes(it)) list.push(it);
}

export function unregisterInteractable(it: HandInteractable): void {
  const i = list.indexOf(it);
  if (i >= 0) list.splice(i, 1);
}

export function clearInteractables(): void {
  list.length = 0;
}

/**
 * Nearest interactable within its radius.
 * Prefer higher `pickPriority` (SOP targets) so removed oil_box doesn't steal filter_top.
 */
export function findNearestInteractable(handPos: Vector3): HandInteractable | null {
  let best: HandInteractable | null = null;
  let bestPri = Number.NEGATIVE_INFINITY;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const it of list) {
    if (!it.isInteractableNow()) continue;
    const d = it.distanceTo(handPos);
    if (d > it.interactionRadius) continue;
    const pri = it.pickPriority?.() ?? 0;
    if (pri > bestPri || (pri === bestPri && d < bestDist)) {
      bestPri = pri;
      bestDist = d;
      best = it;
    }
  }
  return best;
}

/**
 * Hover with exit hysteresis so the same pose at the radius edge doesn't flicker.
 * Keeps `prev` until outside `interactionRadius * exitScale`, unless a higher-priority
 * target enters its own radius.
 */
export function findHoverTargetSticky(
  handPos: Vector3,
  prev: HandInteractable | null,
  exitScale = 1.45,
): HandInteractable | null {
  if (prev?.isInteractableNow()) {
    const d = prev.distanceTo(handPos);
    if (d <= prev.interactionRadius * exitScale) {
      const challenger = findNearestInteractable(handPos);
      if (!challenger || challenger.id === prev.id) return prev;
      const cPri = challenger.pickPriority?.() ?? 0;
      const pPri = prev.pickPriority?.() ?? 0;
      if (cPri > pPri) return challenger;
      return prev;
    }
  }
  return findNearestInteractable(handPos);
}

/** Nearest among interactables within radius (for hover without pinch). */
export function findHoverTarget(handPos: Vector3): HandInteractable | null {
  return findNearestInteractable(handPos);
}

export function listInteractables(): readonly HandInteractable[] {
  return list;
}
