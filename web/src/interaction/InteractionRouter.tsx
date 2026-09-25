import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import type { HandId } from '../hand/types';
import { handWorldHub } from '../hand/handWorldHub';
import {
  findHoverTarget,
  findNearestInteractable,
  type HandInteractable,
} from './registry';

const _pos = new Vector3();

interface HandInteractionState {
  lastPinch: boolean;
  engaged: HandInteractable | null;
  hover: HandInteractable | null;
}

/**
 * Routes HandWorldHub pinch edges + hover to registered interactables.
 * Mount once inside the R3F canvas (not per-hand).
 */
export function InteractionRouter() {
  const hands = useRef<HandInteractionState[]>([
    { lastPinch: false, engaged: null, hover: null },
    { lastPinch: false, engaged: null, hover: null },
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
        continue;
      }

      _pos.set(
        pose.interactionPoint[0],
        pose.interactionPoint[1],
        pose.interactionPoint[2],
      );

      const pinch = pose.pinching;

      // Hover (when not engaged on pinch)
      if (!state.engaged) {
        const nextHover = findHoverTarget(_pos);
        if (nextHover !== state.hover) {
          state.hover?.onHover?.(false);
          nextHover?.onHover?.(true);
          state.hover = nextHover;
        }
      }

      if (pinch && !state.lastPinch) {
        state.engaged = findNearestInteractable(_pos);
        state.engaged?.onPinchStart(_pos);
      } else if (pinch && state.lastPinch && state.engaged) {
        state.engaged.onPinchHold(_pos, dt);
      } else if (!pinch && state.lastPinch) {
        state.engaged?.onPinchEnd(_pos);
        state.engaged = null;
      }
      state.lastPinch = pinch;
    }
  });

  return null;
}
