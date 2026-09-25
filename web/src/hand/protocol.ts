/** Hand tracking protocol shared with Python `ws_sender` (former UDP payload). */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // x,y,z,w

export interface HandPayload {
  id: number;
  pinch: number;
  pos: Vec3;
  rot: Quat;
  lms?: Vec3[];
}

export interface HandFrame {
  t: number;
  hands: HandPayload[];
}

export interface HandSample {
  handId: number;
  position: Vec3;
  rotation: Quat;
  pinching: boolean;
  timestamp: number;
  landmarks: Vec3[] | null;
}

export const JOINT_COUNT = 21;

/** MediaPipe HAND_CONNECTIONS */
export const HAND_CONNECTIONS: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17],
] as const;

export function parseHandFrame(raw: unknown): HandFrame | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.t !== 'number' || !Array.isArray(obj.hands)) return null;
  const hands: HandPayload[] = [];
  for (const h of obj.hands) {
    if (!h || typeof h !== 'object') continue;
    const hand = h as Record<string, unknown>;
    if (typeof hand.id !== 'number') continue;
    if (!isVec3(hand.pos) || !isQuat(hand.rot)) continue;
    let lms: Vec3[] | undefined;
    if (Array.isArray(hand.lms) && hand.lms.length === JOINT_COUNT) {
      const parsed: Vec3[] = [];
      let ok = true;
      for (const p of hand.lms) {
        if (!isVec3(p)) {
          ok = false;
          break;
        }
        parsed.push(p);
      }
      if (ok) lms = parsed;
    }
    hands.push({
      id: hand.id,
      pinch: typeof hand.pinch === 'number' ? hand.pinch : 0,
      pos: hand.pos,
      rot: hand.rot,
      lms,
    });
  }
  return { t: obj.t, hands };
}

function isVec3(v: unknown): v is Vec3 {
  return (
    Array.isArray(v) &&
    v.length >= 3 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number'
  );
}

function isQuat(v: unknown): v is Quat {
  return (
    Array.isArray(v) &&
    v.length >= 4 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number' &&
    typeof v[3] === 'number'
  );
}
