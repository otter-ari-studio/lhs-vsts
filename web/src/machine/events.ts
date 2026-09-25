type TipListener = (msg: string) => void;
type ScoreListener = (score: number) => void;

const tipListeners = new Set<TipListener>();
const scoreListeners = new Set<ScoreListener>();

export function subscribeTips(fn: TipListener): () => void {
  tipListeners.add(fn);
  return () => tipListeners.delete(fn);
}

export function subscribeScore(fn: ScoreListener): () => void {
  scoreListeners.add(fn);
  return () => scoreListeners.delete(fn);
}

export function emitTip(msg: string): void {
  for (const fn of tipListeners) fn(msg);
}

export function emitScore(score: number): void {
  for (const fn of scoreListeners) fn(score);
}
