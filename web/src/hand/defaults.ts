import type { HandId, Vec3 } from './types';

export interface HandRestPose {
  position: Vec3;
  /** degrees around Y */
  eulerY: number;
}

/** Default rest poses in front of the range-hood placeholder (Y-up scene). */
export const HAND_DEFAULTS: Record<HandId, HandRestPose> = {
  0: { position: [-0.18, -0.05, 0.8], eulerY: 180 },
  1: { position: [0.18, -0.05, 0.8], eulerY: 180 },
};

export const LEFT_HAND_COLOR = '#00ffff';
export const RIGHT_HAND_COLOR = '#ff8c1a';
export const PINCH_COLOR = '#ffee58';

/** Per-render-frame exponential approach rates (higher = snappier). */
export const PALM_SMOOTH_SPEED = 12;
export const LANDMARK_SMOOTH_SPEED = 14;

/** Keep last sample this long after detect drop (ms). */
export const HAND_HOLD_MS = 400;

/** Hide skeleton this many seconds after last hub update. */
export const LANDMARK_STALE_HIDE_DELAY = 1.4;

/** Clamp landmark jump per new sample (meters). */
export const LANDMARK_MAX_STEP = 0.045;

/**
 * Pinch distance thresholds (meters, world-landmark space after scale).
 * Enter pinch below ON; exit above OFF (hysteresis).
 */
export const PINCH_ON_METERS = 0.035;
export const PINCH_OFF_METERS = 0.055;

/** Scale MediaPipe world landmarks into scene meters (usually ~1). */
export const WORLD_LANDMARK_SCALE = 1;
