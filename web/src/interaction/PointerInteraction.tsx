import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { aimTargetHub } from './aimTargetHub';
import { setOrbitLocked } from './orbitLockHub';
import { operationSurfaceHub } from './operationSurfaceHub';
import {
  findNearestInteractable,
  listLiveSopTargets,
  type HandInteractable,
} from './registry';
import {
  selectionFromInteractable,
  selectionFromSopFallback,
} from './selectionInfo';
import { selectionHub } from './selectionHub';

const _planeN = new Vector3(0, 0, 1);

/**
 * Mouse / trackpad demo interaction:
 * - Hover nearest SOP part on the operation face
 * - Click clip / nut to act immediately
 * - Drag grabbable / nut carry; release to install or inventory
 */
export function PointerInteraction() {
  const { camera, gl } = useThree();
  const engaged = useRef<HandInteractable | null>(null);
  const hover = useRef<HandInteractable | null>(null);
  const lockoutId = useRef<string | null>(null);
  const pointerDown = useRef(false);
  const lastPos = useRef(new Vector3(0, 0.15, 0.22));
  const raycaster = useRef(new Raycaster());
  const ndc = useRef(new Vector2());
  const plane = useRef(new Plane());
  const scratch = useRef(new Vector3());
  const aimScratch = useRef(new Vector3());

  useEffect(() => {
    const el = gl.domElement;
    const pos = scratch.current;
    const aim = aimScratch.current;

    const projectClient = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(rect.width, 1);
      const h = Math.max(rect.height, 1);
      ndc.current.x = ((clientX - rect.left) / w) * 2 - 1;
      ndc.current.y = -((clientY - rect.top) / h) * 2 + 1;
      raycaster.current.setFromCamera(ndc.current, camera);
      const z = operationSurfaceHub.get().z;
      plane.current.set(_planeN, -z);
      if (!raycaster.current.ray.intersectPlane(plane.current, pos)) {
        const origin = raycaster.current.ray.origin;
        const dir = raycaster.current.ray.direction;
        const t = Math.abs(dir.z) > 1e-5 ? (z - origin.z) / dir.z : 0;
        pos.copy(origin).addScaledVector(dir, t);
      }
      lastPos.current.copy(pos);
      return pos;
    };

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
        hover.current
          ? selectionFromInteractable(hover.current)
          : selectionFromSopFallback(),
      );

      const aimIt = hover.current ?? listLiveSopTargets()[0] ?? null;
      if (aimIt?.copyWorldPosition?.(aim)) {
        const inRange =
          !!hover.current &&
          hover.current.distanceTo(pos) <= hover.current.interactionRadius * 0.95;
        aimTargetHub.set({
          id: aimIt.id,
          position: [aim.x, aim.y, aim.z],
          inRange,
        });
      } else {
        aimTargetHub.clear();
      }
    };

    const tryCommit = () => {
      const target = findNearestInteractable(pos);
      if (!target || target.id === lockoutId.current) return false;
      if (!target.isInteractableNow()) return false;

      const ok = target.onPinchStart(pos);
      if (ok === false) {
        lockoutId.current = target.id;
        return true;
      }

      if (target.kind === 'clip') {
        lockoutId.current = target.id;
        engaged.current = null;
        setOrbitLocked(false);
        return true;
      }

      if (target.kind === 'rotate_nut' && !target.isInteractableNow()) {
        lockoutId.current = target.id;
        engaged.current = null;
        setOrbitLocked(false);
        return true;
      }

      if (target.kind === 'grabbable' || target.kind === 'rotate_nut') {
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

    const onPointerMove = (e: PointerEvent) => {
      projectClient(e.clientX, e.clientY);
      if (engaged.current && pointerDown.current) {
        engaged.current.onPinchHold(pos, 1 / 60);
      }
      updateHud();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      projectClient(e.clientX, e.clientY);
      updateHud();
      if (engaged.current) {
        pointerDown.current = true;
        return;
      }
      const target = findNearestInteractable(pos);
      if (target && target.id !== lockoutId.current && target.isInteractableNow()) {
        pointerDown.current = true;
        setOrbitLocked(true);
        e.preventDefault();
        e.stopPropagation();
        tryCommit();
        updateHud();
        return;
      }
      pointerDown.current = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointerDown.current = false;
      projectClient(e.clientX, e.clientY);
      release();
      updateHud();
    };

    const onPointerLeave = () => {
      pointerDown.current = false;
      pos.copy(lastPos.current);
      release();
      setHover(null);
      selectionHub.set(selectionFromSopFallback());
      aimTargetHub.clear();
      setOrbitLocked(false);
    };

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('pointercancel', onPointerLeave);
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';

    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('pointercancel', onPointerLeave);
      pos.copy(lastPos.current);
      release();
      setHover(null);
      setOrbitLocked(false);
      aimTargetHub.clear();
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const dt = Math.min(Math.max(delta, 0.0001), 0.05);
    if (engaged.current && pointerDown.current) {
      engaged.current.onPinchHold(lastPos.current, dt);
    }
  });

  return null;
}
