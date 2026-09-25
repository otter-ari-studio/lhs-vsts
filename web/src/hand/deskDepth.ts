/**
 * Desk-depth model for laptop top-cam training.
 *
 * Browsers cannot measure physical eye/hand-to-screen distance. We assume
 * DESK_TO_SCREEN_METERS (default 1 m) and estimate reach from apparent palm
 * width via a pinhole webcam model.
 */

/** Assumed seating distance to the display / webcam (meters). */
export const DESK_TO_SCREEN_METERS = 1;

/** Approximate palm width (index MCP → pinky MCP), meters. */
export const HAND_PALM_WIDTH_METERS = 0.085;

/** Typical laptop webcam horizontal FOV (degrees). */
export const WEBCAM_HFOV_DEG = 62;

/**
 * How strongly depth changes map into scene Z (1 = 1 m closer → 1 m toward machine).
 * >1 makes “reach toward screen” feel more pronounced in the training volume.
 */
export const DEPTH_REACH_GAIN = 0.9;

/** EMA for palm-width samples (0–1, higher = snappier / noisier). */
export const PALM_WIDTH_EMA = 0.18;

/** Ignore depth deltas smaller than this (meters) before publishing. */
export const DEPTH_DEADZONE_METERS = 0.02;

/** Clamp estimated camera distance (meters). */
export const DEPTH_MIN_METERS = 0.35;
export const DEPTH_MAX_METERS = 1.8;

/** MediaPipe landmark indices: index MCP, pinky MCP. */
export const INDEX_MCP = 5;
export const PINKY_MCP = 17;

export function frameWidthMetersAtDepth(
  depthMeters: number,
  hfovDeg = WEBCAM_HFOV_DEG,
): number {
  const half = Math.tan(((hfovDeg * Math.PI) / 180) / 2);
  return 2 * depthMeters * half;
}

/** Full-frame XY span at the assumed desk distance (capture meters). */
export function deskXySpanMeters(
  deskMeters = DESK_TO_SCREEN_METERS,
  hfovDeg = WEBCAM_HFOV_DEG,
): number {
  return frameWidthMetersAtDepth(deskMeters, hfovDeg);
}

/** Palm width as a fraction of image width (0–1). */
export function palmWidthNorm(
  image: readonly { x: number; y: number; z: number }[],
): number {
  if (image.length <= PINKY_MCP) return 0;
  const a = image[INDEX_MCP];
  const b = image[PINKY_MCP];
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Estimate distance from camera to hand (meters) from apparent palm width.
 * Falls back to deskMeters when the palm is too small / missing.
 */
export function estimateDepthFromPalmNorm(
  palmNorm: number,
  deskMeters = DESK_TO_SCREEN_METERS,
  palmMeters = HAND_PALM_WIDTH_METERS,
  hfovDeg = WEBCAM_HFOV_DEG,
): number {
  if (!(palmNorm > 1e-4)) return deskMeters;
  const frameW = frameWidthMetersAtDepth(1, hfovDeg); // width at 1 m
  // palmNorm ≈ palmMeters / (depth * frameW_at_1m)  → depth ≈ palmMeters / (palmNorm * frameW)
  const depth = palmMeters / (palmNorm * frameW);
  return clamp(depth, DEPTH_MIN_METERS, DEPTH_MAX_METERS);
}

export function applyDepthDeadzone(
  depth: number,
  originDepth: number,
  deadzone = DEPTH_DEADZONE_METERS,
): number {
  const d = depth - originDepth;
  if (Math.abs(d) < deadzone) return originDepth;
  // Soften: shrink by deadzone toward origin so motion starts after threshold.
  return originDepth + (d > 0 ? d - deadzone : d + deadzone);
}

export function ema(prev: number | null, next: number, alpha = PALM_WIDTH_EMA): number {
  if (prev === null || !Number.isFinite(prev)) return next;
  return prev * (1 - alpha) + next * alpha;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
