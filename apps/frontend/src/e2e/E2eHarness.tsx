import { getTrainingSession } from "@lhs-vsts/machine";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { Camera } from "three";
import { Vector3 } from "three";

import { operationSurfaceHub } from "../interaction/operationSurfaceHub";
import { INVENTORY_PARK, partInventory } from "../interaction/partInventory";
import { currentInstallOfferPartId, PROP_OFFER_POS } from "../interaction/partOffer";
import { getPartPose } from "../interaction/partPoseHub";

export interface LhsE2eApi {
  ready: boolean;
  /** Project a tracked part pose to client (viewport) coordinates. */
  projectPart(partId: string): { x: number; y: number } | null;
  /**
   * Prefer live offer/park pose; fall back to the fixed offer tray when the
   * part is the current install offer but pose hub has not caught up yet.
   */
  projectOfferOrPart(partId: string): { x: number; y: number } | null;
  /** Project the machine-def install/remove anchor (slot), ignoring live pose. */
  projectAnchor(partId: string): { x: number; y: number } | null;
  inventory(): string[];
  completedSteps(): string[];
  currentStepLabel(): string | null;
  currentStepId(): string | null;
  partKind(partId: string): string | null;
  /** True when this part is the current install offer (popped to tray). */
  isInstallOffer(partId: string): boolean;
  score(): number | null;
  passed(): boolean | null;
  faultCount(): number | null;
  sessionId(): string | null;
  applianceWashPending(): boolean;
  canvasRect(): { left: number; top: number; width: number; height: number };
}

declare global {
  interface Window {
    __lhsE2e?: LhsE2eApi;
  }
}

const _v = new Vector3();

/** True when the page was opened with `?e2e=1` (Playwright real-drag suite). */
export function isE2eMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("e2e") === "1";
}

function projectWorld(
  camera: Camera,
  gl: { domElement: HTMLCanvasElement },
  world: [number, number, number],
): { x: number; y: number } | null {
  _v.set(world[0], world[1], world[2]).project(camera);
  if (!Number.isFinite(_v.x) || !Number.isFinite(_v.y)) return null;
  if (_v.z < -1 || _v.z > 1) return null;
  const rect = gl.domElement.getBoundingClientRect();
  return {
    x: rect.left + (_v.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-_v.y * 0.5 + 0.5) * rect.height,
  };
}

/**
 * Aim helpers must project onto the active operation-surface Z. PointerInteraction
 * re-intersects the mouse ray with that plane — aiming a raw world Z ≠ surface Z
 * puts the hit XY off the part (especially offer tray at z=0.22 vs mid/deep SOP).
 */
function projectForPointerAim(
  camera: Camera,
  gl: { domElement: HTMLCanvasElement },
  world: [number, number, number],
): { x: number; y: number } | null {
  const surfaceZ = operationSurfaceHub.get().z;
  return projectWorld(camera, gl, [world[0], world[1], surfaceZ]);
}

/**
 * Mount inside R3F Canvas. Exposes `window.__lhsE2e` so Playwright can aim
 * real pointer events at world parts without guessing screen positions.
 */
export function E2eHarness() {
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!isE2eMode()) return;

    const api: LhsE2eApi = {
      ready: true,
      projectPart(partId) {
        const pose = getPartPose(partId);
        if (pose) {
          const projected = projectForPointerAim(camera, gl, pose);
          if (projected) return projected;
        }
        const part = getTrainingSession()?.getPart(partId);
        if (!part) return null;
        return projectForPointerAim(camera, gl, part.anchor.position);
      },
      projectOfferOrPart(partId) {
        // Prefer the live mesh when it has left inventory park (offer tray / drag).
        const pose = getPartPose(partId);
        if (pose) {
          const parked =
            Math.abs(pose[0] - INVENTORY_PARK[0]) < 0.05 &&
            Math.abs(pose[1] - INVENTORY_PARK[1]) < 0.05 &&
            Math.abs(pose[2] - INVENTORY_PARK[2]) < 0.05;
          if (!parked) {
            const projected = projectForPointerAim(camera, gl, pose);
            if (projected) return projected;
          }
        }
        // Install offer tray (or caller asked for offer-or-part during reinstall).
        return projectForPointerAim(camera, gl, PROP_OFFER_POS);
      },
      projectAnchor(partId) {
        const part = getTrainingSession()?.getPart(partId);
        if (!part) return null;
        return projectForPointerAim(camera, gl, part.anchor.position);
      },
      inventory() {
        return [...partInventory.list()];
      },
      completedSteps() {
        return getTrainingSession()?.getCompletedSteps() ?? [];
      },
      currentStepLabel() {
        const row = getTrainingSession()
          ?.buildChromeSteps()
          .find((s) => s.status === "current");
        return row?.label ?? null;
      },
      currentStepId() {
        const row = getTrainingSession()
          ?.buildChromeSteps()
          .find((s) => s.status === "current");
        return row?.stepId ?? null;
      },
      partKind(partId) {
        return getTrainingSession()?.getPart(partId)?.kind ?? null;
      },
      isInstallOffer(partId) {
        return currentInstallOfferPartId() === partId;
      },
      score() {
        const s = getTrainingSession();
        return s ? s.getScore() : null;
      },
      passed() {
        const s = getTrainingSession();
        return s ? s.getPassed() : null;
      },
      faultCount() {
        const s = getTrainingSession();
        return s ? s.getFaultLog().length : null;
      },
      sessionId() {
        return getTrainingSession()?.getSessionId() ?? null;
      },
      applianceWashPending() {
        return getTrainingSession()?.isApplianceWashPending() ?? false;
      },
      canvasRect() {
        const rect = gl.domElement.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
      },
    };

    window.__lhsE2e = api;
    return () => {
      if (window.__lhsE2e === api) delete window.__lhsE2e;
    };
  }, [camera, gl]);

  return null;
}
