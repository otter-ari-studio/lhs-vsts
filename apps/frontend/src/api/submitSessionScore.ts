import { submitScore, type ScoreFault, type ScoreRecord } from './client';

export interface SubmitSessionScoreArgs {
  sessionId: string;
  /** Mutable ref that remembers which sessionId already submitted successfully. */
  submittedRef: { current: string | null };
  machineId: string;
  score: number;
  passed: boolean;
  faults: ScoreFault[];
  submit?: (input: {
    machineId: string;
    score: number;
    passed: boolean;
    faults: ScoreFault[];
  }) => Promise<ScoreRecord>;
}

/**
 * POST score once per sessionId. On failure, clears the guard so retry is allowed.
 * Returns true when a submit was attempted (and completed without throw from caller path).
 */
export async function submitSessionScoreOnce(
  args: SubmitSessionScoreArgs,
): Promise<boolean> {
  if (args.submittedRef.current === args.sessionId) {
    return false;
  }
  args.submittedRef.current = args.sessionId;
  const post = args.submit ?? submitScore;
  try {
    await post({
      machineId: args.machineId,
      score: args.score,
      passed: args.passed,
      faults: args.faults,
    });
    return true;
  } catch (err) {
    if (args.submittedRef.current === args.sessionId) {
      args.submittedRef.current = null;
    }
    throw err;
  }
}
