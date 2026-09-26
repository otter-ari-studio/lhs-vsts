/**
 * Pure dwell accumulator for clean spots / nut pinch-hold.
 * Call tick(inRange, dtMs) each frame; returns true once when dwell completes.
 */
export function createDwellTracker(dwellMs: number): {
  reset(): void;
  /** @returns true on the frame dwell first reaches threshold */
  tick(inRange: boolean, dtMs: number): boolean;
  progress(): number;
  elapsedMs(): number;
} {
  let elapsed = 0;
  let fired = false;

  return {
    reset() {
      elapsed = 0;
      fired = false;
    },
    tick(inRange, dtMs) {
      if (!inRange) {
        elapsed = 0;
        fired = false;
        return false;
      }
      elapsed += dtMs;
      if (!fired && elapsed >= dwellMs) {
        fired = true;
        return true;
      }
      return false;
    },
    progress() {
      if (dwellMs <= 0) return 1;
      return Math.min(1, elapsed / dwellMs);
    },
    elapsedMs() {
      return elapsed;
    },
  };
}

/** Advance dwell and complete when threshold hit. Pure helper for tests. */
export function accumulateDwell(
  elapsedMs: number,
  inRange: boolean,
  dtMs: number,
  dwellMs: number,
): { elapsedMs: number; completed: boolean } {
  if (!inRange) return { elapsedMs: 0, completed: false };
  const next = elapsedMs + dtMs;
  return { elapsedMs: next, completed: next >= dwellMs };
}
