"""UDP JSON sender for Unity hand receiver."""

from __future__ import annotations

import json
import socket
import warnings
from typing import Any, Dict


class UdpSender:
    """Fire-and-forget UDP JSON sender. Network errors never crash the app."""

    def __init__(self, host: str, port: int) -> None:
        self._addr = (host, port)
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setblocking(False)

    def send_json(self, payload: Dict[str, Any]) -> bool:
        """Serialize *payload* as UTF-8 JSON and send. Returns True on success."""
        try:
            data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(
                "utf-8"
            )
            self._sock.sendto(data, self._addr)
            return True
        except OSError as exc:
            warnings.warn(f"UDP send failed ({self._addr}): {exc}", stacklevel=2)
            return False
        except (TypeError, ValueError) as exc:
            warnings.warn(f"UDP JSON encode failed: {exc}", stacklevel=2)
            return False

    def close(self) -> None:
        try:
            self._sock.close()
        except OSError:
            pass
