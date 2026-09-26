import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import type { HandId } from '../hand/types';
import { handWorldHub } from '../hand/handWorldHub';
import { aimTargetHub } from './aimTargetHub';
import {
  PENDING_EXIT_SCALE,
  REACH_COMMIT_MS,
  REACH_COMMIT_RADIUS_SCALE,
} from './defaults';
import {
  findNearestInteractable,
  listInteractables,
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

/**
 * Reach-in interaction (laptop top-cam SOP training):
 * - One rule: aim point stays on a live part → commit (no fist required).
 * - Fist only matters while carrying (open hand = release).
 * - SOP parts win over everything else when in range.
 */
interface HandInteractionState {
  engaged: HandInteractable | null;
  hoverCand: HandInteractable | null;
  contact: HandInteractable | null;
  contactMs: number;
  lockoutId: string | null;
  lastPinch: boolean;
}

function inReach(it: HandInteractable, handPos: Vector3): boolean {
  if (!it.isInteractableNow()) return false;
  return it.distanceTo(handPos) <= it.interactionRadius;
}

/** Inner hot zone — must be here to accumulate commit time. */
function inCommitZone(it: HandInteractable, handPos: Vector3): boolean {
  if (!it.isInteractableNow()) return false;
  return (
    it.distanceTo(handPos) <= it.interactionRadius * REACH_COMMIT_RADIUS_SCALE
  );
}

function stillNear(it: HandInteractable, handPos: Vector3): boolean {
  if (!it.isInteractableNow()) return false;
  return it.distanceTo(handPos) <= it.interactionRadius * PENDING_EXIT_SCALE;
}

function pickReachTarget(
  handPos: Vector3,
  preferred: HandInteractable | null,
  lockoutId: string | null,
): HandInteractable | null {
  if (
    preferred &&
    preferred.id !== lockoutId &&
    preferred.isInteractableNow() &&
    inReach(preferred, handPos)
  ) {
    return preferred;
  }
  const nearest = findNearestInteractable(handPos);
  if (nearest && nearest.id === lockoutId) return null;
  return nearest;
}

export function InteractionRouter() {
  const hands = useRef<HandInteractionState[]>([
    {
      engaged: null,
      hoverCand: null,
      contact: null,
      contactMs: 0,
      lockoutId: null,
      lastPinch: false,
    },
    {
      engaged: null,
      hoverCand: null,
      contact: null,
      contactMs: 0,
      lockoutId: null,
      lastPinch: false,
    },
  ]);
  const globalHover = useRef<HandInteractable | null>(null);
  const aimInRangeRef = useRef(false);
  const aimIdRef = useRef<string | null>(null);

  useFrame((_, delta) => {
    const dt = Math.min(Math.max(delta, 0.0001), 0.05);
    const dtMs = dt * 1000;

    for (const handId of [0, 1] as HandId[]) {
      const pose = handWorldHub.tryGet(handId);
      const state = hands.current[handId]!;
      if (!pose) {
        if (state.engaged) {
          state.engaged.onPinchEnd(_pos);
          state.engaged = null;
        }
        state.hoverCand = null;
        state.contact = null;
        state.contactMs = 0;
        state.lockoutId = null;
        state.lastPinch = false;
        continue;
      }

      _pos.set(
        pose.interactionPoint[0],
        pose.interactionPoint[1],
        pose.interactionPoint[2],
      );
      const pinch = pose.pinching;

      if (state.lockoutId) {
        const locked = listInteractables().find((it) => it.id === state.lockoutId);
        if (!locked || !stillNear(locked, _pos)) {
          state.lockoutId = null;
        }
      }

      // --- carrying: follow hand; open fist or flick left to inventory releases ---
      if (state.engaged) {
        if (
          state.engaged.kind === 'rotate_nut' &&
          !state.engaged.isInteractableNow()
        ) {
          state.engaged.onPinchEnd(_pos);
          state.engaged = null;
        } else if (
          state.engaged.kind === 'grabbable' ||
          state.engaged.kind === 'rotate_nut'
        ) {
          state.engaged.onPinchHold(_pos, dt);
          const releaseOpen = !pinch && state.lastPinch;
          const releaseInventory = !pinch && _pos.x < -0.28;
          if (releaseOpen || releaseInventory) {
            state.engaged.onPinchEnd(_pos);
            state.engaged = null;
          }
        }
        state.hoverCand = null;
        state.contact = null;
        state.contactMs = 0;
        state.lastPinch = pinch;
        continue;
      }

      // Prefer shared HUD/aim target when this hand can reach it.
      const preferred =
        globalHover.current && inReach(globalHover.current, _pos)
          ? globalHover.current
          : null;
      const target = pickReachTarget(_pos, preferred, state.lockoutId);
      state.hoverCand = target;

      // Outer ring = hover/aim; inner ring + dwell = intentional commit.
      if (target && inCommitZone(target, _pos)) {
        if (state.contact?.id === target.id) {
          state.contactMs += dtMs;
        } else {
          state.contact = target;
          state.contactMs = 0;
        }

        if (state.contactMs >= REACH_COMMIT_MS) {
          const ok = target.onPinchStart(_pos);
          state.contact = null;
          state.contactMs = 0;
          if (ok === false) {
            state.lockoutId = target.id;
          } else if (target.kind === 'clip') {
            state.lockoutId = target.id;
            state.engaged = null;
          } else if (
            target.kind === 'rotate_nut' &&
            !target.isInteractableNow()
          ) {
            state.lockoutId = target.id;
            state.engaged = null;
          } else {
            state.engaged = target;
            state.lockoutId = null;
          }
        }
      } else {
        state.contact = null;
        state.contactMs = 0;
      }

      state.lastPinch = pinch;
    }

    // Shared hover / HUD / aim stem — one target for both hands.
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
    // Also seed SOP targets near either hand so HUD/line stay on the glowing part
    // even before enter-radius (guide the reach-in).
    for (const handId of [0, 1] as HandId[]) {
      const pose = handWorldHub.tryGet(handId);
      if (!pose) continue;
      _hoverPos.set(
        pose.interactionPoint[0],
        pose.interactionPoint[1],
        pose.interactionPoint[2],
      );
      for (const it of listLiveSopTargets()) {
        const d = it.distanceTo(_hoverPos);
        if (d <= it.interactionRadius * 2.2) {
          sharedCands.push({ it, dist: d });
        }
      }
    }

    const best = pickSharedHover(sharedCands, globalHover.current);
    if (best !== globalHover.current) {
      globalHover.current?.onHover?.(false);
      best?.onHover?.(true);
      globalHover.current = best;
    }

    selectionHub.set(
      best ? selectionFromInteractable(best) : selectionFromSopFallback(),
    );

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
      aimIt = nearest ?? sops[0] ?? null;
      aimDist = nearest ? nearestD : Number.POSITIVE_INFINITY;
    }

    if (aimIt?.copyWorldPosition?.(_aimWorld)) {
      const same = aimIdRef.current === aimIt.id;
      const commitR = aimIt.interactionRadius * REACH_COMMIT_RADIUS_SCALE;
      aimInRangeRef.current = resolveAimInRange(
        aimDist,
        commitR,
        same ? aimInRangeRef.current : false,
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
