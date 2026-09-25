"""Central configuration for hand-tracking WebSocket sender.

All calibration knobs live here so the Three.js client can tune axis mapping
and relative drive without Python applying world transforms by default.
"""

# ---------------------------------------------------------------------------
# WebSocket (browser client connects here)
# ---------------------------------------------------------------------------
WS_HOST = "127.0.0.1"
WS_PORT = 8765

# ---------------------------------------------------------------------------
# Capture / loop
# ---------------------------------------------------------------------------
CAMERA_INDEX = 0
TARGET_FPS = 30
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# ---------------------------------------------------------------------------
# MediaPipe Hands
# ---------------------------------------------------------------------------
MP_STATIC_IMAGE_MODE = False
MP_MAX_NUM_HANDS = 2
MP_MODEL_COMPLEXITY = 1  # 0=lite, 1=full
# Slightly more forgiving to reduce intermittent dropouts.
MP_MIN_DETECTION_CONFIDENCE = 0.5
MP_MIN_TRACKING_CONFIDENCE = 0.4

# Mirror preview horizontally (selfie-style). Handedness labels follow image space.
FLIP_HORIZONTAL = True

# ---------------------------------------------------------------------------
# Pinch (thumb tip ↔ index tip, MediaPipe world/normalized 3D space)
# ---------------------------------------------------------------------------
PINCH_DISTANCE_THRESHOLD = 0.05

# ---------------------------------------------------------------------------
# Coordinate transform: MediaPipe normalized → world (meters)
#
# ONLY used when LMS_RAW_CAPTURE_SPACE=False (Python applies POS_* itself).
# Default desk + top-webcam path keeps LMS_RAW_CAPTURE_SPACE=True so pos/lms/rot
# stay in MediaPipe capture space; the web client maps axes then relative-drives
# from default rest poses (same contract as the former Unity receiver).
#
# pipeline (non-raw only):
#   1) optional axis remap (MediaPipe → Three.js-like Y-up)
#   2) scale
#   3) translation offset
# ---------------------------------------------------------------------------
POS_SCALE = [1.2, 1.2, 1.2]
POS_AXIS_REMAP = [0, -1, -2]
POS_OFFSET = [0.0, 1.2, 0.5]

# ---------------------------------------------------------------------------
# One-pole low-pass filter: out = alpha * new + (1 - alpha) * prev
# Larger alpha → less smoothing / more responsive.
# Lower values = smoother follow (less jitter).
# ---------------------------------------------------------------------------
LPF_POS_ALPHA = 0.22
LPF_ROT_ALPHA = 0.18
LPF_LMS_ALPHA = 0.20  # 21 landmarks

# When MediaPipe briefly loses a hand, keep broadcasting the last good frame
# for this many seconds so the web skeleton does not flicker off.
HAND_HOLD_SECONDS = 0.85

# Include full 21 MediaPipe landmarks per hand in JSON as "lms".
# Protocol: pos MUST equal lms[0] in the same coordinate space.
SEND_LANDMARKS = True
# True (default): pos/lms/rot in MediaPipe capture space; web maps axes.
# False: Python applies mediapipe_to_unity-style POS_*; web axis map should be identity.
LMS_RAW_CAPTURE_SPACE = True
