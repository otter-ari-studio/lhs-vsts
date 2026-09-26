import { expect, test } from '@rstest/core';
import { aimTargetHub } from '../src/interaction/aimTargetHub';
import {
  AIM_IN_RANGE_EXIT_SCALE,
  INSTALLED_PICK_PRIORITY,
  SHARED_HOVER_STICK_SLACK_M,
  SOP_PICK_PRIORITY,
} from '../src/interaction/defaults';
import type { HandInteractable } from '../src/interaction/registry';
import {
  pickSharedHover,
  resolveAimInRange,
} from '../src/interaction/sharedAim';

function stub(
  id: string,
  opts: { priority?: number; active?: boolean; radius?: number } = {},
): HandInteractable {
  return {
    id,
    kind: 'grabbable',
    interactionRadius: opts.radius ?? 0.2,
    isInteractableNow: () => opts.active !== false,
    pickPriority: () => opts.priority ?? 0,
    distanceTo() {
      return 0;
    },
    onPinchStart() {},
    onPinchHold() {},
    onPinchEnd() {},
  };
}

test('two-hand non-SOP: sticky keeps winner when distances alternate slightly', () => {
  const a = stub('filter', { priority: INSTALLED_PICK_PRIORITY });
  const b = stub('oil_box', { priority: INSTALLED_PICK_PRIORITY });
  const slack = SHARED_HOVER_STICK_SLACK_M;

  const first = pickSharedHover(
    [
      { it: a, dist: 0.12 },
      { it: b, dist: 0.14 },
    ],
    null,
  );
  expect(first?.id).toBe('filter');

  // b closer by less than slack — must not steal
  const held = pickSharedHover(
    [
      { it: a, dist: 0.13 },
      { it: b, dist: 0.13 - slack * 0.4 },
    ],
    first,
  );
  expect(held?.id).toBe('filter');

  // b closer by more than slack — steals
  const stolen = pickSharedHover(
    [
      { it: a, dist: 0.15 },
      { it: b, dist: 0.15 - slack - 0.01 },
    ],
    held,
  );
  expect(stolen?.id).toBe('oil_box');
});

test('SOP candidate beats closer non-SOP hand target', () => {
  const near = stub('glass', { priority: INSTALLED_PICK_PRIORITY });
  const sop = stub('clip_left', { priority: SOP_PICK_PRIORITY });

  const win = pickSharedHover(
    [
      { it: near, dist: 0.05 },
      { it: sop, dist: 0.2 },
    ],
    near,
  );
  expect(win?.id).toBe('clip_left');
});

test('among SOP candidates sticky still applies', () => {
  const sopA = stub('clip_left', { priority: SOP_PICK_PRIORITY });
  const sopB = stub('clip_right', { priority: SOP_PICK_PRIORITY });
  const slack = SHARED_HOVER_STICK_SLACK_M;

  const first = pickSharedHover(
    [
      { it: sopA, dist: 0.1 },
      { it: sopB, dist: 0.12 },
    ],
    null,
  );
  expect(first?.id).toBe('clip_left');

  const held = pickSharedHover(
    [
      { it: sopA, dist: 0.11 },
      { it: sopB, dist: 0.11 - slack * 0.5 },
    ],
    first,
  );
  expect(held?.id).toBe('clip_left');
});

test('aim inRange enter / mid-band sticky / exit', () => {
  const radius = 0.1;
  const exit = radius * AIM_IN_RANGE_EXIT_SCALE;

  expect(resolveAimInRange(0.08, radius, false)).toBe(true);
  expect(resolveAimInRange(0.12, radius, true)).toBe(true); // mid-band
  expect(resolveAimInRange(0.12, radius, false)).toBe(false); // mid but was out
  expect(resolveAimInRange(exit + 0.01, radius, true)).toBe(false);
});

test('aimTargetHub dedupes identical set; notifies on id/inRange/position change', () => {
  aimTargetHub.clear();
  let n = 0;
  const unsub = aimTargetHub.subscribe(() => {
    n += 1;
  });

  aimTargetHub.set({
    id: 'a',
    position: [1, 2, 3],
    inRange: false,
  });
  expect(n).toBe(1);

  aimTargetHub.set({
    id: 'a',
    position: [1, 2, 3],
    inRange: false,
  });
  expect(n).toBe(1);

  aimTargetHub.set({
    id: 'a',
    position: [1, 2, 3],
    inRange: true,
  });
  expect(n).toBe(2);
  expect(aimTargetHub.get()?.inRange).toBe(true);

  aimTargetHub.set({
    id: 'a',
    position: [1.1, 2, 3],
    inRange: true,
  });
  expect(n).toBe(3);
  expect(aimTargetHub.get()?.position).toEqual([1.1, 2, 3]);

  aimTargetHub.set({
    id: 'b',
    position: [1.1, 2, 3],
    inRange: true,
  });
  expect(n).toBe(4);
  expect(aimTargetHub.get()?.id).toBe('b');

  aimTargetHub.clear();
  expect(n).toBe(5);
  expect(aimTargetHub.get()).toBeNull();
  unsub();
});

test('inactive candidates are dropped; empty pool returns null', () => {
  const dead = stub('gone', { active: false, priority: SOP_PICK_PRIORITY });
  const live = stub('filter', { priority: INSTALLED_PICK_PRIORITY });
  expect(
    pickSharedHover(
      [
        { it: dead, dist: 0.01 },
        { it: live, dist: 0.2 },
      ],
      null,
    )?.id,
  ).toBe('filter');
  expect(pickSharedHover([{ it: dead, dist: 0.01 }], null)).toBeNull();
  expect(pickSharedHover([], null)).toBeNull();
});
