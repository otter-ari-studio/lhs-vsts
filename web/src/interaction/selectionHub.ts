type Listener = () => void;

export interface SelectionInfo {
  id: string;
  displayName: string;
  kind: string;
  /** Short action cue under the name. */
  hint: string;
}

/**
 * Current hand-highlighted (or SOP fallback) part for the right-side HUD.
 */
class SelectionHubImpl {
  private current: SelectionInfo | null = null;
  private readonly listeners = new Set<Listener>();

  get(): SelectionInfo | null {
    return this.current;
  }

  set(next: SelectionInfo | null): void {
    const prev = this.current;
    if (
      prev?.id === next?.id &&
      prev?.hint === next?.hint &&
      prev?.displayName === next?.displayName
    ) {
      return;
    }
    this.current = next;
    for (const fn of this.listeners) fn();
  }

  clear(): void {
    this.set(null);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const selectionHub = new SelectionHubImpl();
