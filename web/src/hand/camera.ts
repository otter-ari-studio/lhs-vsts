export type CameraErrorKind = 'denied' | 'not_found' | 'secure_context' | 'unknown';

export interface CameraError {
  kind: CameraErrorKind;
  message: string;
}

export type CameraRequestResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; error: CameraError };

function classifyGetUserMediaError(err: unknown): CameraError {
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    return {
      kind: 'secure_context',
      message: '摄像头需要安全上下文（HTTPS 或 localhost）。',
    };
  }
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      kind: 'denied',
      message: '摄像头权限被拒绝。请在地址栏允许摄像头后重试。',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      kind: 'not_found',
      message: '未找到摄像头设备。',
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { kind: 'unknown', message: message || '无法打开摄像头。' };
}

/**
 * Request user-facing webcam (laptop top cam). Prefer facingMode user.
 */
export async function requestUserCamera(): Promise<CameraRequestResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      error: {
        kind: 'unknown',
        message: '当前环境不支持 getUserMedia。',
      },
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
    return { ok: true, stream };
  } catch (err) {
    return { ok: false, error: classifyGetUserMediaError(err) };
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
