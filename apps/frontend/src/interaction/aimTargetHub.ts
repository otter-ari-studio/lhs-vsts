import type { Vec3 } from "@lhs-vsts/machine";

type Listener = () => void;

export interface AimTarget {
  id: string;
  /** World position of the part collider. */
  position: Vec3;
  /** True when a hand is within pick radius. */
  inRange: boolean;
}

/**
 * Single aim/highlight target shared by HUD, SOP ring, and the guide stem.
 * Written by InteractionRouter; read by HandAimCursor.
 */
class AimTargetHubImpl {
  private current: AimTarget | null = null;
  private readonly listeners = new Set<Listener>();

  get(): AimTarget | null {
    return this.current;
  }

  set(next: AimTarget | null): void {
    const prev = this.current;
    if (
      prev?.id === next?.id &&
      prev?.inRange === next?.inRange &&
      prev?.position[0] === next?.position[0] &&
      prev?.position[1] === next?.position[1] &&
      prev?.position[2] === next?.position[2]
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

export const aimTargetHub = new AimTargetHubImpl();
