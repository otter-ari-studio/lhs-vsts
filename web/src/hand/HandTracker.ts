import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { Matrix4 } from 'three';
import { buildMapMatrix, mapPointTuple, type AxisMapConfig } from './axisMap';
import {
  HAND_HOLD_MS,
  IMAGE_LANDMARK_XY_SPAN_METERS,
  IMAGE_LANDMARK_Z_SPAN_METERS,
  PINCH_OFF_METERS,
  PINCH_ON_METERS,
  WORLD_LANDMARK_SCALE,
} from './defaults';
import { handHub } from './HandHub';
import { estimatePalmRotation } from './palmRotation';
import { distance3, updatePinchState } from './pinch';
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
  axisMap?: AxisMapConfig;
  holdMs?: number;
  onPresence?: (presence: TrackingPresence) => void;
}

/**
 * VIDEO-mode detect loop → HandHub.
 *
 * Position / skeleton: image landmarks (carry arm translation).
 * Pinch: world landmarks when available (metric finger spacing).
 * Axis map once; pinch hysteresis; short hold on loss.
 */
export class HandTracker {
  private readonly landmarker: HandLandmarker;
  private readonly video: HTMLVideoElement;
  private readonly map: Matrix4;
  private readonly holdMs: number;
  private readonly onPresence?: (presence: TrackingPresence) => void;

  private raf = 0;
  private running = false;
  private lastVideoTime = -1;
  private lastTs = 0;

  private readonly pinchState: [boolean, boolean] = [false, false];
  private readonly held: (HandSample | null)[] = [null, null];
  private readonly lastSeenAt: [number, number] = [0, 0];

  constructor(opts: HandTrackerOptions) {
    this.landmarker = opts.landmarker;
    this.video = opts.video;
    this.map = buildMapMatrix(opts.axisMap);
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

    // Monotonic timestamps required by MediaPipe VIDEO mode
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

    for (let i = 0; i < count; i++) {
      const image = result.landmarks[i];
      if (!image || image.length < JOINT_COUNT) continue;

      const handId = handednessToId(result.handedness?.[i]?.[0]?.categoryName);
      if (handId === null) continue;

      // Image landmarks carry translation; world landmarks do not.
      const capture = imageLandmarksToCaptureMeters(image);
      const mapped: Vec3[] = capture.map((p) => mapPointTuple(p, this.map));
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
      // Keep last frame in hub (timestamp unchanged so drivers know it's held)
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

/**
 * Normalized image landmarks → capture meters (origin ≈ frame center).
 * x,y ∈ [0,1]; z ≈ x-scale with wrist origin (MediaPipe image landmark semantics).
 */
export function imageLandmarksToCaptureMeters(
  image: { x: number; y: number; z: number }[],
  xySpan = IMAGE_LANDMARK_XY_SPAN_METERS,
  zSpan = IMAGE_LANDMARK_Z_SPAN_METERS,
): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < JOINT_COUNT; i++) {
    const p = image[i];
    out.push([(p.x - 0.5) * xySpan, (p.y - 0.5) * xySpan, p.z * zSpan]);
  }
  return out;
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

/** Prefer metric world tips; fall back to mapped image tips. */
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
