"""Hand tracking processor: MediaPipe Hands → Unity hand frame dicts.

Wrist world position is obtained through :class:`WristPositionProvider` so a
future binocular retro-reflective marker module can replace only ``pos`` while
reusing pinch detection and the UDP payload shape.
"""

from __future__ import annotations

import math
import warnings
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Sequence, Tuple

import config as cfg

try:
    import cv2
    import mediapipe as mp
    import numpy as np
except ImportError as exc:  # pragma: no cover - import-time guidance
    raise SystemExit(
        "Missing dependency. Install with: uv sync  (or pip install -r requirements.txt)"
    ) from exc


# MediaPipe landmark indices
_WRIST = 0
_THUMB_TIP = 4
_INDEX_MCP = 5
_INDEX_TIP = 8
_MIDDLE_MCP = 9
_PINKY_MCP = 17

_Handedness = str  # "Left" | "Right"


# ---------------------------------------------------------------------------
# Wrist position providers (swappable)
# ---------------------------------------------------------------------------


class WristPositionProvider(ABC):
    """Abstract wrist position source in Unity world meters."""

    @abstractmethod
    def get_wrist_pos(
        self,
        landmarks: Sequence[Any],
        handedness: _Handedness,
        image_size: Tuple[int, int],
    ) -> List[float]:
        """Return ``[x, y, z]`` in Unity meters."""


class MediaPipeWristProvider(WristPositionProvider):
    """Wrist position from MediaPipe; space follows ``LMS_RAW_CAPTURE_SPACE``."""

    def get_wrist_pos(
        self,
        landmarks: Sequence[Any],
        handedness: _Handedness,
        image_size: Tuple[int, int],
    ) -> List[float]:
        del handedness, image_size  # reserved for per-hand / pixel calibrations
        lm = landmarks[_WRIST]
        raw = [float(lm.x), float(lm.y), float(lm.z)]
        # Protocol: pos == lms[0]. In raw mode keep MediaPipe capture space so
        # Unity MapPoint + relative drive stay consistent with lms.
        if cfg.LMS_RAW_CAPTURE_SPACE:
            return raw
        return mediapipe_to_unity(raw)


def mediapipe_to_unity(xyz: Sequence[float]) -> List[float]:
    """Apply axis remap, scale, then offset from :mod:`config`."""
    src = [float(xyz[0]), float(xyz[1]), float(xyz[2])]
    remapped: List[float] = []
    for axis in cfg.POS_AXIS_REMAP:
        sign = 1.0 if axis >= 0 else -1.0
        remapped.append(sign * src[abs(axis)])
    scaled = [remapped[i] * cfg.POS_SCALE[i] for i in range(3)]
    return [scaled[i] + cfg.POS_OFFSET[i] for i in range(3)]


# ---------------------------------------------------------------------------
# Math helpers
# ---------------------------------------------------------------------------


def _lm_vec(landmarks: Sequence[Any], idx: int) -> np.ndarray:
    lm = landmarks[idx]
    return np.array([lm.x, lm.y, lm.z], dtype=np.float64)


