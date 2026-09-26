import { AIM_IN_RANGE_EXIT_SCALE, SHARED_HOVER_STICK_SLACK_M, SOP_PICK_PRIORITY } from "./defaults";
import type { HandInteractable } from "./registry";

export interface SharedHoverCandidate {
  it: HandInteractable;
  /** Distance from that hand's interaction point to the collider. */
  dist: number;
}

/**
 * Merge per-hand hover candidates into one shared winner.
 * Rules: SOP-priority candidates win the pool; otherwise all live candidates.
 * Within the pool, sticky keeps `prev` until a challenger has higher priority
 * or is closer by more than `stickSlackM`.
 */
export function pickSharedHover(
  candidates: SharedHoverCandidate[],
  prev: HandInteractable | null,
  opts?: {
    sopPriority?: number;
    stickSlackM?: number;
  },
): HandInteractable | null {
  const sopPri = opts?.sopPriority ?? SOP_PICK_PRIORITY;
  const slack = opts?.stickSlackM ?? SHARED_HOVER_STICK_SLACK_M;

  const byId = new Map<string, SharedHoverCandidate>();
  for (const c of candidates) {
    if (!c.it.isInteractableNow()) continue;
    const existing = byId.get(c.it.id);
    if (!existing || c.dist < existing.dist) {
      byId.set(c.it.id, c);
    }
  }
  const live = [...byId.values()];
  if (live.length === 0) return null;

  const sopPool = live.filter((c) => (c.it.pickPriority?.() ?? 0) >= sopPri);
  const pool = sopPool.length > 0 ? sopPool : live;

  const best = pickBestInPool(pool);
  if (!best) return null;

  if (prev?.isInteractableNow()) {
    const prevCand = pool.find((c) => c.it.id === prev.id);
    if (prevCand) {
      const pPri = prev.pickPriority?.() ?? 0;
      const bPri = best.it.pickPriority?.() ?? 0;
      if (bPri > pPri) return best.it;
      if (best.it.id === prev.id) return prev;
      if (best.dist + slack < prevCand.dist) return best.it;
      return prev;
    }
  }

  return best.it;
}

function pickBestInPool(pool: SharedHoverCandidate[]): SharedHoverCandidate | null {
  if (pool.length === 0) return null;
  let best = pool[0]!;
  for (let i = 1; i < pool.length; i++) {
    const c = pool[i]!;
    const bPri = best.it.pickPriority?.() ?? 0;
    const cPri = c.it.pickPriority?.() ?? 0;
    if (cPri > bPri || (cPri === bPri && c.dist < best.dist)) {
      best = c;
    }
  }
  return best;
}

/**
 * Enter at `dist <= radius`; exit only past `radius * exitScale`.
 * Mid-band keeps `prevInRange` (pass false when the aim target id changed).
 */
export function resolveAimInRange(
  dist: number,
  radius: number,
  prevInRange: boolean,
  exitScale = AIM_IN_RANGE_EXIT_SCALE,
): boolean {
  if (dist <= radius) return true;
  if (dist > radius * exitScale) return false;
  return prevInRange;
}

/** Distance to a shared candidate by id, or +Infinity if missing. */
export function candidateDist(candidates: SharedHoverCandidate[], id: string): number {
  let best = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    if (c.it.id === id && c.dist < best) best = c.dist;
  }
  return best;
}
