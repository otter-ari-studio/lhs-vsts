import { expect, test } from '@rstest/core';
import { Matrix4 } from 'three';
import {
  DEFAULT_AXIS_MAP,
  buildMapMatrix,
  mapPointTuple,
} from '../src/hand/axisMap';
import { handHub } from '../src/hand/HandHub';
import {
  MEDIAPIPE_VERSION,
  MEDIAPIPE_WASM_BASE,
  MEDIAPIPE_WASM_CDN,
} from '../src/hand/mediapipeLoader';
import { distance3, updatePinchState } from '../src/hand/pinch';
import type { HandSample } from '../src/hand/types';

test('DEFAULT_AXIS_MAP mirrors X and flips Y for selfie → Three', () => {
  expect(DEFAULT_AXIS_MAP.invertX).toBe(true);
  expect(DEFAULT_AXIS_MAP.invertY).toBe(true);
  expect(DEFAULT_AXIS_MAP.invertZ).toBe(false);
});

test('buildMapMatrix maps MediaPipe point into scene space', () => {
  const map = buildMapMatrix(DEFAULT_AXIS_MAP);
  // Capture +X right, +Y down → scene −X (mirrored), +Y up
  const out = mapPointTuple([0.1, 0.2, 0.3], map);
  expect(out[0]).toBeCloseTo(-0.1);
  expect(out[1]).toBeCloseTo(-0.2);
  expect(out[2]).toBeCloseTo(0.3);
});

test('illegal axis config falls back to identity', () => {
  const map = buildMapMatrix({
    sceneXFrom: 'x',
    invertX: false,
    sceneYFrom: 'x',
    invertY: false,
    sceneZFrom: 'z',
    invertZ: false,
  });
  expect(map.equals(new Matrix4())).toBe(true);
});

test('pinch hysteresis: enter below ON, stay until OFF', () => {
  const on = 0.035;
  const off = 0.055;
  expect(updatePinchState(false, 0.04, on, off)).toBe(false);
  expect(updatePinchState(false, 0.03, on, off)).toBe(true);
  expect(updatePinchState(true, 0.05, on, off)).toBe(true);
  expect(updatePinchState(true, 0.055, on, off)).toBe(false);
  expect(updatePinchState(true, 0.06, on, off)).toBe(false);
});

test('distance3 is Euclidean', () => {
  expect(distance3([0, 0, 0], [3, 4, 0])).toBeCloseTo(5);
});

test('handHub publish / clear / hasAny', () => {
  handHub.clearAll();
  expect(handHub.hasAny()).toBe(false);

  const sample: HandSample = {
    handId: 0,
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    pinching: false,
    timestamp: 1,
    landmarks: null,
  };
  handHub.publish(sample);
  expect(handHub.tryGetLatest(0)?.handId).toBe(0);
  expect(handHub.tryGetLatest(1)).toBeNull();
  expect(handHub.hasAny()).toBe(true);

  handHub.clear(0);
  expect(handHub.hasAny()).toBe(false);
});

test('MediaPipe WASM URLs are pinned (not @latest)', () => {
  expect(MEDIAPIPE_VERSION).toBe('1.0.1');
  expect(MEDIAPIPE_WASM_BASE).toBe('/mediapipe');
  expect(MEDIAPIPE_WASM_CDN).toContain(`@${MEDIAPIPE_VERSION}`);
  expect(MEDIAPIPE_WASM_CDN).not.toContain('@latest');
});
