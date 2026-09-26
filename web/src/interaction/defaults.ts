/** @deprecated Nuts use instant grasp like grabbable; kept for old imports. */
export const NUT_DWELL_MS = 700;

/** Default clean dwell when MachineDef omits (should not happen). */
export const DEFAULT_CLEAN_DWELL_MS = 1500;

/** Collider radii by kind (meters) — hover / aim on the operation surface. */
export const COLLIDER_RADIUS = {
  /** Grab pick (install snap still uses part.snapRangeMeters). */
  grabbable: 0.2,
  /** Clips: tight face hot-zone (large radii auto-fire while hands are just on screen). */
  clip: 0.14,
  /** Keep nut smaller than wheel so after nut-off the impeller wins nearby pinches. */
  rotate_nut: 0.09,
  /** While nut is the SOP target, enlarge pick so top-cam aim can hit. */
  rotate_nut_sop: 0.16,
  clean: 0.14,
} as const;

/** Must hold pinch this long before a grabbable attaches (ms). */
export const GRAB_COMMIT_MS = 160;
/**
 * When the part is already highlighted (hover / SOP), a light squeeze commits fast.
 */
export const HIGHLIGHT_GRAB_COMMIT_MS = 40;
/**
 * Deliberate pause on the hot zone before the action fires.
 * Short values feel like “nothing happened but steps cleared”.
 */
export const REACH_COMMIT_MS = 900;

/**
 * Commit only in the inner fraction of `interactionRadius`.
 * Outer ring = aim/hover guidance; inner = intentional contact.
 */
export const REACH_COMMIT_RADIUS_SCALE = 0.65;

/** @deprecated Prefer REACH_COMMIT_MS — kept for old imports. */
export const SOP_DWELL_COMMIT_MS = REACH_COMMIT_MS;
/** Clips / nuts / cleans commit faster — toggles, not carry. */
export const TOGGLE_COMMIT_MS = 80;

/** Keep pending grab if hand stays within radius * this (avoids neighbor flicker). */
export const PENDING_EXIT_SCALE = 1.5;

/**
 * Shared aim/hover sticky: challenger must be this many meters closer than the
 * current winner before stealing (same priority band). Stops two-hand flicker.
 */
export const SHARED_HOVER_STICK_SLACK_M = 0.05;

/**
 * Exit hysteresis for hover sticky (`findHoverTargetSticky`) and aim `inRange`.
 * Stay until distance > radius * this (enter remains ≤ radius).
 */
export const AIM_IN_RANGE_EXIT_SCALE = 1.45;

/** pickPriority() for current SOP target — beats non-target removed parts. */
export const SOP_PICK_PRIORITY = 2;
/** Installed non-SOP parts. */
export const INSTALLED_PICK_PRIORITY = 1;
/** Already-removed parts awaiting reinstall (lowest — don't steal detach). */
export const REMOVED_PICK_PRIORITY = 0;
