import { expect, test } from '@rstest/core';
import { createScoreBook } from '../src/machine/ScoreBook';
import {
  buildRequiredSteps,
  buildStepPrereqs,
  isPassed,
  prereqsMet,
} from '../src/machine/StepGraph';
import { TrainingSession } from '../src/machine/TrainingSession';
import type { MachineDef } from '../src/machine/types';
import { accumulateDwell, createDwellTracker } from '../src/interaction/dwell';

const miniDef: MachineDef = {
  machineId: 'test',
  displayName: 'test',
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
      partId: 'oil_box',
      displayName: '集油盒',
      kind: 'grabbable',
      anchor: { position: [0, 0, 0] },
      visual: { adapter: 'kitbash', kitbashKey: 'oil_box' },
      removePrereqs: [],
      installPrereqs: ['install_filter_top', 'clean_oil_box'],
      tips: { installLocked: '需先回装滤网并清洁' },
    },
    {
      partId: 'filter_top',
      displayName: '上层滤网',
      kind: 'grabbable',
      anchor: { position: [0, 0.1, 0] },
      visual: { adapter: 'kitbash', kitbashKey: 'filter_top' },
      removePrereqs: ['remove_oil_box'],
      installPrereqs: ['clean_filter_top'],
      tips: { removeLocked: '需先拆集油盒' },
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
    {
      cleanId: 'filter_top',
      displayName: '清洁上层滤网',
      partId: 'filter_top',
      position: [0, 0, 0],
      space: 'part_local',
      radiusMeters: 0.1,
      dwellMs: 1500,
      stepId: 'clean_filter_top',
    },
  ],
};

test('ScoreBook deducts and records faultLog without affecting callers', () => {
  const book = createScoreBook(miniDef.scoring, { cooldownMs: 0 });
  expect(book.getScore()).toBe(100);
  expect(book.deduct('a', 5, 'illegal', 1000)).toBe(true);
  expect(book.getScore()).toBe(95);
  expect(book.getFaultLog()).toHaveLength(1);
  expect(book.getFaultLog()[0]?.reason).toBe('illegal');
});

test('ScoreBook cooldown blocks repeated deduct on same key', () => {
  const book = createScoreBook(miniDef.scoring, { cooldownMs: 1500 });
  expect(book.deduct('k', 5, 't1', 1000)).toBe(true);
  expect(book.deduct('k', 5, 't2', 1200)).toBe(false);
  expect(book.getScore()).toBe(95);
  expect(book.deduct('k', 5, 't3', 2600)).toBe(true);
  expect(book.getScore()).toBe(90);
});

test('prereqsMet and buildRequiredSteps include clean steps', () => {
  const prereqs = buildStepPrereqs(miniDef);
  expect(prereqs.get('clean_oil_box')).toEqual(['remove_oil_box']);
  expect(prereqsMet('remove_filter_top', new Set(['remove_oil_box']), prereqs)).toBe(
    true,
  );
  expect(prereqsMet('remove_filter_top', new Set(), prereqs)).toBe(false);

  const required = buildRequiredSteps(miniDef);
  expect(required).toContain('clean_oil_box');
  expect(required).toContain('clean_filter_top');
  expect(required.indexOf('remove_oil_box')).toBeLessThan(
    required.indexOf('clean_oil_box'),
  );
});

test('isPassed ignores score; only required steps matter', () => {
  const required = buildRequiredSteps(miniDef);
  const done = new Set(required);
  expect(isPassed(required, done)).toBe(true);
  expect(isPassed(required, new Set(required.slice(0, -1)))).toBe(false);
});

test('TrainingSession: illegal order deducts but can still pass', () => {
  const session = new TrainingSession(miniDef);
  expect(session.tryBeginRemove('filter_top')).toBe(false);
  expect(session.getScore()).toBe(95);
  expect(session.getFaultLog().length).toBeGreaterThan(0);
  expect(session.getFaultLog()[0]?.reason).toBe('需先拆集油盒');

  expect(session.tryBeginRemove('oil_box')).toBe(true);
  session.notifyRemoved('oil_box');
  // UI「标记已清洁」and hover dwell both call completeClean.
  expect(session.completeClean('oil_box')).toBe(true);

  expect(session.tryBeginRemove('filter_top')).toBe(true);
  session.notifyRemoved('filter_top');
  expect(session.completeClean('filter_top')).toBe(true);

  expect(session.tryInstall('filter_top')).toBe(true);
  expect(session.tryInstall('oil_box')).toBe(true);

  expect(session.getPassed()).toBe(true);
  expect(session.getScore()).toBe(95);
  const snap = session.snapshot();
  expect(snap.finished).toBe(true);
  expect(snap.faultLog.length).toBeGreaterThan(0);
});

