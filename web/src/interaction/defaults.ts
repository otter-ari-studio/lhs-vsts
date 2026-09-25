/** Nut pinch dwell before remove/install (ms). */
export const NUT_DWELL_MS = 1200;

/** Default clean dwell when MachineDef omits (should not happen). */
export const DEFAULT_CLEAN_DWELL_MS = 1500;

/** Collider radii by kind (meters). */
export const COLLIDER_RADIUS = {
  grabbable: 0.14,
  clip: 0.1,
  rotate_nut: 0.09,
  clean: 0.14,
} as const;
