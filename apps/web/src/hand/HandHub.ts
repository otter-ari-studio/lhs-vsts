import type { HandId, HandSample } from './types';

/**
 * Latest-sample hub for L/R hands.
 * HandTracker publishes; RelativeHandDriver / interaction consume.
 */
class HandHubImpl {
  private readonly latest: (HandSample | null)[] = [null, null];
  private readonly listeners = new Set<() => void>();

  publish(sample: HandSample): void {
    this.latest[sample.handId] = sample;
    this.notify();
  }

  tryGetLatest(handId: HandId): HandSample | null {
    return this.latest[handId];
  }

  clear(handId: HandId): void {
    if (this.latest[handId] === null) return;
    this.latest[handId] = null;
    this.notify();
  }

  clearAll(): void {
    if (this.latest[0] === null && this.latest[1] === null) return;
    this.latest[0] = null;
    this.latest[1] = null;
    this.notify();
  }

  /** True when at least one hand has a fresh sample. */
  hasAny(): boolean {
    return this.latest[0] !== null || this.latest[1] !== null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const handHub = new HandHubImpl();

/** @deprecated alias — prefer handHub */
export const handDataHub = handHub;
