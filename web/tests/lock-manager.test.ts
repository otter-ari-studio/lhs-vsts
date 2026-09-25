import { expect, test } from '@rstest/core';
import { LockManager } from '../src/machine/LockManager';
import type { MachineConfig } from '../src/machine/types';

const miniConfig: MachineConfig = {
  machineId: 'test',
  displayName: 'test',
  unit: 'meter',
  nutThread: 'reverse',
  scoring: {
    baseScore: 100,
    deductIllegalOrder: 5,
    deductClipPry: 10,
    deductNutWrongDirection: 5,
    deductToleranceFail: 5,
  },
  assemblyDefaults: {
    positionToleranceMeters: 0.015,
    angleToleranceDegrees: 5,
    snapRangeMeters: 0.08,
  },
  parts: [
    {
      partId: 'oil_box',
      displayName: '集油盒',
      kind: 'grabbable',
      prefabPath: '',
      anchorName: '',
      positionToleranceMeters: 0.015,
      angleToleranceDegrees: 5,
      snapRangeMeters: 0.08,
      thread: '',
      removePrereqs: [],
      installPrereqs: ['install_filter_top'],
      removeLockedTip: '',
      installLockedTip: '需先回装滤网',
      pryTip: '',
      wrongDirectionTip: '',
    },
    {
      partId: 'filter_top',
      displayName: '上层滤网',
      kind: 'grabbable',
      prefabPath: '',
      anchorName: '',
      positionToleranceMeters: 0.015,
      angleToleranceDegrees: 5,
      snapRangeMeters: 0.08,
      thread: '',
      removePrereqs: ['remove_oil_box'],
      installPrereqs: [],
      removeLockedTip: '需先拆集油盒',
      installLockedTip: '',
      pryTip: '',
      wrongDirectionTip: '',
    },
  ],
};

test('oil_box can remove first; filter_top locked until oil removed', () => {
  const mgr = new LockManager(miniConfig);
  expect(mgr.tryBeginRemove('oil_box')).toBe(true);
  mgr.notifyRemoved('oil_box');
  expect(mgr.getState('oil_box')).toBe('removed');
  expect(mgr.tryBeginRemove('filter_top')).toBe(true);
});

test('filter_top remove blocked before oil_box', () => {
  const mgr = new LockManager(miniConfig);
  expect(mgr.tryBeginRemove('filter_top')).toBe(false);
  expect(mgr.getScore()).toBe(95);
});
