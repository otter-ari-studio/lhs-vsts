import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import {
  ema,
  palmRatioToSceneZ,
  palmWidthNorm,
} from './deskDepth';
import {
  HAND_HOLD_MS,
  HAND_Z_FAR,
  HAND_Z_NEAR,
  IMAGE_LANDMARK_FINGER_Z_SPAN_METERS,
  PINCH_OFF_METERS,
  PINCH_ON_METERS,
  WORLD_LANDMARK_SCALE,
} from './defaults';
import { handHub } from './HandHub';
import { estimatePalmRotation } from './palmRotation';
import { distance3, updatePinchState } from './pinch';
import {
  clampHandZ,
  imageLandmarksToSceneMeters,
  SCREEN_WORKSPACE,
} from './screenMap';
import {
  INDEX_TIP,
  JOINT_COUNT,
  THUMB_TIP,
  type HandId,
  type HandSample,
  type Vec3,
} from './types';

export type TrackingPresence = 'none' | 'partial' | 'both';

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
 * Pinch: world landmarks when available.
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

  private readonly pinchState: [boolean, boolean] = [false, false];
  private readonly held: (HandSample | null)[] = [null, null];
  private readonly lastSeenAt: [number, number] = [0, 0];
  private readonly palmNormEma: [number | null, number | null] = [null, null];
  private readonly originPalm: [number | null, number | null] = [null, null];

  constructor(opts: HandTrackerOptions) {
    this.landmarker = opts.landmarker;
    this.video = opts.video;
    this.holdMs = opts.holdMs ?? HAND_HOLD_MS;
    this.onPresence = opts.onPresence;
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
    this.palmNormEma[0] = null;
    this.palmNormEma[1] = null;
    this.originPalm[0] = null;
    this.originPalm[1] = null;
  }

  /** Call when UI requests Recalibrate — resets palm-reach origin on next sample. */
  resetDepthCalibration(): void {
    this.originPalm[0] = null;
    this.originPalm[1] = null;
    this.palmNormEma[0] = null;
    this.palmNormEma[1] = null;
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
      console.warn('[HandTracker] detectForVideo failed', err);
      this.applyHold(now);
      return;
    }

    const seen: [boolean, boolean] = [false, false];
    const count = result.landmarks?.length ?? 0;
    const centerZ = SCREEN_WORKSPACE.center[2];

    for (let i = 0; i < count; i++) {
      const image = result.landmarks[i];
      if (!image || image.length < JOINT_COUNT) continue;

      const handId = handednessToId(result.handedness?.[i]?.[0]?.categoryName);
      if (handId === null) continue;

      const rawPalm = palmWidthNorm(image);
      this.palmNormEma[handId] = ema(this.palmNormEma[handId], rawPalm);
      const palm = this.palmNormEma[handId] ?? rawPalm;
      if (this.originPalm[handId] === null && palm > 1e-4) {
        this.originPalm[handId] = palm;
      }
      const originPalm = this.originPalm[handId] ?? palm;
      // Larger palm (reach toward screen) → smaller scene Z toward parts.
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

      const pinchDist = pinchDistanceMeters(result.worldLandmarks?.[i], mapped);
      const pinching = updatePinchState(
        this.pinchState[handId],
        pinchDist,
        PINCH_ON_METERS,
        PINCH_OFF_METERS,
      );
      this.pinchState[handId] = pinching;

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
      handHub.publish(sample);
    }

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
      handHub.clear(handId);
      return;
    }
    if (now - this.lastSeenAt[handId] <= this.holdMs) {
      handHub.publish(held);
      return;
    }
    this.held[handId] = null;
    this.pinchState[handId] = false;
    handHub.clear(handId);
  }

  private emitPresence(): void {
    if (!this.onPresence) return;
    const l = handHub.tryGetLatest(0) !== null;
    const r = handHub.tryGetLatest(1) !== null;
    const presence: TrackingPresence = l && r ? 'both' : l || r ? 'partial' : 'none';
    this.onPresence(presence);
  }
}

function handednessToId(label: string | undefined): HandId | null {
  if (!label) return null;
  const lower = label.toLowerCase();
  if (lower === 'left') return 0;
  if (lower === 'right') return 1;
  return null;
}

/** @deprecated use imageLandmarksToSceneMeters — kept for older imports/tests */
export function imageLandmarksToCaptureMeters(
  image: { x: number; y: number; z: number }[],
  opts: { depthZ: number; xySpan?: number; fingerZSpan?: number } | number = 1,
  legacyZSpan?: number,
): Vec3[] {
  if (typeof opts === 'number') {
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

function worldLandmarksToVec3(
  world: { x: number; y: number; z: number }[],
  scale: number,
): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < JOINT_COUNT; i++) {
    const p = world[i];
    out.push([p.x * scale, p.y * scale, p.z * scale]);
  }
  return out;
}

function pinchDistanceMeters(
  world: { x: number; y: number; z: number }[] | undefined,
  mappedImage: readonly Vec3[],
): number {
  if (world && world.length >= JOINT_COUNT) {
    const tips = worldLandmarksToVec3(world, WORLD_LANDMARK_SCALE);
    return distance3(tips[THUMB_TIP], tips[INDEX_TIP]);
  }
  return distance3(mappedImage[THUMB_TIP], mappedImage[INDEX_TIP]);
}
