import { expect, test } from '@rstest/core';
import { Vector3 } from 'three';
import {
  clearInteractables,
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

test('grab pick radius is larger than former snap-only 0.08m', () => {
  expect(COLLIDER_RADIUS.grabbable).toBeGreaterThan(0.15);
});

test('clip pick radius reaches deep hood clips', () => {
  expect(COLLIDER_RADIUS.clip).toBeGreaterThanOrEqual(0.25);
});

test('drop tray is on the left (away from right-hand path)', async () => {
  const { DROP_TRAY_CENTER } = await import('../src/interaction/dropTray');
  expect(DROP_TRAY_CENTER[0]).toBeLessThan(0);
});

test('drop tray claims stable slots per part', async () => {
  const { claimDropSlot, resetDropTraySlots, DROP_TRAY_CENTER } = await import(
    '../src/interaction/dropTray'
  );
  resetDropTraySlots();
  const a = claimDropSlot('oil_box');
  const a2 = claimDropSlot('oil_box');
  const b = claimDropSlot('filter_top');
  expect(a).toEqual(a2);
  expect(a[0]).not.toBe(b[0]);
  expect(Math.abs(a[0] - DROP_TRAY_CENTER[0])).toBeLessThan(0.2);
});

test('findNearest prefers SOP target over closer removed part', () => {
  clearInteractables();
  // Dropped oil_box near the hand
  registerInteractable(
    stub('oil_box', [0.05, 0, 0.26], { priority: REMOVED_PICK_PRIORITY, radius: 0.18 }),
  );
  // filter_top farther but current SOP
  registerInteractable(
    stub('filter_top', [0.18, 0, 0.26], { priority: SOP_PICK_PRIORITY, radius: 0.18 }),
  );

  const hit = findNearestInteractable(new Vector3(0, 0, 0.26));
  expect(hit?.id).toBe('filter_top');
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
