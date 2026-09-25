# Design: Hand Tracking UDP Sender

## Layout

```
.
├── config.py
├── udp_sender.py
├── hand_processor.py
├── main.py
├── requirements.txt
├── README.md
└── pyproject.toml
```

## Key types

- `WristPositionProvider` protocol / ABC: `get_wrist_pos(hand_landmarks, handedness) -> [x,y,z]`
- Default: `MediaPipeWristProvider` using config scale/offset/axis remap
- Future: `MarkerWristProvider` replacing only wrist pos

## Coordinate pipeline

MediaPipe normalized (x,y,z) → axis remap → scale → offset → Unity meters

## Rotation

Palm basis from wrist / index MCP / pinky MCP / middle MCP → rotation matrix → quaternion (xyzw)

## Loop

capture → process → build payload `{t, hands}` → rate-limited UDP → draw overlay
