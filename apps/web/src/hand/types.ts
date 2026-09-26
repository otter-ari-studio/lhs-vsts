/** Shared hand-tracking types (browser HandHub boundary). */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // x, y, z, w

export type HandId = 0 | 1;

export interface HandSample {
  handId: HandId;
  /** Wrist / palm position in capture space (meters), pre-axis-map. */
  position: Vec3;
  rotation: Quat;
  pinching: boolean;
  /** Performance.now() when sample was produced. */
  timestamp: number;
  /** 21 MediaPipe joints in capture space, or null. */
  landmarks: Vec3[] | null;
}

export const JOINT_COUNT = 21;

/** MediaPipe HAND_CONNECTIONS (joint index pairs). */
export const HAND_CONNECTIONS: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17],
] as const;

export const THUMB_TIP = 4;
export const INDEX_TIP = 8;
export const WRIST = 0;
