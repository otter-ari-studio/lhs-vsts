import { useEffect, useRef, useState } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { requestUserCamera, stopMediaStream, type CameraError } from './camera';
import { HandTracker, type TrackingPresence } from './HandTracker';
import { createHandLandmarker } from './mediapipeLoader';

export type HandCameraPhase =
  | 'idle'
  | 'requesting'
  | 'loading_model'
  | 'tracking'
  | 'denied'
  | 'error';

export interface UseHandCameraResult {
  phase: HandCameraPhase;
  error: CameraError | null;
  presence: TrackingPresence;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  retry: () => void;
}

/**
 * Opens user-facing camera, loads HandLandmarker, runs HandTracker → HandHub.
 * Safe when camera is missing (sets error phase; no throw into React tree).
 */
export function useHandCamera(enabled: boolean): UseHandCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [phase, setPhase] = useState<HandCameraPhase>('idle');
  const [error, setError] = useState<CameraError | null>(null);
  const [presence, setPresence] = useState<TrackingPresence>('none');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setPhase('idle');
      setPresence('none');
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;
    let tracker: HandTracker | null = null;
    let videoEl: HTMLVideoElement | null = null;

    const run = async () => {
      setPhase('requesting');
      setError(null);
      setPresence('none');

      const cam = await requestUserCamera();
      if (cancelled) {
        if (cam.ok) stopMediaStream(cam.stream);
        return;
      }
      if (!cam.ok) {
        setError(cam.error);
        setPhase(cam.error.kind === 'denied' ? 'denied' : 'error');
        return;
      }

      stream = cam.stream;
      const video = videoRef.current;
      if (!video) {
        setError({ kind: 'unknown', message: '视频元素未就绪。' });
        setPhase('error');
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

      setPhase('loading_model');
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
        tracker.start();
        setPhase('tracking');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError({ kind: 'unknown', message });
        setPhase('error');
        stopMediaStream(stream);
        stream = null;
      }
    };

    void run();

    return () => {
      cancelled = true;
      tracker?.stop();
      tracker = null;
      landmarker?.close();
      landmarker = null;
      if (videoEl) {
        videoEl.srcObject = null;
      }
      stopMediaStream(stream);
      stream = null;
    };
  }, [enabled, retryToken]);

  const retry = () => {
    setRetryToken((n) => n + 1);
  };

  return { phase, error, presence, videoRef, retry };
}
