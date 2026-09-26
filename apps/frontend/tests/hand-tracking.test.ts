import { expect, test } from "@rstest/core";
import { Matrix4 } from "three";
import { DEFAULT_AXIS_MAP, buildMapMatrix, mapPointTuple } from "../src/hand/axisMap";
import { handHub } from "../src/hand/HandHub";
import {
  MEDIAPIPE_VERSION,
  MEDIAPIPE_WASM_BASE,
  MEDIAPIPE_WASM_CDN,
} from "../src/hand/mediapipeLoader";
import { distance3, updatePinchState, updatePinchStateConfirmed } from "../src/hand/pinch";
import { fingerOpenRatio, updateGraspStateConfirmed } from "../src/hand/grasp";
import type { HandSample, Vec3 } from "../src/hand/types";

test("DEFAULT_AXIS_MAP mirrors X and flips Y for selfie → Three", () => {
  expect(DEFAULT_AXIS_MAP.invertX).toBe(true);
  expect(DEFAULT_AXIS_MAP.invertY).toBe(true);
  expect(DEFAULT_AXIS_MAP.invertZ).toBe(false);
});

test("buildMapMatrix maps MediaPipe point into scene space", () => {
  const map = buildMapMatrix(DEFAULT_AXIS_MAP);
  // Capture +X right, +Y down → scene −X (mirrored), +Y up
  const out = mapPointTuple([0.1, 0.2, 0.3], map);
  expect(out[0]).toBeCloseTo(-0.1);
  expect(out[1]).toBeCloseTo(-0.2);
  expect(out[2]).toBeCloseTo(0.3);
});

test("illegal axis config falls back to identity", () => {
  const map = buildMapMatrix({
    sceneXFrom: "x",
    invertX: false,
    sceneYFrom: "x",
    invertY: false,
    sceneZFrom: "z",
    invertZ: false,
  });
  expect(map.equals(new Matrix4())).toBe(true);
});

test("pinch hysteresis: enter below ON, stay until OFF", () => {
  const on = 0.035;
  const off = 0.055;
  expect(updatePinchState(false, 0.04, on, off)).toBe(false);
  expect(updatePinchState(false, 0.03, on, off)).toBe(true);
  expect(updatePinchState(true, 0.05, on, off)).toBe(true);
  expect(updatePinchState(true, 0.055, on, off)).toBe(false);
  expect(updatePinchState(true, 0.06, on, off)).toBe(false);
});

test("pinch confirm ignores single-frame flips near the band", () => {
  const on = 0.045;
  const off = 0.07;
  let pending = 0;
  let pinching = false;
  // One frame below ON — not enough
  ({ pinching, pendingCount: pending } = updatePinchStateConfirmed(
    pinching,
    0.04,
    on,
    off,
    pending,
    2,
  ));
  expect(pinching).toBe(false);
  expect(pending).toBe(1);
  // Second agreeing frame — enter
  ({ pinching, pendingCount: pending } = updatePinchStateConfirmed(
    pinching,
    0.04,
    on,
    off,
    pending,
    2,
  ));
  expect(pinching).toBe(true);
  expect(pending).toBe(0);
  // Same mid-band pose while pinching — stays on (hysteresis)
  ({ pinching, pendingCount: pending } = updatePinchStateConfirmed(
    pinching,
    0.055,
    on,
    off,
    pending,
    2,
  ));
  expect(pinching).toBe(true);
});

test("fingerOpenRatio lower when tips curl toward wrist", () => {
  const open: Vec3[] = Array.from({ length: 21 }, () => [0, 0, 0] as Vec3);
  open[0] = [0, 0, 0];
  open[9] = [0, 0.08, 0];
  for (const tip of [8, 12, 16, 20]) open[tip] = [0, 0.2, 0];
  const closed = open.map((p) => [...p] as Vec3);
  for (const tip of [8, 12, 16, 20]) closed[tip] = [0, 0.05, 0];
  expect(fingerOpenRatio(open)).toBeGreaterThan(fingerOpenRatio(closed));
  expect(fingerOpenRatio(closed)).toBeLessThan(1.4);
});

