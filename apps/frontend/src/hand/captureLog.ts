import type { HandId, HandSample, Quat, Vec3 } from "./types";
import { JOINT_COUNT } from "./types";
import { HAND_Z_FAR, HAND_Z_NEAR } from "./defaults";
import { SCREEN_WORKSPACE } from "./screenMap";
import { handHub } from "./HandHub";

export const HAND_CAPTURE_LOG_VERSION = 1 as const;

export interface HandCaptureHandFrame {
  handId: HandId;
  label: string;
  /** Raw MediaPipe image landmarks (x,y ∈ [0,1], z wrist-relative). */
  image: Vec3[];
  /** Raw world landmarks (meters), if available. */
  world: Vec3[] | null;
  palmRaw: number;
  palmEma: number;
  originPalm: number;
  reachZ: number;
  sceneWrist: Vec3;
  /** Scene-space 21 joints after screen map (what the glove used). */
  sceneLandmarks: Vec3[];
  rotation: Quat;
  pinching: boolean;
  pinchDist: number;
}

export interface HandCaptureFrame {
  /** ms since recording start */
  t: number;
  hands: HandCaptureHandFrame[];
}

export interface HandCaptureLog {
  version: typeof HAND_CAPTURE_LOG_VERSION;
  createdAt: string;
  meta: {
    workspaceCenter: Vec3;
    workspaceWidth: number;
    workspaceHeight: number;
    handZNear: number;
    handZFar: number;
    note?: string;
  };
  frames: HandCaptureFrame[];
}

const MAX_FRAMES = 12_000;

type Listener = () => void;

function cloneHandFrame(h: HandCaptureHandFrame): HandCaptureHandFrame {
  return {
    ...h,
    image: h.image.map((p) => [...p] as Vec3),
    world: h.world ? h.world.map((p) => [...p] as Vec3) : null,
    sceneWrist: [...h.sceneWrist] as Vec3,
    sceneLandmarks: h.sceneLandmarks.map((p) => [...p] as Vec3),
    rotation: [...h.rotation] as Quat,
  };
}

/**
 * Records HandTracker frames (raw + derived) for offline replay / diagnosis.
 */
class HandCaptureRecorderImpl {
  private recording = false;
  private t0 = 0;
  private frames: HandCaptureFrame[] = [];
  private note: string | undefined;
  private readonly listeners = new Set<Listener>();

  isRecording(): boolean {
    return this.recording;
  }

  frameCount(): number {
    return this.frames.length;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  start(note?: string): void {
    this.recording = true;
    this.t0 = performance.now();
    this.frames = [];
    this.note = note;
    this.notify();
  }

  stop(): HandCaptureLog {
    this.recording = false;
    const log = this.buildLog();
    this.notify();
    return log;
  }

  clear(): void {
    this.recording = false;
    this.frames = [];
    this.note = undefined;
    this.notify();
  }

  append(hands: HandCaptureHandFrame[]): void {
    if (!this.recording) return;
    if (this.frames.length >= MAX_FRAMES) return;
    this.frames.push({
      t: performance.now() - this.t0,
      hands: hands.map(cloneHandFrame),
    });
    if (this.frames.length % 15 === 0) this.notify();
  }

  buildLog(): HandCaptureLog {
    return {
      version: HAND_CAPTURE_LOG_VERSION,
      createdAt: new Date().toISOString(),
      meta: {
        workspaceCenter: [...SCREEN_WORKSPACE.center] as Vec3,
        workspaceWidth: SCREEN_WORKSPACE.width,
        workspaceHeight: SCREEN_WORKSPACE.height,
        handZNear: HAND_Z_NEAR,
        handZFar: HAND_Z_FAR,
        note: this.note,
      },
      frames: this.frames.map((f) => ({
        t: f.t,
        hands: f.hands.map(cloneHandFrame),
      })),
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const handCaptureRecorder = new HandCaptureRecorderImpl();

export function downloadHandCaptureLog(log: HandCaptureLog, filename?: string): void {
  const name = filename ?? `hand-capture-${log.createdAt.replace(/[:.]/g, "-").slice(0, 19)}.json`;
  const blob = new Blob([JSON.stringify(log)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseHandCaptureLog(raw: unknown): HandCaptureLog {
  if (!raw || typeof raw !== "object") {
    throw new Error("手部日志格式无效");
  }
  const obj = raw as HandCaptureLog;
  if (obj.version !== HAND_CAPTURE_LOG_VERSION || !Array.isArray(obj.frames)) {
    throw new Error("手部日志版本或 frames 无效");
  }
  return obj;
}

export async function readHandCaptureFile(file: File): Promise<HandCaptureLog> {
  const text = await file.text();
  return parseHandCaptureLog(JSON.parse(text) as unknown);
}

/**
 * Replays a capture log into HandHub at recorded timing.
 * Live HandTracker should be muted while this runs.
 */
export class HandCaptureReplayer {
  private raf = 0;
  private running = false;
  private t0 = 0;
  private idx = 0;
  private readonly log: HandCaptureLog;
  private readonly onDone?: () => void;

  constructor(log: HandCaptureLog, opts?: { onDone?: () => void }) {
    this.log = log;
    this.onDone = opts?.onDone;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.t0 = performance.now();
    this.idx = 0;
    handHub.clearAll();
    const loop = () => {
      if (!this.running) return;
      const elapsed = performance.now() - this.t0;
      const frames = this.log.frames;
      while (this.idx < frames.length && frames[this.idx].t <= elapsed) {
        this.publishFrame(frames[this.idx], elapsed);
        this.idx += 1;
      }
      if (this.idx >= frames.length) {
        this.stop();
        this.onDone?.();
        return;
      }
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
  }

  isRunning(): boolean {
    return this.running;
  }

  private publishFrame(frame: HandCaptureFrame, now: number): void {
    const seen: [boolean, boolean] = [false, false];
    for (const h of frame.hands) {
      if (h.sceneLandmarks.length < JOINT_COUNT) continue;
      const sample: HandSample = {
        handId: h.handId,
        position: [...h.sceneWrist] as Vec3,
        rotation: [...h.rotation] as Quat,
        pinching: h.pinching,
        timestamp: now,
        landmarks: h.sceneLandmarks.map((p) => [...p] as Vec3),
      };
      handHub.publish(sample);
      seen[h.handId] = true;
    }
    for (const id of [0, 1] as const) {
      if (!seen[id]) handHub.clear(id);
    }
  }
}

export function landmarkListToVec3(
  list: { x: number; y: number; z: number }[] | undefined,
): Vec3[] | null {
  if (!list || list.length < JOINT_COUNT) return null;
  const out: Vec3[] = [];
  for (let i = 0; i < JOINT_COUNT; i++) {
    const p = list[i];
    out.push([p.x, p.y, p.z]);
  }
  return out;
}
