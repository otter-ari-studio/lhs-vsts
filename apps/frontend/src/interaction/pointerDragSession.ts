import { Vector3 } from "three";
import { findNearestInteractable, listLiveSopTargets, type HandInteractable } from "./registry";
import { selectionFromInteractable, selectionFromSopFallback } from "./selectionInfo";
import { selectionHub } from "./selectionHub";
import { aimTargetHub } from "./aimTargetHub";
import { setOrbitLocked } from "./orbitLockHub";

export interface PointerDragSession {
  /** Current pointer position on the operation surface (world). */
  readonly position: Vector3;
  getEngaged(): HandInteractable | null;
  isPointerDown(): boolean;
  /** Move the virtual pointer to a world-space point and refresh hover/HUD. */
  moveTo(world: Vector3 | [number, number, number]): void;
  /** Primary-button down at the current position (engage / commit). */
  pointerDown(): boolean;
  /** Primary-button up: release engaged part. */
  pointerUp(): void;
  /** Cancel like pointerleave. */
  pointerLeave(): void;
  /** Hold tick while dragging (same as useFrame path). */
  holdTick(dt?: number): void;
}

/**
 * Headless / shared pointer drag state machine used by PointerInteraction and
 * automated 3D drag tests. Operates in world space on the operation face.
 */
export function createPointerDragSession(): PointerDragSession {
  const engaged = { current: null as HandInteractable | null };
  const hover = { current: null as HandInteractable | null };
  const lockoutId = { current: null as string | null };
  const pointerDown = { current: false };
  const pos = new Vector3(0, 0.15, 0.22);
  const aim = new Vector3();

  const setHover = (next: HandInteractable | null) => {
    if (hover.current === next) return;
    hover.current?.onHover?.(false);
    next?.onHover?.(true);
    hover.current = next;
  };

  const updateHud = () => {
    if (engaged.current) {
      selectionHub.set(selectionFromInteractable(engaged.current));
      if (engaged.current.copyWorldPosition?.(aim)) {
        aimTargetHub.set({
          id: engaged.current.id,
          position: [aim.x, aim.y, aim.z],
          inRange: true,
        });
      }
      return;
    }

    let target = findNearestInteractable(pos);
    if (target && target.id === lockoutId.current) {
      if (target.distanceTo(pos) > target.interactionRadius * 1.35) {
        lockoutId.current = null;
      } else {
        target = null;
      }
    }

    if (!target) {
      let best: HandInteractable | null = null;
      let bestD = Number.POSITIVE_INFINITY;
      for (const it of listLiveSopTargets()) {
        const d = it.distanceTo(pos);
        if (d < bestD && d <= it.interactionRadius * 2.4) {
          bestD = d;
          best = it;
        }
      }
      target = best;
    }

    setHover(target && target.isInteractableNow() ? target : null);
    selectionHub.set(
      hover.current ? selectionFromInteractable(hover.current) : selectionFromSopFallback(),
    );

    const aimIt = hover.current ?? listLiveSopTargets()[0] ?? null;
    if (aimIt?.copyWorldPosition?.(aim)) {
      const inRange =
        !!hover.current && hover.current.distanceTo(pos) <= hover.current.interactionRadius * 0.95;
      aimTargetHub.set({
        id: aimIt.id,
        position: [aim.x, aim.y, aim.z],
        inRange,
      });
    } else {
      aimTargetHub.clear();
    }
  };

  const tryCommit = (): boolean => {
    const target = findNearestInteractable(pos);
    if (!target || target.id === lockoutId.current) return false;
    if (!target.isInteractableNow()) return false;

    const ok = target.onPinchStart(pos);
    if (ok === false) {
      lockoutId.current = target.id;
      return true;
    }

    if (target.kind === "clip") {
      lockoutId.current = target.id;
      engaged.current = null;
      setOrbitLocked(false);
      return true;
    }

    if (target.kind === "rotate_nut" && !target.isInteractableNow()) {
      lockoutId.current = target.id;
      engaged.current = null;
      setOrbitLocked(false);
      return true;
    }

    if (target.kind === "grabbable" || target.kind === "rotate_nut") {
      engaged.current = target;
      setOrbitLocked(true);
      return true;
    }

    return true;
  };

  const release = () => {
    if (!engaged.current) return;
    engaged.current.onPinchEnd(pos);
    engaged.current = null;
    setOrbitLocked(false);
  };

  return {
    position: pos,
    getEngaged() {
      return engaged.current;
    },
    isPointerDown() {
      return pointerDown.current;
    },
    moveTo(world) {
      if (Array.isArray(world)) {
        pos.set(world[0], world[1], world[2]);
      } else {
        pos.copy(world);
      }
      if (engaged.current && pointerDown.current) {
        engaged.current.onPinchHold(pos, 1 / 60);
      }
      updateHud();
    },
    pointerDown() {
      updateHud();
      if (engaged.current) {
        pointerDown.current = true;
        return true;
      }
      const target = findNearestInteractable(pos);
      if (target && target.id !== lockoutId.current && target.isInteractableNow()) {
        pointerDown.current = true;
        setOrbitLocked(true);
        tryCommit();
        updateHud();
        return true;
      }
      pointerDown.current = true;
      return false;
    },
    pointerUp() {
      pointerDown.current = false;
      release();
      updateHud();
    },
    pointerLeave() {
      pointerDown.current = false;
      release();
      setHover(null);
      selectionHub.set(selectionFromSopFallback());
      aimTargetHub.clear();
      setOrbitLocked(false);
    },
    holdTick(dt = 1 / 60) {
      if (engaged.current && pointerDown.current) {
        engaged.current.onPinchHold(pos, dt);
      }
    },
  };
}