def _safe_normalize(v: np.ndarray, fallback: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    if n < 1e-8:
        return fallback.copy()
    return v / n


def rotation_matrix_to_quaternion(rm: np.ndarray) -> List[float]:
    """Convert 3x3 rotation matrix to quaternion ``[x, y, z, w]``."""
    m = rm
    trace = float(m[0, 0] + m[1, 1] + m[2, 2])
    if trace > 0.0:
        s = math.sqrt(trace + 1.0) * 2.0
        w = 0.25 * s
        x = (m[2, 1] - m[1, 2]) / s
        y = (m[0, 2] - m[2, 0]) / s
        z = (m[1, 0] - m[0, 1]) / s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2.0
        w = (m[2, 1] - m[1, 2]) / s
        x = 0.25 * s
        y = (m[0, 1] + m[1, 0]) / s
        z = (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2.0
        w = (m[0, 2] - m[2, 0]) / s
        x = (m[0, 1] + m[1, 0]) / s
        y = 0.25 * s
        z = (m[1, 2] + m[2, 1]) / s
    else:
        s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2.0
        w = (m[1, 0] - m[0, 1]) / s
        x = (m[0, 2] + m[2, 0]) / s
        y = (m[1, 2] + m[2, 1]) / s
        z = 0.25 * s
    q = np.array([x, y, z, w], dtype=np.float64)
    q = _safe_normalize(q, np.array([0.0, 0.0, 0.0, 1.0]))
    return [float(q[0]), float(q[1]), float(q[2]), float(q[3])]


def compute_hand_rotation(landmarks: Sequence[Any]) -> List[float]:
    """Palm orientation quaternion from wrist / MCP landmarks (xyzw).

    Raw capture mode: MediaPipe-space quaternion (Unity MapRotation remaps).
    Non-raw: apply POS_AXIS_REMAP so rot matches Python-side Unity pos/lms.
    """
    wrist = _lm_vec(landmarks, _WRIST)
    index_mcp = _lm_vec(landmarks, _INDEX_MCP)
    middle_mcp = _lm_vec(landmarks, _MIDDLE_MCP)
    pinky_mcp = _lm_vec(landmarks, _PINKY_MCP)

    y_axis = _safe_normalize(middle_mcp - wrist, np.array([0.0, 1.0, 0.0]))
    x_axis = _safe_normalize(index_mcp - pinky_mcp, np.array([1.0, 0.0, 0.0]))
    z_axis = _safe_normalize(np.cross(x_axis, y_axis), np.array([0.0, 0.0, 1.0]))
    x_axis = _safe_normalize(np.cross(y_axis, z_axis), np.array([1.0, 0.0, 0.0]))

    rm_mp = np.column_stack((x_axis, y_axis, z_axis))

    if cfg.LMS_RAW_CAPTURE_SPACE:
        return rotation_matrix_to_quaternion(rm_mp)

    # Build permutation/sign matrix R such that v_unity = R @ v_mp
    r = np.zeros((3, 3), dtype=np.float64)
    for unity_i, axis in enumerate(cfg.POS_AXIS_REMAP):
        sign = 1.0 if axis >= 0 else -1.0
        r[unity_i, abs(axis)] = sign
    rm_unity = r @ rm_mp @ r.T
    return rotation_matrix_to_quaternion(rm_unity)


def compute_pinch(landmarks: Sequence[Any], threshold: float) -> int:
    """Return 1 if thumb–index tip distance < threshold, else 0."""
    thumb = _lm_vec(landmarks, _THUMB_TIP)
    index = _lm_vec(landmarks, _INDEX_TIP)
    dist = float(np.linalg.norm(thumb - index))
    return 1 if dist < threshold else 0


def extract_landmarks_raw(landmarks: Sequence[Any]) -> List[List[float]]:
    """21 MediaPipe landmarks in capture/raw space (index order 0..20)."""
    out: List[List[float]] = []
    for i in range(21):
        lm = landmarks[i]
        out.append(
            [round(float(lm.x), 6), round(float(lm.y), 6), round(float(lm.z), 6)]
        )
    return out


def extract_landmarks_unity(landmarks: Sequence[Any]) -> List[List[float]]:
    """Convert all 21 MediaPipe landmarks to Unity meters (index order 0..20)."""
    out: List[List[float]] = []
    for i in range(21):
        lm = landmarks[i]
        xyz = mediapipe_to_unity([lm.x, lm.y, lm.z])
        out.append([round(xyz[0], 6), round(xyz[1], 6), round(xyz[2], 6)])
    return out


def extract_landmarks(landmarks: Sequence[Any]) -> List[List[float]]:
    """Export 21 landmarks per Unity contract (raw capture by default)."""
    if cfg.LMS_RAW_CAPTURE_SPACE:
        return extract_landmarks_raw(landmarks)
    return extract_landmarks_unity(landmarks)


def _lpf_vec(prev: Optional[List[float]], new: List[float], alpha: float) -> List[float]:
    if prev is None:
        return list(new)
    return [alpha * new[i] + (1.0 - alpha) * prev[i] for i in range(len(new))]


def _lpf_landmarks(
    prev: Optional[List[List[float]]],
    new: List[List[float]],
    alpha: float,
) -> List[List[float]]:
    if prev is None or len(prev) != len(new):
        return [list(p) for p in new]
    return [_lpf_vec(prev[i], new[i], alpha) for i in range(len(new))]


def _lpf_quat(prev: Optional[List[float]], new: List[float], alpha: float) -> List[float]:
    """Component-wise lerp with hemisphere fix, then renormalize."""
    if prev is None:
        return list(new)
    p = np.array(prev, dtype=np.float64)
    n = np.array(new, dtype=np.float64)
    if float(np.dot(p, n)) < 0.0:
        n = -n
    out = alpha * n + (1.0 - alpha) * p
    out = _safe_normalize(out, np.array([0.0, 0.0, 0.0, 1.0]))
    return [float(out[0]), float(out[1]), float(out[2]), float(out[3])]


# ---------------------------------------------------------------------------
# Processor
# ---------------------------------------------------------------------------


class HandProcessor:
    """OpenCV capture + MediaPipe Hands → filtered hand dicts for UDP."""

    def __init__(
        self,
        wrist_provider: Optional[WristPositionProvider] = None,
        camera_index: Optional[int] = None,
    ) -> None:
        self._wrist_provider: WristPositionProvider = (
            wrist_provider or MediaPipeWristProvider()
        )
        self._camera_index = (
            cfg.CAMERA_INDEX if camera_index is None else camera_index
        )
        self._cap: Optional[cv2.VideoCapture] = None
        self._hands = mp.solutions.hands.Hands(
            static_image_mode=cfg.MP_STATIC_IMAGE_MODE,
            max_num_hands=cfg.MP_MAX_NUM_HANDS,
            model_complexity=cfg.MP_MODEL_COMPLEXITY,
            min_detection_confidence=cfg.MP_MIN_DETECTION_CONFIDENCE,
            min_tracking_confidence=cfg.MP_MIN_TRACKING_CONFIDENCE,
        )
        self._mp_draw = mp.solutions.drawing_utils
        self._mp_hands = mp.solutions.hands
        # Per hand-id filters: id 0 = Left, 1 = Right
        self._prev_pos: Dict[int, Optional[List[float]]] = {0: None, 1: None}
        self._prev_rot: Dict[int, Optional[List[float]]] = {0: None, 1: None}
        self._prev_lms: Dict[int, Optional[List[List[float]]]] = {0: None, 1: None}

    def open_camera(self) -> bool:
        if self._cap is not None:
            return True
        cap = cv2.VideoCapture(self._camera_index)
        if not cap.isOpened():
            warnings.warn(
                f"Failed to open camera index {self._camera_index}",
                stacklevel=2,
            )
            cap.release()
            return False
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg.FRAME_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg.FRAME_HEIGHT)
        self._cap = cap
        return True

    def read_frame(self) -> Optional[Any]:
        """Return BGR frame or None on failure (warns, does not raise)."""
        if self._cap is None and not self.open_camera():
            return None
        assert self._cap is not None
        ok, frame = self._cap.read()
        if not ok or frame is None:
            warnings.warn("Failed to read frame from camera", stacklevel=2)
            return None
        if cfg.FLIP_HORIZONTAL:
            frame = cv2.flip(frame, 1)
        return frame

    def process_frame(self, frame: Any) -> Tuple[List[Dict[str, Any]], Any]:
        """Run Hands on *frame*. Returns ``(hands_payload, annotated_bgr)``."""
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        results = self._hands.process(rgb)
        rgb.flags.writeable = True
        annotated = frame.copy()

        hands_out: List[Dict[str, Any]] = []
        if not results.multi_hand_landmarks:
            # Soft reset filters when hands disappear so re-entry is snappy
            self._prev_pos = {0: None, 1: None}
            self._prev_rot = {0: None, 1: None}
            self._prev_lms = {0: None, 1: None}
            return hands_out, annotated

        handedness_list = results.multi_handedness or []
        for i, hand_lms in enumerate(results.multi_hand_landmarks):
            label = "Right"
            if i < len(handedness_list):
                label = handedness_list[i].classification[0].label
            hand_id = 0 if label == "Left" else 1

            self._mp_draw.draw_landmarks(
                annotated,
                hand_lms,
                self._mp_hands.HAND_CONNECTIONS,
            )

            lms = hand_lms.landmark
            pinch = compute_pinch(lms, cfg.PINCH_DISTANCE_THRESHOLD)
            pos = self._wrist_provider.get_wrist_pos(lms, label, (w, h))
            rot = compute_hand_rotation(lms)

            pos = _lpf_vec(self._prev_pos[hand_id], pos, cfg.LPF_POS_ALPHA)
            rot = _lpf_quat(self._prev_rot[hand_id], rot, cfg.LPF_ROT_ALPHA)
            self._prev_pos[hand_id] = pos
            self._prev_rot[hand_id] = rot

            hand_dict: Dict[str, Any] = {
                "id": hand_id,
                "pinch": pinch,
                "pos": [round(pos[0], 6), round(pos[1], 6), round(pos[2], 6)],
                "rot": [
                    round(rot[0], 6),
                    round(rot[1], 6),
                    round(rot[2], 6),
                    round(rot[3], 6),
                ],
            }

            if cfg.SEND_LANDMARKS:
                # Unity contract: pos == lms[0] in the same coordinate space.
                # Filter landmarks first, then pin wrist pos to lms[0] so LPF
                # cannot desync the two fields.
                lms_out = extract_landmarks(lms)
                lms_out = _lpf_landmarks(
                    self._prev_lms[hand_id], lms_out, cfg.LPF_LMS_ALPHA
                )
                self._prev_lms[hand_id] = lms_out
                wrist = lms_out[0]
                pos = list(wrist)
                self._prev_pos[hand_id] = pos
                hand_dict["pos"] = [
                    round(pos[0], 6),
                    round(pos[1], 6),
                    round(pos[2], 6),
                ]
                hand_dict["lms"] = [
                    [round(p[0], 6), round(p[1], 6), round(p[2], 6)] for p in lms_out
                ]

            hands_out.append(hand_dict)

        # Stable order: left (0) then right (1)
        hands_out.sort(key=lambda hnd: hnd["id"])
        return hands_out, annotated

    def set_wrist_provider(self, provider: WristPositionProvider) -> None:
        """Swap wrist position source (e.g. future marker module)."""
        self._wrist_provider = provider
        self._prev_pos = {0: None, 1: None}
        self._prev_lms = {0: None, 1: None}

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        self._hands.close()
