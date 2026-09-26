import type { HandId, Vec3 } from '../hand/types';

/** World-space hand pose published by RelativeHandDriver for interaction. */
export interface WorldHandPose {
  handId: HandId;
  /** Palm / wrist world position. */
  palm: Vec3;
  /** Pinch midpoint when landmarks available, else palm. */
  interactionPoint: Vec3;
  pinching: boolean;
  /** Clock seconds from R3F when published. */
  clockSec: number;
}

class HandWorldHubImpl {
  private readonly latest: (WorldHandPose | null)[] = [null, null];

  publish(pose: WorldHandPose): void {
    this.latest[pose.handId] = pose;
  }

  tryGet(handId: HandId): WorldHandPose | null {
    return this.latest[handId];
  }

  clear(handId: HandId): void {
    this.latest[handId] = null;
  }

  clearAll(): void {
    this.latest[0] = null;
    this.latest[1] = null;
  }
}

export const handWorldHub = new HandWorldHubImpl();
