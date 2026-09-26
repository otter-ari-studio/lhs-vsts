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
} from "./types.js";

export { cleanStep, closeStep, installStep, openStep, removeStep } from "./types.js";

export { findPart, listPartIds, parseMachineDef } from "./parseMachineDef.js";

export {
  createScoreBook,
  type FaultEntry,
  type ScoreBook,
  type ScoreBookState,
} from "./ScoreBook.js";

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
} from "./StepGraph.js";

export {
  getTrainingSession,
  setTrainingSession,
  TrainingSession,
  type SessionSnapshot,
  type StepChromeRow,
} from "./TrainingSession.js";

export { emitSessionChange, emitTip, subscribeSession, subscribeTips } from "./sessionEvents.js";

export { APPLIANCE_WASH_DURATION_MS, APPLIANCE_WASH_STEP_ID, isCleanStepId } from "./wash.js";
