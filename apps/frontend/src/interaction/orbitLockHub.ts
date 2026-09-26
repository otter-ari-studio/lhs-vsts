/**
 * When true, OrbitControls should ignore pointer so part drag wins.
 */
let locked = false;
const listeners = new Set<() => void>();

export function setOrbitLocked(next: boolean): void {
  if (locked === next) return;
  locked = next;
  for (const fn of listeners) fn();
}

export function isOrbitLocked(): boolean {
  return locked;
}

export function subscribeOrbitLock(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
