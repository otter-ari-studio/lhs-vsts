/**
 * MediaPipe Tasks Vision — HandLandmarker loader.
 *
 * WASM strategy: local `/mediapipe/` only (copied from node_modules at build via
 * rsbuild). No CDN fallback — intranet / offline deployments must not hit jsDelivr.
 *
 * Model: vendored at `/models/hand_landmarker.task` under `public/`.
 * Never use `@latest` — pin the package version.
 */

import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarker as HandLandmarkerType,
} from "@mediapipe/tasks-vision";

/** Must match `package.json` dependency `@mediapipe/tasks-vision`. */
export const MEDIAPIPE_VERSION = "1.0.1";

/** Local static path (rsbuild copies wasm here). */
export const MEDIAPIPE_WASM_LOCAL = "/mediapipe";

/** Preferred base used by docs / tests. */
export const MEDIAPIPE_WASM_BASE = MEDIAPIPE_WASM_LOCAL;

/** Vendored float16 hand landmarker model (same-origin static file). */
export const HAND_LANDMARKER_MODEL = "/models/hand_landmarker.task";

export type MediapipeLoadState = "idle" | "loading" | "ready" | "error";

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
 * Uses local wasm only; tries GPU then CPU delegate.
 */
export async function createHandLandmarker(): Promise<CreateHandLandmarkerResult> {
  const bases = [MEDIAPIPE_WASM_LOCAL];
  const delegates: Array<"GPU" | "CPU"> = ["GPU", "CPU"];
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
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        return { landmarker, wasmBase };
      } catch (err) {
        lastError = err;
        console.warn(`[mediapipe] failed to load from ${wasmBase} (${delegate})`, err);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`HandLandmarker init failed: ${message}`);
}

/** Lightweight readiness probe (import + path docs). */
export async function ensureMediapipeVisionReady(): Promise<MediapipeLoaderStatus> {
  try {
    await import("@mediapipe/tasks-vision");
    return {
      state: "ready",
      detail: `WASM local=${MEDIAPIPE_WASM_LOCAL}; model=${HAND_LANDMARKER_MODEL}`,
      wasmBase: MEDIAPIPE_WASM_BASE,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { state: "error", detail: message };
  }
}
