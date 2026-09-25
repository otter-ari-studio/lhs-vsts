import { expect, test } from '@rstest/core';
import {
  findPart,
  listPartIds,
  parseMachineDef,
} from '../src/machine/parseMachineDef';
import { listKitbashKeys } from '../src/visual/kitbash/KitbashAdapter';

const FIXTURE = {
  machineId: 'range_hood_generic',
  displayName: '通用侧吸式抽油烟机（基础样机）',
  unit: 'meter',
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
      partId: 'shell_main',
      displayName: '主外壳',
      kind: 'fixed_shell',
      anchor: { position: [0, 0.15, 0] },
      visual: { adapter: 'kitbash', kitbashKey: 'shell_main' },
      removePrereqs: [],
      installPrereqs: [],
      tips: {},
    },
    {
      partId: 'oil_box',
      displayName: '集油盒',
      kind: 'grabbable',
      anchor: { position: [0, -0.02, 0.22] },
      visual: { adapter: 'kitbash', kitbashKey: 'oil_box' },
      removePrereqs: [],
      installPrereqs: ['install_filter_top'],
      tips: { installLocked: 'locked' },
      snapRangeMeters: 0.08,
    },
    {
      partId: 'nut_wind',
      displayName: '风轮锁紧螺母',
      kind: 'rotate_nut',
      anchor: { position: [0, 0.28, 0.04], rotation: [0, 0, 0] },
      visual: { adapter: 'kitbash', kitbashKey: 'nut_wind' },
      removePrereqs: ['remove_wind_cover'],
      installPrereqs: ['install_wind_wheel'],
      tips: { wrongDirection: 'reverse tip' },
      thread: 'reverse',
    },
  ],
  cleanSpots: [
    {
      cleanId: 'oil_box',
      displayName: '清洁集油盒',
      partId: 'oil_box',
      position: [0, 0, 0],
      space: 'part_local',
      radiusMeters: 0.1,
      dwellMs: 1500,
      stepId: 'clean_oil_box',
    },
  ],
};

test('parseMachineDef accepts kitbash MachineDef without prefabPath', () => {
  const def = parseMachineDef(FIXTURE);
  expect(def.machineId).toBe('range_hood_generic');
  expect(listPartIds(def)).toEqual(['shell_main', 'oil_box', 'nut_wind']);
  expect(findPart(def, 'oil_box')?.anchor.position).toEqual([0, -0.02, 0.22]);
  expect(findPart(def, 'nut_wind')?.thread).toBe('reverse');
  expect(def.cleanSpots).toHaveLength(1);
  expect(def.cleanSpots[0]?.stepId).toBe('clean_oil_box');
});

test('parseMachineDef rejects Unity prefabPath', () => {
  expect(() =>
    parseMachineDef({
      ...FIXTURE,
      parts: [
        {
          ...FIXTURE.parts[0],
          prefabPath: 'Assets/Prefabs/x.prefab',
        },
      ],
    }),
  ).toThrow(/prefabPath/);
});

test('parseMachineDef rejects cleanSpot with unknown partId', () => {
  expect(() =>
    parseMachineDef({
      ...FIXTURE,
      cleanSpots: [
        {
          ...FIXTURE.cleanSpots[0],
          partId: 'missing_part',
        },
      ],
    }),
  ).toThrow(/unknown partId/);
});

test('parseMachineDef requires kitbashKey for kitbash adapter', () => {
  expect(() =>
    parseMachineDef({
      ...FIXTURE,
      parts: [
        {
          ...FIXTURE.parts[0],
          visual: { adapter: 'kitbash' },
        },
      ],
    }),
  ).toThrow(/kitbashKey/);
});

test('kitbash registry covers range_hood part keys', () => {
  const keys = new Set(listKitbashKeys());
  for (const id of [
    'shell_main',
    'oil_box',
    'filter_top',
    'filter_bottom',
    'clip_left',
    'clip_right',
    'panel_glass',
    'wind_cover',
    'nut_wind',
    'wind_wheel',
  ]) {
    expect(keys.has(id)).toBe(true);
  }
});

test('public range_hood_generic.json has no prefabPath and anchors match kitbash', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const jsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../public/machines/range_hood_generic.json',
  );
  const raw = JSON.parse(readFileSync(jsonPath, 'utf8')) as unknown;
  expect(JSON.stringify(raw)).not.toContain('prefabPath');

  const def = parseMachineDef(raw);
  const keys = new Set(listKitbashKeys());
  expect(listPartIds(def)).toHaveLength(10);
  for (const part of def.parts) {
    expect(part.visual.adapter).toBe('kitbash');
    expect(part.visual.kitbashKey).toBe(part.partId);
    expect(keys.has(part.partId)).toBe(true);
    expect(part.anchor.position).toHaveLength(3);
  }
  for (const spot of def.cleanSpots) {
    expect(findPart(def, spot.partId)).toBeDefined();
  }
});
