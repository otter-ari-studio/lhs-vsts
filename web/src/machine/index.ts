export type {
  AssemblyDefaults,
  CleanSpace,
  CleanSpotDef,
  MachineDef,
  NutThread,
  PartAnchor,
  PartDef,
  PartKind,
  PartTips,
  PartVisual,
  ScoringConfig,
  Vec3,
  VisualAdapter,
} from './types';

export {
  cleanStep,
  closeStep,
  installStep,
  openStep,
  removeStep,
} from './types';

export { findPart, listPartIds, parseMachineDef } from './parseMachineDef';
export { loadMachineDef } from './loadMachineDef';

export {
  createScoreBook,
  type FaultEntry,
  type ScoreBook,
  type ScoreBookState,
} from './ScoreBook';

export {
  buildRequiredSteps,
  buildStepPrereqs,
  initialPartStates,
  isPassed,
  listStepInfos,
  missingPrereqs,
  prereqsMet,
  stepLabel,
  topoSortSteps,
  type PartRuntimeState,
  type StepInfo,
} from './StepGraph';

export {
  getTrainingSession,
  setTrainingSession,
  TrainingSession,
  type SessionSnapshot,
  type StepChromeRow,
} from './TrainingSession';

export {
  emitSessionChange,
  emitTip,
  subscribeSession,
  subscribeTips,
} from './sessionEvents';
