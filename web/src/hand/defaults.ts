import type { HandId, Vec3 } from './types';
import { DESK_TO_SCREEN_METERS, deskXySpanMeters } from './deskDepth';

export interface HandRestPose {
  position: Vec3;
  /** degrees around Y */
  eulerY: number;
}

/**
 * Rest poses near the kitbash hood (oil_box / filters around z≈0.2).
 * Calibrate at ~DESK_TO_SCREEN_METERS; reach toward screen decreases scene Z.
 */
export const HAND_DEFAULTS: Record<HandId, HandRestPose> = {
  0: { position: [-0.16, 0.08, 0.38], eulerY: 180 },
  1: { position: [0.16, 0.08, 0.38], eulerY: 180 },
};

export const LEFT_HAND_COLOR = '#00ffff';
export const RIGHT_HAND_COLOR = '#ff8c1a';
export const PINCH_COLOR = '#ffee58';

/**
 * Per-render-frame exponential approach rates (higher = snappier / jitterier).
 * Intentionally lower than early spikes — prefer stability for training.
 */
export const PALM_SMOOTH_SPEED = 5;
export const LANDMARK_SMOOTH_SPEED = 6;

/** Keep last sample this long after detect drop (ms). */
export const HAND_HOLD_MS = 500;

/** Hide skeleton this many seconds after last hub update. */
export const LANDMARK_STALE_HIDE_DELAY = 1.6;

/** Clamp landmark jump per new sample (meters). */
export const LANDMARK_MAX_STEP = 0.035;

/**
 * Pinch distance thresholds (meters, world-landmark space after scale).
 * Enter pinch below ON; exit above OFF (hysteresis). Slightly looser for stability.
 */
export const PINCH_ON_METERS = 0.04;
export const PINCH_OFF_METERS = 0.065;

/**
 * Image XY: full frame ≈ desk FOV width at DESK_TO_SCREEN_METERS.
 * Depth Z comes from palm-size estimation (see deskDepth.ts), not MediaPipe wrist.z
 * (image landmark z is wrist-relative and carries almost no arm reach).
 */
export const IMAGE_LANDMARK_XY_SPAN_METERS = deskXySpanMeters(DESK_TO_SCREEN_METERS);

/** Finger z offsets from image landmarks (wrist-relative), meters scale.
 * Kept small — large values shove fingertips through the hood. */
export const IMAGE_LANDMARK_FINGER_Z_SPAN_METERS = 0.1;

/**
 * Scene Z work slab: keep the glove in front of kitbash parts (oil_box ≈ z0.22–0.29).
 * Grab still works via collider radius without sinking into solids.
 */
export const HAND_Z_MIN = 0.3;
export const HAND_Z_MAX = 0.72;

/** @deprecated use IMAGE_LANDMARK_FINGER_Z_SPAN_METERS — kept for older tests */
export const IMAGE_LANDMARK_Z_SPAN_METERS = IMAGE_LANDMARK_FINGER_Z_SPAN_METERS;

/** Scale MediaPipe world landmarks (pinch / bone lengths only). */
export const WORLD_LANDMARK_SCALE = 1;

/** Re-export desk assumption for UI / docs. */
export { DESK_TO_SCREEN_METERS };
