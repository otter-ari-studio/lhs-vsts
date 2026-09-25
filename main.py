"""Main loop: camera → hand process → WebSocket JSON → lhs-vsts/web."""

from __future__ import annotations

import copy
import time
import warnings

import config as cfg
from hand_processor import HandProcessor
from ws_sender import WsSender

try:
    import cv2
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing opencv-python. Install with: uv sync"
    ) from exc


WINDOW_NAME = "Hand Tracking → Web WS"


def _log_hands(hands: list, *, held: bool = False) -> None:
    tag = "hold" if held else "live"
    if not hands:
        print(f"[hands/{tag}] count=0 (no detection)")
        return
    parts = []
    for h in hands:
        side = "L" if h["id"] == 0 else "R"
        pos = h["pos"]
        n_lms = len(h.get("lms", []))
        parts.append(
            f"{side}(id={h['id']} pinch={h['pinch']} "
            f"pos=[{pos[0]:.3f},{pos[1]:.3f},{pos[2]:.3f}] lms={n_lms})"
        )
    print(f"[hands/{tag}] count={len(hands)} | " + " | ".join(parts))


def main() -> None:
    processor = HandProcessor()
    sender = WsSender(cfg.WS_HOST, cfg.WS_PORT)
    sender.start()
    paused = False
    min_dt = 1.0 / max(cfg.TARGET_FPS, 1)
    last_send = 0.0
    last_good_hands: list = []
    last_good_at = 0.0
    hold_s = float(getattr(cfg, "HAND_HOLD_SECONDS", 0.85))

    if not processor.open_camera():
        warnings.warn(
            "Camera open failed at startup; will keep retrying each loop.",
            stacklevel=1,
        )

    print(
        f"WS → ws://{cfg.WS_HOST}:{cfg.WS_PORT} @ ≤{cfg.TARGET_FPS} fps | "
        f"hold={hold_s}s | SPACE=pause  q=quit"
    )

    try:
        while True:
            loop_start = time.time()

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord(" "):
                paused = not paused
                print("[ctrl] paused" if paused else "[ctrl] resumed")

            if paused:
                time.sleep(min_dt)
                continue

            frame = processor.read_frame()
            if frame is None:
                time.sleep(min_dt)
                continue

            hands, annotated = processor.process_frame(frame)
            now = time.time()
            held = False
            if hands:
                last_good_hands = copy.deepcopy(hands)
                last_good_at = now
            elif last_good_hands and (now - last_good_at) <= hold_s:
                # Brief dropout: keep streaming last pose with fresh timestamp
                # so the web client does not flicker the skeleton off.
                hands = copy.deepcopy(last_good_hands)
                held = True
            else:
                hands = []
                last_good_hands = []

            _log_hands(hands, held=held)

            if now - last_send >= min_dt:
                payload = {"t": now, "hands": hands}
                sender.send_json(payload)
                last_send = now

            cv2.imshow(WINDOW_NAME, annotated)

            elapsed = time.time() - loop_start
            sleep_for = min_dt - elapsed
            if sleep_for > 0:
                time.sleep(sleep_for)
    finally:
        processor.close()
        sender.close()
        cv2.destroyAllWindows()
        print("Exited cleanly.")


if __name__ == "__main__":
    main()
