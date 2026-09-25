/**
 * MediaPipe Tasks Vision — HandLandmarker loader.
 *
 * WASM strategy:
 * 1. Prefer `/mediapipe/` (copied from node_modules at build via rsbuild).
 * 2. Fall back to the official CDN locateFile pinned to MEDIAPIPE_VERSION.
 *
 * Never use `@latest` — pin the package version.
 */

import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarker as HandLandmarkerType,
} from '@mediapipe/tasks-vision';

/** Must match `package.json` dependency `@mediapipe/tasks-vision`. */
export const MEDIAPIPE_VERSION = '1.0.1';

/** Local static path (rsbuild copies wasm here). */
export const MEDIAPIPE_WASM_LOCAL = '/mediapipe';

/** Pinned CDN fallback — version must match MEDIAPIPE_VERSION. */
export const MEDIAPIPE_WASM_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

/** Preferred base used by docs / tests (local first). */
export const MEDIAPIPE_WASM_BASE = MEDIAPIPE_WASM_LOCAL;

/** Official float16 hand landmarker model (stable URL, not @latest). */
export const HAND_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type MediapipeLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface MediapipeLoaderStatus {
  state: MediapipeLoadState;
  detail?: string;
  wasmBase?: string;
}

export interface CreateHandLandmarkerResult {
  landmarker: HandLandmarkerType;
  wasmBase: string;
}

async function resolveVisionFileset(wasmBase: string) {
  return FilesetResolver.forVisionTasks(wasmBase);
}

/**
 * Create a VIDEO-mode HandLandmarker for up to 2 hands.
 * Tries local wasm then pinned CDN; GPU then CPU delegate.
 */
export async function createHandLandmarker(): Promise<CreateHandLandmarkerResult> {
  const bases = [MEDIAPIPE_WASM_LOCAL, MEDIAPIPE_WASM_CDN];
  const delegates: Array<'GPU' | 'CPU'> = ['GPU', 'CPU'];
  let lastError: unknown;

  for (const wasmBase of bases) {
    for (const delegate of delegates) {
      try {
        const vision = await resolveVisionFileset(wasmBase);
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_LANDMARKER_MODEL,
            delegate,
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        return { landmarker, wasmBase };
      } catch (err) {
        lastError = err;
        console.warn(
          `[mediapipe] failed to load from ${wasmBase} (${delegate})`,
          err,
        );
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`HandLandmarker init failed: ${message}`);
}

/** Lightweight readiness probe (import + path docs). */
export async function ensureMediapipeVisionReady(): Promise<MediapipeLoaderStatus> {
  try {
    await import('@mediapipe/tasks-vision');
    return {
      state: 'ready',
      detail: `WASM local=${MEDIAPIPE_WASM_LOCAL}; CDN=${MEDIAPIPE_WASM_CDN}`,
      wasmBase: MEDIAPIPE_WASM_BASE,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { state: 'error', detail: message };
  }
}
