/**
 * Detect a lateral "throw" from recent hand X samples.
 * Left or right both count — used to auto-enqueue into the inventory list.
 */

export const THROW_LATERAL_SPEED = 0.45; // m/s
/** Absolute Δx over the sample window also counts as a toss. */
export const THROW_LATERAL_DELTA = 0.07; // meters

export interface ThrowSample {
  t: number;
  x: number;
}

const MAX_SAMPLES = 12;

export function pushThrowSample(buf: ThrowSample[], t: number, x: number): void {
  buf.push({ t, x });
  while (buf.length > MAX_SAMPLES) buf.shift();
}

export type ThrowDir = "left" | "right" | null;

/**
 * Returns throw direction if recent lateral motion is strong enough.
 */
export function detectLateralThrow(buf: readonly ThrowSample[]): ThrowDir {
  if (buf.length < 3) return null;
  const newest = buf[buf.length - 1]!;
  const oldest = buf[0]!;
  const dt = (newest.t - oldest.t) / 1000;
  if (dt < 0.04) return null;
  const dx = newest.x - oldest.x;
  const speed = dx / dt;
  if (Math.abs(speed) >= THROW_LATERAL_SPEED || Math.abs(dx) >= THROW_LATERAL_DELTA) {
    return dx < 0 ? "left" : "right";
  }
  return null;
}
