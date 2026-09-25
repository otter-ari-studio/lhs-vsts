import type { HandId, Vec3 } from './types';

export interface HandRestPose {
  position: Vec3;
  /** degrees around Y */
  eulerY: number;
}

/**
 * Rest poses near the kitbash hood (oil_box / filters around z≈0.2).
 * Farther Z made world-landmark drive look “stuck” below the machine.
 */
export const HAND_DEFAULTS: Record<HandId, HandRestPose> = {
  0: { position: [-0.16, 0.06, 0.4], eulerY: 180 },
  1: { position: [0.16, 0.06, 0.4], eulerY: 180 },
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
export const LANDMARK_MAX_STEP = 0.12;

/**
 * Pinch distance thresholds (meters, world-landmark space after scale).
 * Enter pinch below ON; exit above OFF (hysteresis).
 */
export const PINCH_ON_METERS = 0.035;
export const PINCH_OFF_METERS = 0.055;

/**
 * Image landmarks (x,y ∈ [0,1], z ≈ x-scale) → capture meters before AxisMap.
 * Full frame width ≈ this many meters of desk reach for relative drive.
 *
 * Do NOT drive palm XY from worldLandmarks: those are hand-centered (almost no
 * translation when the user moves their arms).
 */
export const IMAGE_LANDMARK_XY_SPAN_METERS = 0.75;
export const IMAGE_LANDMARK_Z_SPAN_METERS = 0.75;

/** Scale MediaPipe world landmarks (pinch / bone lengths only). */
export const WORLD_LANDMARK_SCALE = 1;