test("grasp hysteresis: enter when openRatio ≤ ON, leave when ≥ OFF", () => {
  const on = 1.4;
  const off = 1.65;
  expect(updateGraspStateConfirmed(false, 1.5, on, off, 0, 1).grasping).toBe(false);
  expect(updateGraspStateConfirmed(false, 1.3, on, off, 0, 1).grasping).toBe(true);
  expect(updateGraspStateConfirmed(true, 1.5, on, off, 0, 1).grasping).toBe(true);
  expect(updateGraspStateConfirmed(true, 1.65, on, off, 0, 1).grasping).toBe(false);
});

test("distance3 is Euclidean", () => {
  expect(distance3([0, 0, 0], [3, 4, 0])).toBeCloseTo(5);
});

test("handHub publish / clear / hasAny", () => {
  handHub.clearAll();
  expect(handHub.hasAny()).toBe(false);

  const sample: HandSample = {
    handId: 0,
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    pinching: false,
    timestamp: 1,
    landmarks: null,
  };
  handHub.publish(sample);
  expect(handHub.tryGetLatest(0)?.handId).toBe(0);
  expect(handHub.tryGetLatest(1)).toBeNull();
  expect(handHub.hasAny()).toBe(true);

  handHub.clear(0);
  expect(handHub.hasAny()).toBe(false);
});

test("MediaPipe WASM URLs are pinned (not @latest)", () => {
  expect(MEDIAPIPE_VERSION).toBe("1.0.1");
  expect(MEDIAPIPE_WASM_BASE).toBe("/mediapipe");
  expect(MEDIAPIPE_WASM_CDN).toContain(`@${MEDIAPIPE_VERSION}`);
  expect(MEDIAPIPE_WASM_CDN).not.toContain("@latest");
});

test("imageLandmarksToCaptureMeters maps frame center XY; Z from depth + finger", async () => {
  const { imageLandmarksToCaptureMeters } = await import("../src/hand/HandTracker");
  const pts = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  pts[1] = { x: 1, y: 0, z: -0.1 };
  const out = imageLandmarksToCaptureMeters(pts, {
    depthZ: 1,
    xySpan: 0.8,
    fingerZSpan: 0.8,
  });
  expect(out[0][0]).toBeCloseTo(0);
  expect(out[0][1]).toBeCloseTo(0);
  expect(out[0][2]).toBeCloseTo(1);
  // Unmirrored legacy: x=1 → +half span; y=0 (top) → +half span (scene Y-up)
  expect(out[1][0]).toBeCloseTo(0.4);
  expect(out[1][1]).toBeCloseTo(0.4);
  // Finger zRel=-0.1 → closer to cam → larger scene Z (depthZ - zRel*span)
  expect(out[1][2]).toBeCloseTo(1 - -0.1 * 0.8);
});

test("screen map: mirrored preview center → workspace center; right of preview → +X", async () => {
  const { imageLandmarkToScene, SCREEN_WORKSPACE, clampHandZ } =
    await import("../src/hand/screenMap");
  const { HAND_Z_NEAR } = await import("../src/hand/defaults");
  const mid = imageLandmarkToScene(0.5, 0.5, 0, { depthZ: SCREEN_WORKSPACE.center[2] });
  expect(mid[0]).toBeCloseTo(SCREEN_WORKSPACE.center[0]);
  expect(mid[1]).toBeCloseTo(SCREEN_WORKSPACE.center[1]);
  expect(mid[2]).toBeCloseTo(SCREEN_WORKSPACE.center[2]);

  // Raw x=0 is left of camera = right of mirrored preview → positive scene X
  const rightOfPreview = imageLandmarkToScene(0, 0.5, 0, {
    depthZ: SCREEN_WORKSPACE.center[2],
  });
  expect(rightOfPreview[0]).toBeGreaterThan(SCREEN_WORKSPACE.center[0]);

  // Raw x=1 is right of camera = left of mirrored preview → negative scene X
  const leftOfPreview = imageLandmarkToScene(1, 0.5, 0, {
    depthZ: SCREEN_WORKSPACE.center[2],
  });
  expect(leftOfPreview[0]).toBeLessThan(SCREEN_WORKSPACE.center[0]);

  // Closer fingertip (negative MediaPipe z) must not sink past work slab
  const tip = imageLandmarkToScene(0.5, 0.5, -0.5, { depthZ: 0.35 });
  expect(tip[2]).toBeGreaterThanOrEqual(HAND_Z_NEAR);
  expect(clampHandZ(0.1)).toBe(HAND_Z_NEAR);
});

