export type TipListener = (msg: string) => void;
export type SessionListener = () => void;

const tipListeners = new Set<TipListener>();
const sessionListeners = new Set<SessionListener>();

export function subscribeTips(fn: TipListener): () => void {
  tipListeners.add(fn);
  return () => {
    tipListeners.delete(fn);
  };
}

export function subscribeSession(fn: SessionListener): () => void {
  sessionListeners.add(fn);
  return () => {
    sessionListeners.delete(fn);
  };
}

export function emitTip(msg: string): void {
  for (const fn of tipListeners) fn(msg);
}

export function emitSessionChange(): void {
  for (const fn of sessionListeners) fn();
}
