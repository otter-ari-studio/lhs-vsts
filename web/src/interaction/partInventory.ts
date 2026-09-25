type Listener = () => void;

/**
 * FIFO inventory of removed grabbable parts (UI list + install source).
 * Enqueue on lateral throw / release; dequeue on successful install.
 */
class PartInventoryImpl {
  private queue: string[] = [];
  private readonly listeners = new Set<Listener>();

  list(): readonly string[] {
    return this.queue;
  }

  has(partId: string): boolean {
    return this.queue.includes(partId);
  }

  /** Append if not already present (FIFO order preserved). */
  enqueue(partId: string): boolean {
    if (this.queue.includes(partId)) return false;
    this.queue.push(partId);
    this.notify();
    return true;
  }

  /** Remove by id (install consumes that part). */
  dequeue(partId: string): boolean {
    const i = this.queue.indexOf(partId);
    if (i < 0) return false;
    this.queue.splice(i, 1);
    this.notify();
    return true;
  }

  clear(): void {
    if (this.queue.length === 0) return;
    this.queue = [];
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const partInventory = new PartInventoryImpl();

/** Off-screen parking while part sits in the inventory list. */
export const INVENTORY_PARK: [number, number, number] = [-2.5, -2.5, -2.5];
