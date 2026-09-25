import { buildMapMatrix, mapPointTuple, mapRotationTuple } from './axisMap';
import { handDataHub } from './HandDataHub';
import { parseHandFrame, type HandSample } from './protocol';
import { WS_URL } from './defaults';

export type SocketStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface HandSocketOptions {
  url?: string;
  onStatus?: (status: SocketStatus) => void;
  onHandCount?: (count: number) => void;
}

/**
 * Connect to Python WsSender; publish mapped samples into handDataHub.
 * Empty `hands` arrays intentionally do not clear the hub (stale-hide in driver).
 */
export function connectHandSocket(options: HandSocketOptions = {}): () => void {
  const url = options.url ?? WS_URL;
  const map = buildMapMatrix();
  let ws: WebSocket | null = null;
  let closed = false;
  let retryMs = 500;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (s: SocketStatus) => options.onStatus?.(s);

  const scheduleReconnect = () => {
    if (closed) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 1.5, 5000);
  };

  const connect = () => {
    if (closed) return;
    setStatus('connecting');
    try {
      ws = new WebSocket(url);
    } catch {
      setStatus('error');
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      retryMs = 500;
      setStatus('open');
    };

    ws.onclose = () => {
      setStatus('closed');
      scheduleReconnect();
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onmessage = (ev) => {
      let raw: unknown;
      try {
        raw = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      const frame = parseHandFrame(raw);
      if (!frame) return;
      options.onHandCount?.(frame.hands.length);
      for (const h of frame.hands) {
        const pos = mapPointTuple(h.pos, map);
        const rot = mapRotationTuple(h.rot, map);
        let landmarks: HandSample['landmarks'] = null;
        if (h.lms && h.lms.length === 21) {
          landmarks = h.lms.map((p) => mapPointTuple(p, map));
        }
        handDataHub.publish({
          handId: h.id === 1 ? 1 : 0,
          position: pos,
          rotation: rot,
          pinching: h.pinch > 0,
          timestamp: frame.t,
          landmarks,
        });
      }
    };
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    ws?.close();
    setStatus('closed');
  };
}
