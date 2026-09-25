import type { Vec3 } from '../machine/types';
import { Vector3 } from 'three';

/**
 * Staging tray on the LEFT (away from right-hand work path to clips/filters).
 * Previous right-side tray sat under the dominant hand and caused re-grabs.
 */
export const DROP_TRAY_CENTER: Vec3 = [-0.42, -0.2, 0.45];
export const DROP_TRAY_SIZE: Vec3 = [0.26, 0.012, 0.18];
/** Only used for tip messaging — release always stages to a slot. */
export const DROP_TRAY_SNAP_RADIUS = 0.28;

const SLOT_OFFSETS: Vec3[] = [
  [-0.08, 0.02, -0.04],
  [0, 0.02, -0.04],
  [0.08, 0.02, -0.04],
  [-0.08, 0.02, 0.05],
  [0, 0.02, 0.05],
  [0.08, 0.02, 0.05],
];

let nextSlot = 0;
const occupied = new Map<string, number>();

export function resetDropTraySlots(): void {
  nextSlot = 0;
  occupied.clear();
}

export function claimDropSlot(partId: string): Vec3 {
  const existing = occupied.get(partId);
  const idx = existing ?? nextSlot % SLOT_OFFSETS.length;
  if (existing === undefined) {
    occupied.set(partId, idx);
    nextSlot += 1;
  }
  const off = SLOT_OFFSETS[idx]!;
  return [
    DROP_TRAY_CENTER[0] + off[0],
    DROP_TRAY_CENTER[1] + off[1],
    DROP_TRAY_CENTER[2] + off[2],
  ];
}

export function releaseDropSlot(partId: string): void {
  occupied.delete(partId);
}

export function distanceToDropTray(worldPos: Vector3): number {
  return worldPos.distanceTo(
    new Vector3(DROP_TRAY_CENTER[0], DROP_TRAY_CENTER[1], DROP_TRAY_CENTER[2]),
  );
}
