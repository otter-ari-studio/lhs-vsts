import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import type { HandId } from '../hand/types';
import { handWorldHub } from '../hand/handWorldHub';
import { aimTargetHub } from './aimTargetHub';
import {
  GRAB_COMMIT_MS,
  HIGHLIGHT_GRAB_COMMIT_MS,
  PENDING_EXIT_SCALE,
  SOP_PICK_PRIORITY,
  TOGGLE_COMMIT_MS,
} from './defaults';
import {
  findHoverTargetSticky,
  findNearestInteractable,
  listLiveSopTargets,
  type HandInteractable,
} from './registry';
import {
  candidateDist,
  pickSharedHover,
  resolveAimInRange,
  type SharedHoverCandidate,
} from './sharedAim';
import {
  selectionFromInteractable,
  selectionFromSopFallback,
} from './selectionInfo';
import { selectionHub } from './selectionHub';

const _pos = new Vector3();
const _hoverPos = new Vector3();
const _aimWorld = new Vector3();

function commitMsFor(
  it: HandInteractable | null,
  alreadyHighlighted: boolean,
): number {
  if (!it) return GRAB_COMMIT_MS;
  if (it.id.endsWith(':install-slot')) return TOGGLE_COMMIT_MS;
  if (it.kind !== 'grabbable') return TOGGLE_COMMIT_MS;
  if (alreadyHighlighted || (it.pickPriority?.() ?? 0) >= SOP_PICK_PRIORITY) {
    return HIGHLIGHT_GRAB_COMMIT_MS;
  }
  return GRAB_COMMIT_MS;
}

function stillPendingTarget(it: HandInteractable, handPos: Vector3): boolean {
  if (!it.isInteractableNow()) return false;
  return it.distanceTo(handPos) <= it.interactionRadius * PENDING_EXIT_SCALE;
}

/** Prefer the HUD-highlighted part so light squeeze grabs what you see. */
function pickPendingTarget(
  handPos: Vector3,
  highlighted: HandInteractable | null,
  lockoutId: string | null,
): HandInteractable | null {
  if (
    highlighted &&
    highlighted.id !== lockoutId &&
    stillPendingTarget(highlighted, handPos)
  ) {
    return highlighted;
  }
  const nearest = findNearestInteractable(handPos);
  if (nearest && nearest.id === lockoutId) return null;
  return nearest;
}

interface HandInteractionState {
  lastPinch: boolean;
  engaged: HandInteractable | null;
  hoverCand: HandInteractable | null;
  pending: HandInteractable | null;
  pendingMs: number;
  /** After reject / release, ignore this id until hand opens (avoids tip spam). */
  lockoutId: string | null;
}

/**
 * Routes grasp + hover to interactables.
 * Sustained grasp in range commits (top-cam often never sees a clean open→close edge).
 * Publishes one shared aim target so the guide stem matches the right-side HUD.
 */
export function InteractionRouter() {
  const hands = useRef<HandInteractionState[]>([
    {
      lastPinch: false,
      engaged: null,
      hoverCand: null,
      pending: null,
      pendingMs: 0,
      lockoutId: null,
    },
    {
      lastPinch: false,
      engaged: null,
      hoverCand: null,
      pending: null,
      pendingMs: 0,
      lockoutId: null,
    },
  ]);
  const globalHover = useRef<HandInteractable | null>(null);
  const aimInRangeRef = useRef(false);
  const aimIdRef = useRef<string | null>(null);

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
        state.lockoutId = null;
        continue;
      }

      _pos.set(
        pose.interactionPoint[0],
        pose.interactionPoint[1],
        pose.interactionPoint[2],
      );

      const pinch = pose.pinching;

      if (!pinch) {
        state.lockoutId = null;
      }

      if (!state.engaged && !state.pending) {
        state.hoverCand = findHoverTargetSticky(_pos, state.hoverCand);
      } else if (state.engaged) {
        state.hoverCand = null;
      }

      if (pinch && !state.engaged) {
        if (!state.pending) {
          state.pending = pickPendingTarget(
            _pos,
            globalHover.current,
            state.lockoutId,
          );
          state.pendingMs = 0;
        } else if (!stillPendingTarget(state.pending, _pos)) {
          state.pending = pickPendingTarget(
            _pos,
            globalHover.current,
            state.lockoutId,
          );
          state.pendingMs = 0;
        } else {
          const alreadyHi =
            globalHover.current?.id === state.pending.id ||
            state.hoverCand?.id === state.pending.id ||
            (state.pending.pickPriority?.() ?? 0) >= SOP_PICK_PRIORITY;
          state.pendingMs += dt * 1000;
          if (state.pendingMs >= commitMsFor(state.pending, alreadyHi)) {
            const target = state.pending;
            state.pending = null;
            state.pendingMs = 0;
            state.hoverCand = null;
            const ok = target.onPinchStart(_pos);
            if (ok === false) {
              state.engaged = null;
              state.lockoutId = target.id;
            } else {
              state.engaged = target;
              state.lockoutId = null;
            }
          }
        }
      } else if (pinch && state.engaged) {
        if (
          state.engaged.kind === 'rotate_nut' &&
          !state.engaged.isInteractableNow()
        ) {
          state.engaged.onPinchEnd(_pos);
          state.engaged = null;
          state.pending = pickPendingTarget(
            _pos,
            globalHover.current,
            state.lockoutId,
          );
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

    const sharedCands: SharedHoverCandidate[] = [];
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
      sharedCands.push({ it: cand, dist: cand.distanceTo(_hoverPos) });
    }

    const best = pickSharedHover(sharedCands, globalHover.current);

    if (best !== globalHover.current) {
      globalHover.current?.onHover?.(false);
      best?.onHover?.(true);
      globalHover.current = best;
    }

    const sel = best
      ? selectionFromInteractable(best)
      : selectionFromSopFallback();
    selectionHub.set(sel);

    // Shared aim target: hovered part, else nearest live SOP part to any hand.
    let aimIt: HandInteractable | null = best;
    let aimDist = best
      ? candidateDist(sharedCands, best.id)
      : Number.POSITIVE_INFINITY;
    if (!aimIt) {
      const sops = listLiveSopTargets();
      let nearest: HandInteractable | null = null;
      let nearestD = Number.POSITIVE_INFINITY;
      for (const handId of [0, 1] as HandId[]) {
        const pose = handWorldHub.tryGet(handId);
        if (!pose) continue;
        _hoverPos.set(
          pose.interactionPoint[0],
          pose.interactionPoint[1],
          pose.interactionPoint[2],
        );
        for (const it of sops) {
          const d = it.distanceTo(_hoverPos);
          if (d < nearestD) {
            nearestD = d;
            nearest = it;
          }
        }
      }
      if (!nearest && sops[0]) {
        nearest = sops[0];
        nearestD = Number.POSITIVE_INFINITY;
      }
      aimIt = nearest;
      aimDist = nearestD;
    }

    if (aimIt?.copyWorldPosition?.(_aimWorld)) {
      const sameTarget = aimIdRef.current === aimIt.id;
      aimInRangeRef.current = resolveAimInRange(
        aimDist,
        aimIt.interactionRadius,
        sameTarget ? aimInRangeRef.current : false,
      );
      aimIdRef.current = aimIt.id;
      aimTargetHub.set({
        id: aimIt.id,
        position: [_aimWorld.x, _aimWorld.y, _aimWorld.z],
        inRange: aimInRangeRef.current,
      });
    } else {
      aimIdRef.current = null;
      aimInRangeRef.current = false;
      aimTargetHub.clear();
    }
  });

  return null;
}
