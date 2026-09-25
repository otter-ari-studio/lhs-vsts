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

/**
 * Per-render-frame exponential approach rates (higher = snappier).
 * Tuned lower than Unity defaults for less jitter on ~30Hz WS.
 */
export const PALM_SMOOTH_SPEED = 10;
export const LANDMARK_SMOOTH_SPEED = 12;

/** Keep showing last skeleton this long after samples stop updating. */
export const LANDMARK_STALE_HIDE_DELAY = 1.4;

/** Clamp landmark jump per new sample (meters) to kill MediaPipe spikes. */
export const LANDMARK_MAX_STEP = 0.045;

export const WS_URL = 'ws://127.0.0.1:8765';
