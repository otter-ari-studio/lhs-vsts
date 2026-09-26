import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";

import { handCaptureRecorder, landmarkListToVec3, type HandCaptureHandFrame } from "./captureLog";
import {
  HAND_HOLD_MS,
  HAND_Z_FAR,
  HAND_Z_NEAR,
  GRASP_CONFIRM_FRAMES,
  GRASP_OFF_RATIO,
  GRASP_ON_RATIO,
  GRASP_RATIO_EMA,
  IMAGE_LANDMARK_FINGER_Z_SPAN_METERS,
} from "./defaults";
import {
  ema,
  median,
  palmRatioToSceneZ,
  palmWidthNorm,
  PALM_ORIGIN_MIN_SAMPLES,
  PALM_ORIGIN_SAMPLE_MS,
} from "./deskDepth";
import { fingerOpenRatio, updateGraspStateConfirmed } from "./grasp";
import { handHub } from "./HandHub";
import { estimatePalmRotation } from "./palmRotation";
import { clampHandZ, imageLandmarksToSceneMeters, SCREEN_WORKSPACE } from "./screenMap";
import { JOINT_COUNT, type HandId, type HandSample, type Vec3 } from "./types";

export type TrackingPresence = "none" | "partial" | "both";

export interface HandTrackerOptions {
  landmarker: HandLandmarker;
  video: HTMLVideoElement;
  holdMs?: number;
  onPresence?: (presence: TrackingPresence) => void;
}

/**
 * VIDEO-mode detect loop → HandHub (scene meters).
 *
 * XY: absolute screen map (mirrored webcam frame ↔ 3D workspace).
 * Z: palm-size depth vs 1 m desk assumption.
 * Grasp: finger openness (curl), not tip pinch.
 */
export class HandTracker {
  private readonly landmarker: HandLandmarker;
  private readonly video: HTMLVideoElement;
  private readonly holdMs: number;
  private readonly onPresence?: (presence: TrackingPresence) => void;

  private raf = 0;
  private running = false;
  private lastVideoTime = -1;
  private lastTs = 0;
  /** When false, detect may still run but does not publish (replay mode). */
  private publishEnabled = true;

  private readonly pinchState: [boolean, boolean] = [false, false];
  private readonly graspRatioEma: [number | null, number | null] = [null, null];
  private readonly pinchFlipPending: [number, number] = [0, 0];
  private readonly held: (HandSample | null)[] = [null, null];
  private readonly lastSeenAt: [number, number] = [0, 0];
  private readonly palmNormEma: [number | null, number | null] = [null, null];
  private readonly originPalm: [number | null, number | null] = [null, null];
  /** Raw palm samples while origin is unlocked (median → origin). */
  private readonly originPalmSamples: [number[], number[]] = [[], []];
  private readonly originPalmStartedAt: [number | null, number | null] = [null, null];

  constructor(opts: HandTrackerOptions) {
    this.landmarker = opts.landmarker;
    this.video = opts.video;
    this.holdMs = opts.holdMs ?? HAND_HOLD_MS;
    this.onPresence = opts.onPresence;
  }

  setPublishEnabled(enabled: boolean): void {
    this.publishEnabled = enabled;
    if (!enabled) {
      handHub.clearAll();
    }
  }

  isPublishEnabled(): boolean {
    return this.publishEnabled;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.tick();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    handHub.clearAll();
    this.held[0] = null;
    this.held[1] = null;
    this.pinchState[0] = false;
    this.pinchState[1] = false;
    this.graspRatioEma[0] = null;
    this.graspRatioEma[1] = null;
    this.pinchFlipPending[0] = 0;
    this.pinchFlipPending[1] = 0;
    this.palmNormEma[0] = null;
    this.palmNormEma[1] = null;
    this.clearOriginCalibration(0);
    this.clearOriginCalibration(1);
  }

  /** Call when UI requests Recalibrate — re-sample palm origin (~0.45 s). */
  resetDepthCalibration(): void {
    this.palmNormEma[0] = null;
    this.palmNormEma[1] = null;
    this.clearOriginCalibration(0);
    this.clearOriginCalibration(1);
  }

  private clearOriginCalibration(handId: HandId): void {
    this.originPalm[handId] = null;
    this.originPalmSamples[handId] = [];
    this.originPalmStartedAt[handId] = null;
  }

  /**
   * While unlocked, accumulate palm samples; lock median after window.
   * Returns the origin to use this frame (running median until locked).
   */
  private resolveOriginPalm(handId: HandId, palm: number, now: number): number {
    if (this.originPalm[handId] !== null) {
      return this.originPalm[handId]!;
    }
    if (!(palm > 1e-4)) return palm;

    const samples = this.originPalmSamples[handId];
    samples.push(palm);
    if (this.originPalmStartedAt[handId] === null) {
      this.originPalmStartedAt[handId] = now;
    }
    const started = this.originPalmStartedAt[handId]!;
    const ready =
      samples.length >= PALM_ORIGIN_MIN_SAMPLES && now - started >= PALM_ORIGIN_SAMPLE_MS;
    const running = median(samples);
    if (ready) {
      this.originPalm[handId] = running;
      this.originPalmSamples[handId] = [];
      this.originPalmStartedAt[handId] = null;
    }
    return running;
  }

  private tick(): void {
    const video = this.video;
    if (video.readyState < 2) return;

    const now = performance.now();
    if (video.currentTime === this.lastVideoTime) {
      this.applyHold(now);
      return;
    }
    this.lastVideoTime = video.currentTime;

    let ts = now;
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;

    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(video, ts);
    } catch (err) {
      console.warn("[HandTracker] detectForVideo failed", err);
      this.applyHold(now);
      return;
    }

