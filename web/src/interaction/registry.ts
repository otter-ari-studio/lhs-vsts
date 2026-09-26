import type { Vector3 } from 'three';
import { SOP_PICK_PRIORITY } from './defaults';

export type InteractableKind = 'grabbable' | 'clip' | 'rotate_nut' | 'clean';

export interface HandInteractable {
  readonly id: string;
  readonly kind: InteractableKind;
  readonly interactionRadius: number;
  isInteractableNow(): boolean;
  /** Distance from interaction point (finger-tip centroid) to collider. */
  distanceTo(handPos: Vector3): number;
  /** World-space collider center for aim guides (optional). */
  copyWorldPosition?(out: Vector3): boolean;
  /**
   * Begin pinch engagement. Return `false` to cancel (e.g. order-locked remove)
   * so the router does not keep a dead engage.
   */
  onPinchStart(handPos: Vector3): boolean | void;
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

/** True when any live interactable is the current SOP target. */
export function hasLiveSopTarget(): boolean {
  for (const it of list) {
    if (!it.isInteractableNow()) continue;
    if ((it.pickPriority?.() ?? 0) >= SOP_PICK_PRIORITY) return true;
  }
  return false;
}

/**
 * Nearest interactable within its radius.
 * When a SOP target is in range, ignore lower-priority parts (glass won't steal the clip).
 */
export function findNearestInteractable(handPos: Vector3): HandInteractable | null {
  let sopInRange = false;
  for (const it of list) {
    if (!it.isInteractableNow()) continue;
    if ((it.pickPriority?.() ?? 0) < SOP_PICK_PRIORITY) continue;
    if (it.distanceTo(handPos) <= it.interactionRadius) {
      sopInRange = true;
      break;
    }
  }

  let best: HandInteractable | null = null;
  let bestPri = Number.NEGATIVE_INFINITY;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const it of list) {
    if (!it.isInteractableNow()) continue;
    const pri = it.pickPriority?.() ?? 0;
    if (sopInRange && pri < SOP_PICK_PRIORITY) continue;
    const d = it.distanceTo(handPos);
    if (d > it.interactionRadius) continue;
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
      // Drop non-SOP sticky when a SOP target is in range
      if (cPri > pPri) return challenger;
      if (
        cPri >= SOP_PICK_PRIORITY &&
        pPri < SOP_PICK_PRIORITY &&
        challenger.distanceTo(handPos) <= challenger.interactionRadius
      ) {
        return challenger;
      }
      return prev;
    }
  }
  return findNearestInteractable(handPos);
}

/** Nearest among interactables within radius (for hover without pinch). */
export function findHoverTarget(handPos: Vector3): HandInteractable | null {
  return findNearestInteractable(handPos);
}

/** Live SOP-priority interactables (for aim guide fallback). */
export function listLiveSopTargets(): HandInteractable[] {
  return list.filter(
    (it) =>
      it.isInteractableNow() && (it.pickPriority?.() ?? 0) >= SOP_PICK_PRIORITY,
  );
}

export function listInteractables(): readonly HandInteractable[] {
  return list;
}
