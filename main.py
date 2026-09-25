"""Main loop: camera → hand process → UDP JSON → Unity (127.0.0.1:9999)."""

from __future__ import annotations

import time
import warnings

import config as cfg
from hand_processor import HandProcessor
from udp_sender import UdpSender

try:
    import cv2
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing opencv-python. Install with: uv sync"
    ) from exc


WINDOW_NAME = "Hand Tracking → Unity UDP"


def _log_hands(hands: list) -> None:
    if not hands:
        print("[hands] count=0 (no detection)")
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
    print(f"[hands] count={len(hands)} | " + " | ".join(parts))


def main() -> None:
    processor = HandProcessor()
    sender = UdpSender(cfg.UDP_HOST, cfg.UDP_PORT)
    paused = False
    min_dt = 1.0 / max(cfg.TARGET_FPS, 1)
    last_send = 0.0

    if not processor.open_camera():
        warnings.warn(
            "Camera open failed at startup; will keep retrying each loop.",
            stacklevel=1,
        )

    print(
        f"UDP → {cfg.UDP_HOST}:{cfg.UDP_PORT} @ ≤{cfg.TARGET_FPS} fps | "
        "SPACE=pause  q=quit"
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
                # Still pump window events; skip capture/send
                time.sleep(min_dt)
                continue

            frame = processor.read_frame()
            if frame is None:
                time.sleep(min_dt)
                continue

            hands, annotated = processor.process_frame(frame)
            _log_hands(hands)

            now = time.time()
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
