import type { Vec3 } from './protocol';

export interface HandRestPose {
  position: Vec3;
  /** degrees */
  eulerY: number;
}

/** Default rest poses in front of the range hood (Unity VirtualHandDriver). */
export const HAND_DEFAULTS: Record<0 | 1, HandRestPose> = {
  0: { position: [-0.18, -0.05, 0.8], eulerY: 180 },
  1: { position: [0.18, -0.05, 0.8], eulerY: 180 },
};

export const LEFT_HAND_COLOR = '#00ffff';
export const RIGHT_HAND_COLOR = '#ff8c1a';
export const PINCH_COLOR = '#ffee58';

export const PALM_SMOOTH_SPEED = 20;
export const LANDMARK_SMOOTH_SPEED = 18;
export const LANDMARK_STALE_HIDE_DELAY = 0.3;

export const WS_URL = 'ws://127.0.0.1:8765';
