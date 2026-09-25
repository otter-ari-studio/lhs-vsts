import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import type { HandId } from '../hand/types';
import { handWorldHub } from '../hand/handWorldHub';
import { GRAB_COMMIT_MS, TOGGLE_COMMIT_MS } from './defaults';
import {
  findHoverTarget,
  findNearestInteractable,
  type HandInteractable,
} from './registry';

const _pos = new Vector3();

function commitMsFor(it: HandInteractable | null): number {
  if (!it) return GRAB_COMMIT_MS;
  return it.kind === 'grabbable' ? GRAB_COMMIT_MS : TOGGLE_COMMIT_MS;
}

interface HandInteractionState {
  lastPinch: boolean;
  engaged: HandInteractable | null;
  hover: HandInteractable | null;
  /** Candidate chosen on pinch-down; engages only after GRAB_COMMIT_MS. */
  pending: HandInteractable | null;
  pendingMs: number;
}

/**
 * Routes HandWorldHub pinch edges + hover to registered interactables.
 * Grab commits only after a short sustained pinch (avoids “touch = stick”).
 */
export function InteractionRouter() {
  const hands = useRef<HandInteractionState[]>([
    { lastPinch: false, engaged: null, hover: null, pending: null, pendingMs: 0 },
    { lastPinch: false, engaged: null, hover: null, pending: null, pendingMs: 0 },
  ]);

  useFrame((_, delta) => {
    const dt = Math.min(Math.max(delta, 0.0001), 0.05);
    for (const handId of [0, 1] as HandId[]) {
      const pose = handWorldHub.tryGet(handId);
      const state = hands.current[handId]!;
      if (!pose) {
        if (state.hover) {
          state.hover.onHover?.(false);
          state.hover = null;
        }
        if (state.engaged) {
          state.engaged.onPinchEnd(_pos);
          state.engaged = null;
        }
        state.pending = null;
        state.pendingMs = 0;
        state.lastPinch = false;
        continue;
      }

      _pos.set(
        pose.interactionPoint[0],
        pose.interactionPoint[1],
        pose.interactionPoint[2],
      );

      const pinch = pose.pinching;

      // Hover (when not engaged / pending grab)
      if (!state.engaged && !state.pending) {
        const nextHover = findHoverTarget(_pos);
        if (nextHover !== state.hover) {
          state.hover?.onHover?.(false);
          nextHover?.onHover?.(true);
          state.hover = nextHover;
        }
      }

      if (pinch && !state.lastPinch) {
        // Rising edge: arm pending, do not attach yet.
        state.pending = findNearestInteractable(_pos);
        state.pendingMs = 0;
      } else if (pinch && state.pending && !state.engaged) {
        // Must stay near the same target while committing.
        const still = findNearestInteractable(_pos);
        if (!still || still.id !== state.pending.id) {
          state.pending = still;
          state.pendingMs = 0;
        } else {
          state.pendingMs += dt * 1000;
          if (state.pendingMs >= commitMsFor(state.pending)) {
            state.engaged = state.pending;
            state.pending = null;
            state.pendingMs = 0;
            state.hover?.onHover?.(false);
            state.hover = null;
            state.engaged.onPinchStart(_pos);
          }
        }
      } else if (pinch && state.engaged) {
        state.engaged.onPinchHold(_pos, dt);
      } else if (!pinch && state.lastPinch) {
        if (state.engaged) {
          state.engaged.onPinchEnd(_pos);
          state.engaged = null;
        }
        state.pending = null;
        state.pendingMs = 0;
      }
      state.lastPinch = pinch;
    }
  });

  return null;
}