    const seen: [boolean, boolean] = [false, false];
    const count = result.landmarks?.length ?? 0;
    const centerZ = SCREEN_WORKSPACE.center[2];
    const logHands: HandCaptureHandFrame[] = [];

    for (let i = 0; i < count; i++) {
      const image = result.landmarks[i];
      if (!image || image.length < JOINT_COUNT) continue;

      const label = result.handedness?.[i]?.[0]?.categoryName ?? "";
      const handId = handednessToId(label);
      if (handId === null) continue;

      const rawPalm = palmWidthNorm(image);
      this.palmNormEma[handId] = ema(this.palmNormEma[handId], rawPalm);
      const palm = this.palmNormEma[handId] ?? rawPalm;
      const originPalm = this.resolveOriginPalm(handId, palm, now);
      const reachZ = clampHandZ(
        palmRatioToSceneZ(palm, originPalm, HAND_Z_NEAR, centerZ, HAND_Z_FAR),
        HAND_Z_NEAR,
        HAND_Z_FAR,
      );

      const mapped = imageLandmarksToSceneMeters(image, {
        depthZ: reachZ,
        fingerZSpan: IMAGE_LANDMARK_FINGER_Z_SPAN_METERS,
        mirrorX: true,
      });
      const wrist = mapped[0];
      const rotation = estimatePalmRotation(mapped);

      const openRaw = fingerOpenRatio(mapped);
      this.graspRatioEma[handId] = ema(this.graspRatioEma[handId], openRaw, GRASP_RATIO_EMA);
      const openRatio = this.graspRatioEma[handId] ?? openRaw;
      const graspUpdate = updateGraspStateConfirmed(
        this.pinchState[handId],
        openRatio,
        GRASP_ON_RATIO,
        GRASP_OFF_RATIO,
        this.pinchFlipPending[handId],
        GRASP_CONFIRM_FRAMES,
      );
      this.pinchState[handId] = graspUpdate.grasping;
      this.pinchFlipPending[handId] = graspUpdate.pendingCount;
      const pinching = graspUpdate.grasping;
      // Log field pinchDist reused as openRatio for capture diagnostics.
      const pinchDist = openRatio;

      const imageVec = landmarkListToVec3(image);
      if (imageVec) {
        logHands.push({
          handId,
          label,
          image: imageVec,
          world: landmarkListToVec3(result.worldLandmarks?.[i]),
          palmRaw: rawPalm,
          palmEma: palm,
          originPalm,
          reachZ,
          sceneWrist: wrist,
          sceneLandmarks: mapped,
          rotation,
          pinching,
          pinchDist,
        });
      }

      const sample: HandSample = {
        handId,
        position: wrist,
        rotation,
        pinching,
        timestamp: now,
        landmarks: mapped,
      };
      this.held[handId] = sample;
      this.lastSeenAt[handId] = now;
      seen[handId] = true;
      if (this.publishEnabled) {
        handHub.publish(sample);
      }
    }

    handCaptureRecorder.append(logHands);

    for (const id of [0, 1] as const) {
      if (!seen[id]) {
        this.applyHoldForHand(id, now);
      }
    }

    this.emitPresence();
  }

  private applyHold(now: number): void {
    this.applyHoldForHand(0, now);
    this.applyHoldForHand(1, now);
    this.emitPresence();
  }

  private applyHoldForHand(handId: HandId, now: number): void {
    const held = this.held[handId];
    if (!held) {
      if (this.publishEnabled) {
        handHub.clear(handId);
      }
      return;
    }
    if (now - this.lastSeenAt[handId] <= this.holdMs) {
      if (this.publishEnabled) {
        handHub.publish(held);
      }
      return;
    }
    this.held[handId] = null;
    this.pinchState[handId] = false;
    this.graspRatioEma[handId] = null;
    this.pinchFlipPending[handId] = 0;
    if (this.publishEnabled) {
      handHub.clear(handId);
    }
  }

  private emitPresence(): void {
    if (!this.onPresence || !this.publishEnabled) return;
    const l = handHub.tryGetLatest(0) !== null;
    const r = handHub.tryGetLatest(1) !== null;
    const presence: TrackingPresence = l && r ? "both" : l || r ? "partial" : "none";
    this.onPresence(presence);
  }
}

function handednessToId(label: string | undefined): HandId | null {
  if (!label) return null;
  const lower = label.toLowerCase();
  if (lower === "left") return 0;
  if (lower === "right") return 1;
  return null;
}

/** @deprecated use imageLandmarksToSceneMeters — kept for older imports/tests */
export function imageLandmarksToCaptureMeters(
  image: { x: number; y: number; z: number }[],
  opts: { depthZ: number; xySpan?: number; fingerZSpan?: number } | number = 1,
  legacyZSpan?: number,
): Vec3[] {
  if (typeof opts === "number") {
    return imageLandmarksToSceneMeters(image, {
      depthZ: 0,
      fingerZSpan: legacyZSpan ?? IMAGE_LANDMARK_FINGER_Z_SPAN_METERS,
      mirrorX: false,
      clampZ: false,
      workspace: {
        center: [0, 0, 0],
        width: opts,
        height: opts,
      },
    });
  }
  const span = opts.xySpan ?? SCREEN_WORKSPACE.width;
  return imageLandmarksToSceneMeters(image, {
    depthZ: opts.depthZ,
    fingerZSpan: opts.fingerZSpan,
    mirrorX: false,
    clampZ: false,
    workspace: {
      center: [0, 0, 0],
      width: span,
      height: span,
    },
  });
}
