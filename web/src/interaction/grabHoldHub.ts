type Listener = () => void;

const holding = new Set<string>();
const listeners = new Set<Listener>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function setGrabHolding(partId: string, holdingNow: boolean): void {
  if (holdingNow) holding.add(partId);
  else holding.delete(partId);
  notify();
}

export function getGrabHoldCount(): number {
  return holding.size;
}

export function resetGrabHold(): void {
  holding.clear();
  notify();
}

export function subscribeGrabHold(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
