import type { Vec3 } from '@lhs-vsts/machine';

/** Latest world/local group positions for parts (updated by GrabPart etc.). */
const poses = new Map<string, Vec3>();

export function setPartPose(partId: string, position: Vec3): void {
  poses.set(partId, position);
}

export function getPartPose(partId: string): Vec3 | null {
  return poses.get(partId) ?? null;
}

export function clearPartPoses(): void {
  poses.clear();
}
