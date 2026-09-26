import { expect, test } from '@rstest/core';
import { Vector3 } from 'three';
import {
  clearInteractables,
  findHoverTargetSticky,
  findNearestInteractable,
  registerInteractable,
  type HandInteractable,
} from '../src/interaction/registry';
import {
  COLLIDER_RADIUS,
  INSTALLED_PICK_PRIORITY,
  REMOVED_PICK_PRIORITY,
  SOP_PICK_PRIORITY,
} from '../src/interaction/defaults';
import { partInventory } from '../src/interaction/partInventory';
import { PROP_OFFER_POS } from '../src/interaction/partOffer';
import {
  detectLateralThrow,
  pushThrowSample,
  type ThrowSample,
} from '../src/interaction/throwDetect';

function stub(
  id: string,
  pos: [number, number, number],
  opts: { radius?: number; priority?: number; active?: boolean } = {},
): HandInteractable {
  const p = new Vector3(...pos);
  return {
    id,
    kind: 'grabbable',
    interactionRadius: opts.radius ?? COLLIDER_RADIUS.grabbable,
    isInteractableNow: () => opts.active !== false,
    pickPriority: () => opts.priority ?? 0,
    distanceTo(hand) {
      return p.distanceTo(hand);
    },
    onPinchStart() {},
    onPinchHold() {},
    onPinchEnd() {},
  };
}

test('grab pick radius stays usable on the operation face', () => {
  expect(COLLIDER_RADIUS.grabbable).toBeGreaterThanOrEqual(0.18);
  expect(COLLIDER_RADIUS.grabbable).toBeLessThanOrEqual(0.24);
});

test('nut pick radius stays smaller than grabbable so impeller can win after nut-off', () => {
  expect(COLLIDER_RADIUS.rotate_nut).toBeLessThan(COLLIDER_RADIUS.grabbable);
  expect(COLLIDER_RADIUS.rotate_nut_sop).toBeGreaterThan(COLLIDER_RADIUS.rotate_nut);
  expect(COLLIDER_RADIUS.rotate_nut_sop).toBeLessThanOrEqual(COLLIDER_RADIUS.grabbable);
});

test('clip pick radius is a tight face hot-zone', () => {
  expect(COLLIDER_RADIUS.clip).toBeGreaterThanOrEqual(0.12);
  expect(COLLIDER_RADIUS.clip).toBeLessThan(0.2);
});

test('inventory FIFO enqueue / dequeue', () => {
  partInventory.clear();
  expect(partInventory.enqueue('oil_box')).toBe(true);
  expect(partInventory.enqueue('filter_top')).toBe(true);
  expect(partInventory.enqueue('oil_box')).toBe(false);
  expect([...partInventory.list()]).toEqual(['oil_box', 'filter_top']);
  partInventory.dequeue('oil_box');
  expect([...partInventory.list()]).toEqual(['filter_top']);
  partInventory.clear();
});

test('detectLateralThrow left and right', () => {
  const left: ThrowSample[] = [];
  pushThrowSample(left, 0, 0.2);
  pushThrowSample(left, 100, 0.1);
  pushThrowSample(left, 200, -0.05);
  expect(detectLateralThrow(left)).toBe('left');

  const right: ThrowSample[] = [];
  pushThrowSample(right, 0, -0.1);
  pushThrowSample(right, 100, 0);
  pushThrowSample(right, 200, 0.15);
  expect(detectLateralThrow(right)).toBe('right');

  const still: ThrowSample[] = [];
  pushThrowSample(still, 0, 0.1);
  pushThrowSample(still, 100, 0.11);
  pushThrowSample(still, 200, 0.105);
  expect(detectLateralThrow(still)).toBeNull();
});

test('findNearest prefers SOP target over closer removed part', () => {
  clearInteractables();
  registerInteractable(
    stub('oil_box', [0.05, 0, 0.26], { priority: REMOVED_PICK_PRIORITY, radius: 0.18 }),
  );
  registerInteractable(
    stub('filter_top', [0.18, 0, 0.26], { priority: SOP_PICK_PRIORITY, radius: 0.18 }),
  );

  const hit = findNearestInteractable(new Vector3(0, 0, 0.26));
  expect(hit?.id).toBe('filter_top');
  clearInteractables();
});

test('when SOP is in range, closer non-SOP parts are ignored', () => {
  clearInteractables();
  registerInteractable(
    stub('panel_glass', [0.02, 0, 0], {
      priority: INSTALLED_PICK_PRIORITY,
      radius: 0.3,
    }),
  );
  registerInteractable(
    stub('clip_left', [0.2, 0, 0], {
      priority: SOP_PICK_PRIORITY,
      radius: 0.3,
    }),
  );
  // Both in range — must pick SOP clip, not closer glass
  const hit = findNearestInteractable(new Vector3(0.05, 0, 0));
  expect(hit?.id).toBe('clip_left');
  clearInteractables();
});

test('findNearest among equal priority picks closer', () => {
  clearInteractables();
  registerInteractable(
    stub('a', [0.2, 0, 0], { priority: INSTALLED_PICK_PRIORITY }),
  );
  registerInteractable(
    stub('b', [0.1, 0, 0], { priority: INSTALLED_PICK_PRIORITY }),
  );
  const hit = findNearestInteractable(new Vector3(0, 0, 0));
  expect(hit?.id).toBe('b');
  clearInteractables();
});

test('findNearest ignores out-of-radius even with high priority', () => {
  clearInteractables();
  registerInteractable(
    stub('far_sop', [0.5, 0, 0], { priority: SOP_PICK_PRIORITY, radius: 0.18 }),
  );
  registerInteractable(
    stub('near', [0.1, 0, 0], { priority: INSTALLED_PICK_PRIORITY, radius: 0.18 }),
  );
  const hit = findNearestInteractable(new Vector3(0, 0, 0));
  expect(hit?.id).toBe('near');
  clearInteractables();
});

test('hover sticky keeps target past enter radius until exit scale', () => {
  clearInteractables();
  const target = stub('part', [0, 0, 0], {
    priority: INSTALLED_PICK_PRIORITY,
    radius: 0.1,
  });
  registerInteractable(target);
  const inside = findHoverTargetSticky(new Vector3(0.05, 0, 0), null);
  expect(inside?.id).toBe('part');
  // 0.12 > 0.1 enter but < 0.1*1.45 exit — stay
  const edge = findHoverTargetSticky(new Vector3(0.12, 0, 0), inside);
  expect(edge?.id).toBe('part');
  // beyond exit
  const out = findHoverTargetSticky(new Vector3(0.2, 0, 0), edge);
  expect(out).toBeNull();
  clearInteractables();
});

test('PROP_OFFER_POS sits in reachable front workspace', () => {
  expect(PROP_OFFER_POS[2]).toBeGreaterThan(0.3);
  expect(PROP_OFFER_POS[0]).toBeGreaterThan(0.2);
});
