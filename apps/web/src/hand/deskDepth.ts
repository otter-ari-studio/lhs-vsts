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
 * How strongly palm-size change maps into scene Z.
 * Used by palm-ratio reach (not absolute meter depth).
 */
export const DEPTH_REACH_GAIN = 0.9;

/**
 * Palm-ratio reach: at calibrate palm=1.
 * scale ≥ 1 + PALM_CLOSER_SPAN → full reach toward parts (HAND_Z_NEAR).
 * scale ≤ 1 - PALM_FARTHER_SPAN → full pull-back (HAND_Z_FAR).
 *
 * Tuned from capture 2026-09-25: left hand only grew ~+20% palm vs origin,
 * so span 0.32 never hit NEAR. ~0.18 matches natural forward reach.
 */
export const PALM_CLOSER_SPAN = 0.18;
export const PALM_FARTHER_SPAN = 0.18;

/** EMA for palm-width samples (0–1, higher = snappier / noisier). */
export const PALM_WIDTH_EMA = 0.4;

/** Ignore tiny palm-ratio jitter around 1.0 before applying reach. */
export const PALM_RATIO_DEADZONE = 0.02;

/**
 * Accumulate palm samples this long before locking origin (avoids first-frame lock
 * when one hand is already closer — left origin was 0.157 vs median ~0.137).
 */
export const PALM_ORIGIN_SAMPLE_MS = 450;
export const PALM_ORIGIN_MIN_SAMPLES = 8;

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
  deadzone = 0.02,
): number {
  const d = depth - originDepth;
  if (Math.abs(d) < deadzone) return originDepth;
  return originDepth + (d > 0 ? d - deadzone : d + deadzone);
}

/**
 * Map current/calibrate palm width → scene Z.
 * Larger palm (reach toward screen) → smaller Z (toward hood parts).
 */
export function palmRatioToSceneZ(
  palmNorm: number,
  originPalmNorm: number,
  nearZ: number,
  centerZ: number,
  farZ: number,
  closerSpan = PALM_CLOSER_SPAN,
  fartherSpan = PALM_FARTHER_SPAN,
  deadzone = PALM_RATIO_DEADZONE,
): number {
  if (!(originPalmNorm > 1e-5) || !(palmNorm > 1e-5)) return centerZ;
  let ratio = palmNorm / originPalmNorm;
  if (Math.abs(ratio - 1) < deadzone) return centerZ;
  // Soften past deadzone so motion starts cleanly.
  if (ratio > 1) ratio = 1 + (ratio - 1 - deadzone);
  else ratio = 1 - (1 - ratio - deadzone);

  if (ratio >= 1) {
    const u = Math.min(1, (ratio - 1) / Math.max(closerSpan, 1e-4));
    return centerZ + (nearZ - centerZ) * u;
  }
  const u = Math.min(1, (1 - ratio) / Math.max(fartherSpan, 1e-4));
  return centerZ + (farZ - centerZ) * u;
}

export function ema(prev: number | null, next: number, alpha = PALM_WIDTH_EMA): number {
  if (prev === null || !Number.isFinite(prev)) return next;
  return prev * (1 - alpha) + next * alpha;
}

/** Median of a non-empty number list (used for palm-origin lock). */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
