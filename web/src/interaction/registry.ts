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

export function findNearestInteractable(handPos: Vector3): HandInteractable | null {
  let best: HandInteractable | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const it of list) {
    if (!it.isInteractableNow()) continue;
    const d = it.distanceTo(handPos);
    if (d <= it.interactionRadius && d < bestDist) {
      bestDist = d;
      best = it;
    }
  }
  return best;
}

/** Nearest among interactables within radius (for hover without pinch). */
export function findHoverTarget(handPos: Vector3): HandInteractable | null {
  return findNearestInteractable(handPos);
}

export function listInteractables(): readonly HandInteractable[] {
  return list;
}
