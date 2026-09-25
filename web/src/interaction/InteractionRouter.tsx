import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import type { HandId } from '../hand/types';
import { handWorldHub } from '../hand/handWorldHub';
import { GRAB_COMMIT_MS, TOGGLE_COMMIT_MS } from './defaults';
import {
  findHoverTargetSticky,
  findNearestInteractable,
  type HandInteractable,
} from './registry';

const _pos = new Vector3();
const _hoverPos = new Vector3();

function commitMsFor(it: HandInteractable | null): number {
  if (!it) return GRAB_COMMIT_MS;
  if (it.id.endsWith(':install-slot')) return TOGGLE_COMMIT_MS;
  return it.kind === 'grabbable' ? GRAB_COMMIT_MS : TOGGLE_COMMIT_MS;
}

interface HandInteractionState {
  lastPinch: boolean;
  engaged: HandInteractable | null;
  /** Per-hand sticky candidate (not directly driving onHover). */
  hoverCand: HandInteractable | null;
  pending: HandInteractable | null;
  pendingMs: number;
}

/**
 * Routes HandWorldHub pinch edges + hover to registered interactables.
 * Grab commits only after a short sustained pinch (avoids “touch = stick”).
 * Hover is aggregated across both hands so one hand leaving doesn't clear the other.
 */
export function InteractionRouter() {
  const hands = useRef<HandInteractionState[]>([
    { lastPinch: false, engaged: null, hoverCand: null, pending: null, pendingMs: 0 },
    { lastPinch: false, engaged: null, hoverCand: null, pending: null, pendingMs: 0 },
  ]);
  const globalHover = useRef<HandInteractable | null>(null);

  useFrame((_, delta) => {
    const dt = Math.min(Math.max(delta, 0.0001), 0.05);

    for (const handId of [0, 1] as HandId[]) {
      const pose = handWorldHub.tryGet(handId);
      const state = hands.current[handId]!;
      if (!pose) {
        state.hoverCand = null;
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

      if (!state.engaged && !state.pending) {
        state.hoverCand = findHoverTargetSticky(_pos, state.hoverCand);
      } else {
        state.hoverCand = null;
      }

      if (pinch && !state.lastPinch) {
        state.pending = findNearestInteractable(_pos);
        state.pendingMs = 0;
      } else if (pinch && state.pending && !state.engaged) {
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
            state.hoverCand = null;
            state.engaged.onPinchStart(_pos);
          }
        }
      } else if (pinch && state.engaged) {
        if (!state.engaged.isInteractableNow()) {
          state.engaged.onPinchEnd(_pos);
          state.engaged = null;
          state.pending = findNearestInteractable(_pos);
          state.pendingMs = 0;
        } else {
          state.engaged.onPinchHold(_pos, dt);
        }
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

    // Aggregate hover: prefer higher pickPriority, then closer hand tip.
    let best: HandInteractable | null = null;
    let bestPri = Number.NEGATIVE_INFINITY;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const handId of [0, 1] as HandId[]) {
      const cand = hands.current[handId]!.hoverCand;
      if (!cand) continue;
      const pose = handWorldHub.tryGet(handId);
      if (!pose) continue;
      _hoverPos.set(
        pose.interactionPoint[0],
        pose.interactionPoint[1],
        pose.interactionPoint[2],
      );
      const pri = cand.pickPriority?.() ?? 0;
      const dist = cand.distanceTo(_hoverPos);
      if (pri > bestPri || (pri === bestPri && dist < bestDist)) {
        bestPri = pri;
        bestDist = dist;
        best = cand;
      }
    }

    if (best !== globalHover.current) {
      globalHover.current?.onHover?.(false);
      best?.onHover?.(true);
      globalHover.current = best;
    }
  });

  return null;
}
