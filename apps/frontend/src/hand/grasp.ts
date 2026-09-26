import { distance3, updatePinchStateConfirmed } from "./pinch";
import type { Vec3 } from "./types";

/** MediaPipe: wrist, middle MCP, finger tips. */
const WRIST = 0;
const MIDDLE_MCP = 9;
const FINGER_TIPS = [8, 12, 16, 20] as const;

/**
 * Finger openness: mean(wrist→tip) / (wrist→middleMCP).
 * Lower = more closed (fist / grasp). Typical open ~2.0–2.6, light curl ~1.5–1.9, fist ~0.6–1.2.
 */
export function fingerOpenRatio(landmarks: readonly Vec3[]): number {
  if (landmarks.length < 21) return 2.4;
  const wrist = landmarks[WRIST]!;
  const mcp = landmarks[MIDDLE_MCP]!;
  const palm = distance3(wrist, mcp);
  if (palm < 1e-5) return 2.4;
  let sum = 0;
  for (const tip of FINGER_TIPS) {
    sum += distance3(wrist, landmarks[tip]!);
  }
  return sum / FINGER_TIPS.length / palm;
}

/** Enter grasp when openRatio ≤ ON; leave when ≥ OFF (same Schmitt helper as pinch). */
export function updateGraspStateConfirmed(
  wasGrasping: boolean,
  openRatio: number,
  onRatio: number,
  offRatio: number,
  pendingCount: number,
  confirmFrames: number,
): { grasping: boolean; pendingCount: number } {
  const { pinching, pendingCount: next } = updatePinchStateConfirmed(
    wasGrasping,
    openRatio,
    onRatio,
    offRatio,
    pendingCount,
    confirmFrames,
  );
  return { grasping: pinching, pendingCount: next };
}
