import { getTrainingSession } from "@lhs-vsts/machine";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector3 } from "three";

import { partInventory } from "../interaction/partInventory";
import { getPartPose } from "../interaction/partPoseHub";

export interface LhsE2eApi {
  ready: boolean;
  /** Project a tracked part pose to client (viewport) coordinates. */
  projectPart(partId: string): { x: number; y: number } | null;
  inventory(): string[];
  completedSteps(): string[];
  currentStepLabel(): string | null;
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
        if (!pose) return null;
        _v.set(pose[0], pose[1], pose[2]).project(camera);
        if (!Number.isFinite(_v.x) || !Number.isFinite(_v.y)) return null;
        // Behind camera / clipped
        if (_v.z < -1 || _v.z > 1) return null;
        const rect = gl.domElement.getBoundingClientRect();
        return {
          x: rect.left + (_v.x * 0.5 + 0.5) * rect.width,
          y: rect.top + (-_v.y * 0.5 + 0.5) * rect.height,
        };
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
