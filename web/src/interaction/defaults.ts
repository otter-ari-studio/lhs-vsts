/** Nut pinch dwell before remove/install (ms). */
export const NUT_DWELL_MS = 1200;

/** Default clean dwell when MachineDef omits (should not happen). */
export const DEFAULT_CLEAN_DWELL_MS = 1500;

/** Collider radii by kind (meters) — pick range for pinch start. */
export const COLLIDER_RADIUS = {
  /** Grab pick (install snap still uses part.snapRangeMeters). */
  grabbable: 0.24,
  clip: 0.12,
  rotate_nut: 0.11,
  clean: 0.14,
} as const;

/** pickPriority() for current SOP target — beats non-target removed parts. */
export const SOP_PICK_PRIORITY = 2;
/** Installed non-SOP parts. */
export const INSTALLED_PICK_PRIORITY = 1;
/** Already-removed parts awaiting reinstall (lowest — don't steal detach). */
export const REMOVED_PICK_PRIORITY = 0;
