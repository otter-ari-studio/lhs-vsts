import type { ScoringConfig } from './types';

export interface FaultEntry {
  key: string;
  reason: string;
  amount: number;
  atMs: number;
}

export interface ScoreBookState {
  score: number;
  faultLog: FaultEntry[];
}

export interface ScoreBook {
  getScore(): number;
  getFaultLog(): readonly FaultEntry[];
  /** Deduct score and append fault. Returns false if cooldown blocked the deduction. */
  deduct(key: string, amount: number, reason: string, nowMs?: number): boolean;
  snapshot(): ScoreBookState;
}

const DEFAULT_COOLDOWN_MS = 1500;

/**
 * Process score + fault log. Deductions never affect `passed` (curriculum).
 */
export function createScoreBook(
  scoring: ScoringConfig,
  options?: { cooldownMs?: number },
): ScoreBook {
  const cooldownMs = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  let score = scoring.baseScore;
  const faultLog: FaultEntry[] = [];
  const lastPenaltyAt = new Map<string, number>();

  return {
    getScore() {
      return score;
    },
    getFaultLog() {
      return faultLog;
    },
    deduct(key, amount, reason, nowMs = performance.now()) {
      const last = lastPenaltyAt.get(key);
      if (last !== undefined && nowMs - last < cooldownMs) {
        return false;
      }
      lastPenaltyAt.set(key, nowMs);
      const applied = Math.max(0, Math.min(amount, score));
      score = Math.max(0, score - amount);
      faultLog.push({ key, reason, amount: applied, atMs: nowMs });
      return true;
    },
    snapshot() {
      return { score, faultLog: faultLog.slice() };
    },
  };
}