test("desk depth: larger palm → closer; browsers assume 1 m desk", async () => {
  const { DESK_TO_SCREEN_METERS, estimateDepthFromPalmNorm, palmRatioToSceneZ, palmWidthNorm } =
    await import("../src/hand/deskDepth");
  expect(DESK_TO_SCREEN_METERS).toBe(1);

  const near = estimateDepthFromPalmNorm(0.2);
  const far = estimateDepthFromPalmNorm(0.08);
  expect(near).toBeLessThan(far);

  // Palm ratio reach: bigger palm → smaller scene Z (toward parts)
  const zNear = palmRatioToSceneZ(0.16, 0.1, 0.26, 0.4, 0.58);
  const zFar = palmRatioToSceneZ(0.07, 0.1, 0.26, 0.4, 0.58);
  const zMid = palmRatioToSceneZ(0.1, 0.1, 0.26, 0.4, 0.58);
  expect(zNear).toBeLessThan(zMid);
  expect(zFar).toBeGreaterThan(zMid);
  // Full near within ~+18% palm growth
  expect(zNear).toBeCloseTo(0.26);

  // Capture 2026-09-25 left max (~+20%): must reach NEAR with current spans
  const leftCaptureNear = palmRatioToSceneZ(0.1886, 0.156893, 0.26, 0.4, 0.58);
  expect(leftCaptureNear).toBeCloseTo(0.26, 2);

  const pts = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  pts[5] = { x: 0.4, y: 0.5, z: 0 };
  pts[17] = { x: 0.55, y: 0.5, z: 0 };
  expect(palmWidthNorm(pts)).toBeCloseTo(0.15);
});

test("median origin helper prefers mid sample", async () => {
  const { median } = await import("../src/hand/deskDepth");
  expect(median([0.2, 0.1, 0.15])).toBeCloseTo(0.15);
  expect(median([0.1, 0.2])).toBeCloseTo(0.15);
});

test("capture log: record → parse → replay publishes HandHub", async () => {
  const {
    HAND_CAPTURE_LOG_VERSION,
    handCaptureRecorder,
    parseHandCaptureLog,
    HandCaptureReplayer,
  } = await import("../src/hand/captureLog");
  const { handHub: hub } = await import("../src/hand/HandHub");
  const { JOINT_COUNT } = await import("../src/hand/types");

  hub.clearAll();
  handCaptureRecorder.clear();
  handCaptureRecorder.start("unit");
  const landmarks = Array.from(
    { length: JOINT_COUNT },
    (_, i) => [i * 0.01, 0.1, 0.4] as [number, number, number],
  );
  handCaptureRecorder.append([
    {
      handId: 0,
      label: "Left",
      image: landmarks,
      world: null,
      palmRaw: 0.12,
      palmEma: 0.12,
      originPalm: 0.12,
      reachZ: 0.4,
      sceneWrist: [0, 0.1, 0.4],
      sceneLandmarks: landmarks,
      rotation: [0, 0, 0, 1],
      pinching: false,
      pinchDist: 0.08,
    },
  ]);
  const log = handCaptureRecorder.stop();
  expect(log.version).toBe(HAND_CAPTURE_LOG_VERSION);
  expect(log.frames).toHaveLength(1);
  expect(log.meta.note).toBe("unit");

  const parsed = parseHandCaptureLog(JSON.parse(JSON.stringify(log)));
  expect(parsed.frames[0].hands[0].reachZ).toBeCloseTo(0.4);

  await new Promise<void>((resolve) => {
    const replayer = new HandCaptureReplayer(parsed, { onDone: () => resolve() });
    replayer.start();
  });
  expect(hub.tryGetLatest(0)?.position[2]).toBeCloseTo(0.4);
  hub.clearAll();
  handCaptureRecorder.clear();
});

test("parseHandCaptureLog rejects bad version", async () => {
  const { parseHandCaptureLog } = await import("../src/hand/captureLog");
  expect(() => parseHandCaptureLog({ version: 99, frames: [] })).toThrow();
});