test('completeClean blocked until part removed; UI path same as dwell', () => {
  const session = new TrainingSession(miniDef);
  expect(session.completeClean('oil_box')).toBe(false);
  expect(session.getActiveCleanIds()).toEqual([]);
  session.notifyRemoved('oil_box');
  expect(session.getActiveCleanIds()).toContain('oil_box');
  expect(session.completeClean('oil_box')).toBe(true);
  expect(session.isStepComplete('clean_oil_box')).toBe(true);
  expect(session.completeClean('oil_box')).toBe(false);
});

test('clean dwell accumulate completes at threshold', () => {
  let elapsed = 0;
  let r = accumulateDwell(elapsed, true, 500, 1500);
  expect(r.completed).toBe(false);
  elapsed = r.elapsedMs;
  r = accumulateDwell(elapsed, true, 500, 1500);
  expect(r.completed).toBe(false);
  elapsed = r.elapsedMs;
  r = accumulateDwell(elapsed, true, 500, 1500);
  expect(r.completed).toBe(true);

  r = accumulateDwell(1000, false, 100, 1500);
  expect(r.elapsedMs).toBe(0);
  expect(r.completed).toBe(false);

  const tracker = createDwellTracker(1000);
  expect(tracker.tick(true, 400)).toBe(false);
  expect(tracker.tick(true, 600)).toBe(true);
  expect(tracker.tick(true, 100)).toBe(false);
  tracker.reset();
  expect(tracker.tick(true, 1000)).toBe(true);
});

test('visual adapter swap does not change StepGraph / TrainingSession', () => {
  const asGltf = structuredClone(miniDef);
  for (const part of asGltf.parts) {
    part.visual = {
      adapter: 'gltf',
      gltfUrl: `/models/${part.partId}.glb`,
      nodeName: part.partId,
    };
  }
  const parsed = asGltf;
  expect(buildRequiredSteps(parsed)).toEqual(buildRequiredSteps(miniDef));

  const session = new TrainingSession(parsed);
  expect(session.tryBeginRemove('oil_box')).toBe(true);
  session.notifyRemoved('oil_box');
  expect(session.completeClean('oil_box')).toBe(true);
  expect(session.tryBeginRemove('filter_top')).toBe(true);
  session.notifyRemoved('filter_top');
  expect(session.completeClean('filter_top')).toBe(true);
  expect(session.tryInstall('filter_top')).toBe(true);
  expect(session.tryInstall('oil_box')).toBe(true);
  expect(session.getPassed()).toBe(true);
});

test('public range_hood requiredSteps include cleans and pass after SOP', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { parseMachineDef } = await import('../src/machine/parseMachineDef');

  const jsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../public/machines/range_hood_generic.json',
  );
  const def = parseMachineDef(JSON.parse(readFileSync(jsonPath, 'utf8')));
  const required = buildRequiredSteps(def);
  for (const id of [
    'clean_oil_box',
    'clean_filter_top',
    'clean_filter_bottom',
    'clean_wind_wheel',
  ]) {
    expect(required).toContain(id);
  }

  const session = new TrainingSession(def);
  // Minimal illegal attempt then full legal path via completing all required.
  expect(session.tryBeginRemove('filter_top')).toBe(false);

  const order = [
    'oil_box',
    'filter_top',
    'filter_bottom',
  ] as const;
  for (const id of order) {
    expect(session.tryBeginRemove(id)).toBe(true);
    session.notifyRemoved(id);
    if (id !== 'filter_bottom') {
      // cleans for oil and filters
    }
  }
  expect(session.completeClean('oil_box')).toBe(true);
  expect(session.completeClean('filter_top')).toBe(true);
  expect(session.completeClean('filter_bottom')).toBe(true);

  expect(session.tryToggleClip('clip_left')).toBe(true);
  expect(session.tryToggleClip('clip_right')).toBe(true);
  expect(session.tryBeginRemove('panel_glass')).toBe(true);
  session.notifyRemoved('panel_glass');
  expect(session.tryBeginRemove('wind_cover')).toBe(true);
  session.notifyRemoved('wind_cover');
  expect(session.tryNutAction('nut_wind')).toBe(true);
  expect(session.tryBeginRemove('wind_wheel')).toBe(true);
  session.notifyRemoved('wind_wheel');
  expect(session.completeClean('wind_wheel')).toBe(true);

  expect(session.tryInstall('wind_wheel')).toBe(true);
  expect(session.tryNutAction('nut_wind')).toBe(true);
  expect(session.tryInstall('wind_cover')).toBe(true);
  expect(session.tryInstall('panel_glass')).toBe(true);
  expect(session.tryToggleClip('clip_left')).toBe(true);
  expect(session.tryToggleClip('clip_right')).toBe(true);
  expect(session.tryInstall('filter_bottom')).toBe(true);
  expect(session.tryInstall('filter_top')).toBe(true);
  expect(session.tryInstall('oil_box')).toBe(true);

  expect(session.getPassed()).toBe(true);
  expect(session.getScore()).toBeLessThan(100);
});
