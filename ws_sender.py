"""WebSocket JSON broadcaster for the Three.js web client."""

from __future__ import annotations

import asyncio
import json
import threading
import warnings
from typing import Any, Dict, Optional, Set

try:
    import websockets
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing websockets. Install with: uv sync  (or pip install websockets)"
    ) from exc


class WsSender:
    """Background WebSocket server; main thread fire-and-forget broadcasts JSON."""

    def __init__(self, host: str, port: int) -> None:
        self._host = host
        self._port = port
        self._clients: Set[Any] = set()
        self._loop = asyncio.new_event_loop()
        self._thread: Optional[threading.Thread] = None
        self._server = None
        self._ready = threading.Event()
        self._closing = False

    def start(self) -> None:
        self._thread = threading.Thread(
            target=self._run_loop, name="ws-hand-sender", daemon=True
        )
        self._thread.start()
        if not self._ready.wait(timeout=5.0):
            warnings.warn(
                f"WebSocket server failed to become ready on {self._host}:{self._port}",
                stacklevel=2,
            )

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._start_server())
            self._ready.set()
            self._loop.run_forever()
        except OSError as exc:
            warnings.warn(
                f"WebSocket bind failed ({self._host}:{self._port}): {exc}",
                stacklevel=1,
            )
            self._ready.set()
        finally:
            try:
                self._loop.run_until_complete(self._loop.shutdown_asyncgens())
            except Exception:
                pass

    async def _start_server(self) -> None:
        self._server = await websockets.serve(
            self._handler,
            self._host,
            self._port,
            ping_interval=20,
            ping_timeout=20,
        )
        print(f"[ws] listening on ws://{self._host}:{self._port}")

    async def _handler(self, websocket: Any, path: Any = None) -> None:
        del path  # websockets<13 still passes path
        self._clients.add(websocket)
        print(f"[ws] client connected ({len(self._clients)} total)")
        try:
            await websocket.wait_closed()
        finally:
            self._clients.discard(websocket)
            print(f"[ws] client disconnected ({len(self._clients)} total)")

    def send_json(self, payload: Dict[str, Any]) -> bool:
        """Serialize *payload* as UTF-8 JSON and broadcast. Returns True if queued."""
        if self._closing or not self._ready.is_set() or self._server is None:
            return False
        if not self._clients:
            return False
        try:
            data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        except (TypeError, ValueError) as exc:
            warnings.warn(f"WS JSON encode failed: {exc}", stacklevel=2)
            return False
        try:
            asyncio.run_coroutine_threadsafe(self._broadcast(data), self._loop)
            return True
        except RuntimeError as exc:
            warnings.warn(f"WS broadcast schedule failed: {exc}", stacklevel=2)
            return False

    async def _broadcast(self, data: str) -> None:
        dead: list[Any] = []
        for ws in list(self._clients):
            try:
                await ws.send(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._clients.discard(ws)

    def close(self) -> None:
        self._closing = True
        if not self._loop.is_running():
            return

        async def _shutdown() -> None:
            for ws in list(self._clients):
                try:
                    await ws.close()
                except Exception:
                    pass
            self._clients.clear()
            if self._server is not None:
                self._server.close()
                await self._server.wait_closed()

        try:
            fut = asyncio.run_coroutine_threadsafe(_shutdown(), self._loop)
            fut.result(timeout=2.0)
        except Exception as exc:
            warnings.warn(f"WS shutdown: {exc}", stacklevel=2)
        self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread is not None:
            self._thread.join(timeout=2.0)
