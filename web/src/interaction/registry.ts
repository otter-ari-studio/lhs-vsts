import type { Vector3 } from 'three';

export interface HandInteractable {
  readonly id: string;
  readonly interactionRadius: number;
  isInteractableNow(): boolean;
  distanceTo(handPos: Vector3): number;
  onPinchStart(handPos: Vector3, handRot: { x: number; y: number; z: number; w: number }): void;
  onPinchHold(handPos: Vector3, handRot: { x: number; y: number; z: number; w: number }): void;
  onPinchEnd(handPos: Vector3): void;
}

const list: HandInteractable[] = [];

export function registerInteractable(it: HandInteractable): void {
  if (!list.includes(it)) list.push(it);
}

export function unregisterInteractable(it: HandInteractable): void {
  const i = list.indexOf(it);
  if (i >= 0) list.splice(i, 1);
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
