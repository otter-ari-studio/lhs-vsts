import { expect, test } from '@rstest/core';
import { Vector3 } from 'three';
import { buildMapMatrix, mapPoint } from '../src/hand/axisMap';
import { parseHandFrame } from '../src/hand/protocol';

test('default axis map flips Y and Z', () => {
  const m = buildMapMatrix();
  const out = mapPoint(new Vector3(1, 2, 3), m);
  expect(out.x).toBeCloseTo(1);
  expect(out.y).toBeCloseTo(-2);
  expect(out.z).toBeCloseTo(-3);
});

test('parseHandFrame accepts nested lms', () => {
  const frame = parseHandFrame({
    t: 1,
    hands: [
      {
        id: 0,
        pinch: 1,
        pos: [0, 0, 0],
        rot: [0, 0, 0, 1],
        lms: Array.from({ length: 21 }, () => [0, 0, 0]),
      },
    ],
  });
  expect(frame?.hands).toHaveLength(1);
  expect(frame?.hands[0].lms).toHaveLength(21);
});
