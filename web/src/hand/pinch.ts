/**
 * Pinch hysteresis (Schmitt trigger) — pure, camera-free.
 *
 * Enter pinch when distance ≤ onThreshold; exit when distance ≥ offThreshold.
 * Requires onThreshold < offThreshold.
 */
export function updatePinchState(
  wasPinching: boolean,
  distanceMeters: number,
  onThreshold: number,
  offThreshold: number,
): boolean {
  if (onThreshold >= offThreshold) {
    return distanceMeters <= onThreshold;
  }
  if (wasPinching) {
    return distanceMeters < offThreshold;
  }
  return distanceMeters <= onThreshold;
}

/** Euclidean distance between two 3D points. */
export function distance3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
