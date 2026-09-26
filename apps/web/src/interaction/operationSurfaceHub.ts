type Listener = () => void;

export interface ActiveSurface {
  /** Scene Z of the active operation face. */
  z: number;
  /** Part ids that own hot zones on this face right now. */
  partIds: readonly string[];
}

const DEFAULT: ActiveSurface = { z: 0.22, partIds: [] };

/**
 * Current SOP operation face — hand interaction points snap to this Z.
 */
class OperationSurfaceHubImpl {
  private current: ActiveSurface = DEFAULT;
  private readonly listeners = new Set<Listener>();

  get(): ActiveSurface {
    return this.current;
  }

  set(next: ActiveSurface): void {
    const prev = this.current;
    const sameIds =
      prev.partIds.length === next.partIds.length &&
      prev.partIds.every((id, i) => id === next.partIds[i]);
    if (prev.z === next.z && sameIds) return;
    this.current = next;
    for (const fn of this.listeners) fn();
  }

  clear(): void {
    this.set(DEFAULT);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const operationSurfaceHub = new OperationSurfaceHubImpl();
