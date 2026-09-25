import type { HandSample } from './protocol';

/** Latest-sample hub (mirrors Unity HandDataHub). */
class HandDataHubImpl {
  private readonly latest: (HandSample | null)[] = [null, null];

  publish(sample: HandSample): void {
    const i = sample.handId === 1 ? 1 : 0;
    this.latest[i] = sample;
  }

  tryGetLatest(handId: number): HandSample | null {
    const i = handId === 1 ? 1 : 0;
    return this.latest[i];
  }

  clear(handId: number): void {
    const i = handId === 1 ? 1 : 0;
    this.latest[i] = null;
  }

  clearAll(): void {
    this.latest[0] = null;
    this.latest[1] = null;
  }
}

export const handDataHub = new HandDataHubImpl();
