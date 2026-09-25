# Archived: Python WebSocket hand tracking

**Not part of the product path.** Kept only as historical reference.

This package used OpenCV + MediaPipe Hands on the host machine and streamed
landmark frames over `ws://127.0.0.1:8765` to an earlier Three.js MVP.

The current product runs hand tracking entirely in the browser via
`@mediapipe/tasks-vision` (see `web/`). Do not wire this stack back into the
main README or `web/` runtime.
