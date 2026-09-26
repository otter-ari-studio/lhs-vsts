import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import { operationSurfaceHub } from "./operationSurfaceHub";
import { createPointerDragSession } from "./pointerDragSession";

const _planeN = new Vector3(0, 0, 1);

/**
 * Mouse / trackpad demo interaction:
 * - Hover nearest SOP part on the operation face
 * - Click clip / nut to act immediately
 * - Drag grabbable / nut carry; release to install or inventory
 */
export function PointerInteraction() {
  const { camera, gl } = useThree();
  const sessionRef = useRef(createPointerDragSession());
  const raycaster = useRef(new Raycaster());
  const ndc = useRef(new Vector2());
  const plane = useRef(new Plane());
  const scratch = useRef(new Vector3());

  useEffect(() => {
    const el = gl.domElement;
    const session = sessionRef.current;
    const pos = scratch.current;

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
      session.moveTo(pos);
      return pos;
    };

    const onPointerMove = (e: PointerEvent) => {
      projectClient(e.clientX, e.clientY);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      projectClient(e.clientX, e.clientY);
      const engaged = session.getEngaged();
      const targetHit = session.pointerDown();
      if (!engaged && targetHit) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      projectClient(e.clientX, e.clientY);
      session.pointerUp();
    };

    const onPointerLeave = () => {
      session.pointerLeave();
    };

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("pointercancel", onPointerLeave);
    el.style.touchAction = "none";
    el.style.cursor = "grab";

    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("pointercancel", onPointerLeave);
      session.pointerLeave();
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const dt = Math.min(Math.max(delta, 0.0001), 0.05);
    sessionRef.current.holdTick(dt);
  });

  return null;
}
