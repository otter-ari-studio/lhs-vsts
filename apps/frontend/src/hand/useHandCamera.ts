import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { requestUserCamera, stopMediaStream, type CameraError } from "./camera";
import {
  downloadHandCaptureLog,
  handCaptureRecorder,
  HandCaptureReplayer,
  readHandCaptureFile,
  type HandCaptureLog,
} from "./captureLog";
import { HandTracker, type TrackingPresence } from "./HandTracker";
import { createHandLandmarker } from "./mediapipeLoader";

export type HandCameraPhase =
  | "idle"
  | "requesting"
  | "loading_model"
  | "tracking"
  | "denied"
  | "error";

export interface UseHandCameraResult {
  phase: HandCameraPhase;
  error: CameraError | null;
  presence: TrackingPresence;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  retry: () => void;
  /** Reset palm-size depth origin (pair with RelativeHandDriver recalibrate). */
  recalibrateDepth: () => void;
  capture: {
    recording: boolean;
    frameCount: number;
    replaying: boolean;
    startRecording: () => void;
    stopAndDownload: () => void;
    loadAndReplay: (file: File) => Promise<void>;
    stopReplay: () => void;
  };
}

/**
 * Opens user-facing camera, loads HandLandmarker, runs HandTracker → HandHub.
 * Safe when camera is missing (sets error phase; no throw into React tree).
 */
export function useHandCamera(enabled: boolean): UseHandCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const replayerRef = useRef<HandCaptureReplayer | null>(null);
  const [phase, setPhase] = useState<HandCameraPhase>("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [presence, setPresence] = useState<TrackingPresence>("none");
  const [retryToken, setRetryToken] = useState(0);
  const [replaying, setReplaying] = useState(false);

  const recording = useSyncExternalStore(
    (cb) => handCaptureRecorder.subscribe(cb),
    () => handCaptureRecorder.isRecording(),
    () => false,
  );
  const frameCount = useSyncExternalStore(
    (cb) => handCaptureRecorder.subscribe(cb),
    () => handCaptureRecorder.frameCount(),
    () => 0,
  );

  useEffect(() => {
    if (!enabled) {
      setPhase("idle");
      setPresence("none");
      return;
    }

    const trackerBox = trackerRef;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;
    let tracker: HandTracker | null = null;
    let videoEl: HTMLVideoElement | null = null;

    const run = async () => {
      setPhase("requesting");
      setError(null);
      setPresence("none");

      const cam = await requestUserCamera();
      if (cancelled) {
        if (cam.ok) stopMediaStream(cam.stream);
        return;
      }
      if (!cam.ok) {
        setError(cam.error);
        setPhase(cam.error.kind === "denied" ? "denied" : "error");
        return;
      }

      stream = cam.stream;
      const video = videoRef.current;
      if (!video) {
        setError({ kind: "unknown", message: "视频元素未就绪。" });
        setPhase("error");
        stopMediaStream(stream);
        stream = null;
        return;
      }

      videoEl = video;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        // Autoplay can fail; still try detection once frames arrive.
      }

      setPhase("loading_model");
      try {
        const created = await createHandLandmarker();
        if (cancelled) {
          created.landmarker.close();
          return;
        }
        landmarker = created.landmarker;
        tracker = new HandTracker({
          landmarker,
          video,
          onPresence: (p) => {
            if (!cancelled) setPresence(p);
          },
        });
        trackerBox.current = tracker;
        tracker.start();
        setPhase("tracking");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError({ kind: "unknown", message });
        setPhase("error");
        stopMediaStream(stream);
        stream = null;
      }
    };

    void run();

    return () => {
      cancelled = true;
      replayerRef.current?.stop();
      replayerRef.current = null;
      tracker?.stop();
      tracker = null;
      trackerBox.current = null;
      landmarker?.close();
      landmarker = null;
      if (videoEl) {
        videoEl.srcObject = null;
      }
      stopMediaStream(stream);
      stream = null;
    };
  }, [enabled, retryToken, videoRef, setPhase, setError, setPresence, trackerRef]);

  const retry = () => {
    setRetryToken((n) => n + 1);
  };

  const recalibrateDepth = useCallback(() => {
    trackerRef.current?.resetDepthCalibration();
  }, [trackerRef]);

  const startRecording = useCallback(() => {
    handCaptureRecorder.start("train-grasp-pass");
  }, []);

  const stopAndDownload = useCallback(() => {
    const log =
      handCaptureRecorder.isRecording() || handCaptureRecorder.frameCount() > 0
        ? handCaptureRecorder.isRecording()
          ? handCaptureRecorder.stop()
          : handCaptureRecorder.buildLog()
        : null;
    if (!log || log.frames.length === 0) return;
    downloadHandCaptureLog(log);
  }, []);

  const stopReplay = useCallback(() => {
    replayerRef.current?.stop();
    replayerRef.current = null;
    trackerRef.current?.setPublishEnabled(true);
    setReplaying(false);
  }, [trackerRef]);

  const loadAndReplay = useCallback(
    async (file: File) => {
      const log: HandCaptureLog = await readHandCaptureFile(file);
      stopReplay();
      trackerRef.current?.setPublishEnabled(false);
      setReplaying(true);
      setPresence(log.frames.some((f) => f.hands.length >= 2) ? "both" : "partial");
      const replayer = new HandCaptureReplayer(log, {
        onDone: () => {
          stopReplay();
        },
      });
      replayerRef.current = replayer;
      replayer.start();
    },
    [stopReplay, trackerRef],
  );

  return {
    phase,
    error,
    presence,
    videoRef,
    retry,
    recalibrateDepth,
    capture: {
      recording,
      frameCount,
      replaying,
      startRecording,
      stopAndDownload,
      loadAndReplay,
      stopReplay,
    },
  };
}
