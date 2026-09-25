import type { Vec3 } from './types';
import {
  HAND_Z_MAX,
  HAND_Z_MIN,
  IMAGE_LANDMARK_FINGER_Z_SPAN_METERS,
} from './defaults';

/**
 * Map the full webcam frame onto the 3D training workspace.
 *
 * The bottom-right PiP is only a preview of the same frame — it does NOT
 * define coordinates. We mirror U to match `.cam-preview { transform: scaleX(-1) }`
 * so “hand in the middle of the preview” ≈ “hand in the middle of the scene”.
 *
 * Browser CSS pixel sizes are not required: MediaPipe already gives normalized
 * [0,1] image coords; we scale those into a fixed scene workspace in meters.
 */
export const SCREEN_WORKSPACE = {
  /** Scene point that corresponds to camera frame center (hood mid-front). */
  center: [0, 0.14, 0.38] as Vec3,
  /** Full camera width → this many meters of scene X. */
  width: 0.95,
  /** Full camera height → this many meters of scene Y. */
  height: 0.7,
} as const;

export interface ImageToSceneOptions {
  /** Scene Z for the wrist (desk-depth reach model). */
  depthZ: number;
  fingerZSpan?: number;
  /** When true (default), flip X to match mirrored selfie preview. */
  mirrorX?: boolean;
  /** When true (default), keep Z on the front work slab. */
  clampZ?: boolean;
  workspace?: typeof SCREEN_WORKSPACE;
}

export function clampHandZ(z: number, lo = HAND_Z_MIN, hi = HAND_Z_MAX): number {
  return Math.min(hi, Math.max(lo, z));
}

/**
 * One landmark: raw MediaPipe image (x right, y down) → scene meters.
 *
 * MediaPipe image z: smaller = closer to webcam.
 * Scene +Z points toward the viewer camera, so closer → larger scene Z:
 *   sceneZ = depthZ - zRel * span
 */
export function imageLandmarkToScene(
  xNorm: number,
  yNorm: number,
  zRel: number,
  opts: ImageToSceneOptions,
): Vec3 {
  const ws = opts.workspace ?? SCREEN_WORKSPACE;
  const mirror = opts.mirrorX !== false;
  const u = mirror ? 1 - xNorm : xNorm;
  const v = yNorm;
  const fingerZ = opts.fingerZSpan ?? IMAGE_LANDMARK_FINGER_Z_SPAN_METERS;
  let z = opts.depthZ - zRel * fingerZ;
  if (opts.clampZ !== false) z = clampHandZ(z);
  return [
    ws.center[0] + (u - 0.5) * ws.width,
    ws.center[1] + (0.5 - v) * ws.height,
    z,
  ];
}

/** All 21 landmarks → scene meters (absolute screen mapping). */
export function imageLandmarksToSceneMeters(
  image: readonly { x: number; y: number; z: number }[],
  opts: ImageToSceneOptions,
): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < image.length; i++) {
    const p = image[i];
    out.push(imageLandmarkToScene(p.x, p.y, p.z, opts));
  }
  return out;
}
