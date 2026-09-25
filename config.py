"""Central configuration for hand-tracking UDP sender.

All calibration knobs live here so Unity world mapping can be tuned without
touching processing or protocol code.
"""

# ---------------------------------------------------------------------------
# UDP
# ---------------------------------------------------------------------------
UDP_HOST = "127.0.0.1"
UDP_PORT = 9999

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
MP_MIN_DETECTION_CONFIDENCE = 0.6
MP_MIN_TRACKING_CONFIDENCE = 0.5

# Mirror preview horizontally (selfie-style). Handedness labels follow image space.
FLIP_HORIZONTAL = True

# ---------------------------------------------------------------------------
# Pinch (thumb tip ↔ index tip, MediaPipe world/normalized 3D space)
# ---------------------------------------------------------------------------
PINCH_DISTANCE_THRESHOLD = 0.05

# ---------------------------------------------------------------------------
# Coordinate transform: MediaPipe normalized → Unity world (meters)
#
# ONLY used when LMS_RAW_CAPTURE_SPACE=False (Python applies POS_* itself).
# Default desk + top-webcam path keeps LMS_RAW_CAPTURE_SPACE=True so pos/lms/rot
# stay in MediaPipe capture space; Unity UdpHandDataReceiver MapPoint/MapRotation
# remaps axes. VirtualHandDriver then does relative drive from default rest pose.
#
# pipeline (non-raw only):
#   1) optional axis remap (MediaPipe → Unity)
#   2) scale
#   3) translation offset
#
# MediaPipe image landmarks: x right, y down, z toward camera (approx).
# Unity typical: x right, y up, z forward. Default remap flips Y and Z.
# ---------------------------------------------------------------------------
# Multiply each MediaPipe axis before remap: [sx, sy, sz]
POS_SCALE = [1.2, 1.2, 1.2]
# Axis remap: index into MediaPipe [x, y, z]; negative index = negate that axis.
# Example [0, -1, -2] → Unity(x, -y, -z)
POS_AXIS_REMAP = [0, -1, -2]
# Translation in Unity meters after scale/remap
POS_OFFSET = [0.0, 1.2, 0.5]

# ---------------------------------------------------------------------------
# One-pole low-pass filter: out = alpha * new + (1 - alpha) * prev
# Larger alpha → less smoothing / more responsive.
# ---------------------------------------------------------------------------
LPF_POS_ALPHA = 0.35
LPF_ROT_ALPHA = 0.30
LPF_LMS_ALPHA = 0.35  # 21 landmarks

# Include full 21 MediaPipe landmarks per hand in UDP JSON as "lms".
# Protocol: pos MUST equal lms[0] in the same coordinate space.
SEND_LANDMARKS = True
# True (default, Unity delivery): pos/lms/rot in MediaPipe capture space;
#   do NOT apply POS_*; Unity maps axes then relative-drives from defaultPose.
# False: Python applies mediapipe_to_unity to pos/lms/rot; Unity axis map
#   should be identity to avoid double remap.
LMS_RAW_CAPTURE_SPACE = True
