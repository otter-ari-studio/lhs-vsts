import { createScoreBook, type FaultEntry, type ScoreBook } from './ScoreBook';
import {
  buildRequiredSteps,
  buildStepPrereqs,
  initialPartStates,
  isPassed,
  missingPrereqs,
  prereqsMet,
  stepLabel,
  type PartRuntimeState,
} from './StepGraph';
import { emitSessionChange, emitTip } from './sessionEvents';
import {
  closeStep,
  installStep,
  openStep,
  removeStep,
  type MachineDef,
  type PartDef,
} from './types';

export interface StepChromeRow {
  stepId: string;
  label: string;
  status: 'done' | 'current' | 'locked' | 'todo';
  lockReason?: string;
}

export interface SessionSnapshot {
  score: number;
  faultLog: readonly FaultEntry[];
  completedSteps: string[];
  requiredSteps: string[];
  passed: boolean;
  finished: boolean;
  partStates: Record<string, PartRuntimeState>;
  steps: StepChromeRow[];
  activeCleanIds: string[];
}

/**
 * Order graph + scoring for one training run.
 * `passed` = all requiredSteps complete; score/faults are independent.
 */
export class TrainingSession {
  readonly def: MachineDef;
  readonly requiredSteps: string[];
  private readonly stepPrereqs: Map<string, string[]>;
  private readonly completed = new Set<string>();
  private readonly states: Map<string, PartRuntimeState>;
  private readonly partById: Map<string, PartDef>;
  private readonly scores: ScoreBook;
  private finished = false;
  private revision = 0;

  constructor(def: MachineDef) {
    this.def = def;
    this.stepPrereqs = buildStepPrereqs(def);
    this.requiredSteps = buildRequiredSteps(def);
    this.states = initialPartStates(def);
    this.partById = new Map(def.parts.map((p) => [p.partId, p]));
    this.scores = createScoreBook(def.scoring);
  }

  getRevision(): number {
    return this.revision;
  }

  private bump(): void {
    this.revision += 1;
    emitSessionChange();
  }

  getScore(): number {
    return this.scores.getScore();
  }

  getFaultLog(): readonly FaultEntry[] {
    return this.scores.getFaultLog();
  }

  getCompletedSteps(): string[] {
    return [...this.completed];
  }

  isStepComplete(stepId: string): boolean {
    return this.completed.has(stepId);
  }

  getState(partId: string): PartRuntimeState {
    return this.states.get(partId) ?? 'installed';
  }

  getPassed(): boolean {
    return isPassed(this.requiredSteps, this.completed);
  }

  getFinished(): boolean {
    return this.finished;
  }

  /** Mark run finished (end screen). Auto-finishes when passed. */
  finish(): void {
    this.finished = true;
    this.bump();
  }

  private complete(stepId: string): void {
    if (this.completed.has(stepId)) return;
    this.completed.add(stepId);
    this.maybeAutoFinish();
  }

  private maybeAutoFinish(): void {
    if (this.getPassed() && !this.finished) {
      this.finished = true;
    }
  }

  private penalize(key: string, amount: number, tip: string): void {
    emitTip(tip);
    this.scores.deduct(key, amount, tip);
    this.bump();
  }

  tip(msg: string): void {
    emitTip(msg);
  }

  getPart(partId: string): PartDef | undefined {
    return this.partById.get(partId);
  }

  /** Active clean spots: owning part removed and clean step not done. */
  getActiveCleanIds(): string[] {
    return this.def.cleanSpots
      .filter((s) => {
        if (this.completed.has(s.stepId)) return false;
        return this.getState(s.partId) === 'removed';
      })
      .map((s) => s.cleanId);
  }

  tryBeginRemove(partId: string): boolean {
    const cfg = this.partById.get(partId);
    if (!cfg) return false;
    const step = removeStep(partId);
    if (!prereqsMet(step, this.completed, this.stepPrereqs)) {
      const tip =
        cfg.tips.removeLocked ?? `⚠️ 顺序锁定：无法拆卸 ${cfg.displayName}`;
      this.penalize(`remove:${partId}`, this.def.scoring.deductIllegalOrder, tip);
      return false;
    }
    return true;
  }

  notifyRemoved(partId: string): void {
    this.states.set(partId, 'removed');
    this.complete(removeStep(partId));
    const cfg = this.partById.get(partId);
    emitTip(`✅ 已拆下 ${cfg?.displayName ?? partId}`);
    this.bump();
  }

  tryInstall(partId: string): boolean {
    const cfg = this.partById.get(partId);
    if (!cfg) return false;
    const step = installStep(partId);
    if (!prereqsMet(step, this.completed, this.stepPrereqs)) {
      const tip =
        cfg.tips.installLocked ?? `⚠️ 顺序锁定：无法回装 ${cfg.displayName}`;
      this.penalize(`install:${partId}`, this.def.scoring.deductIllegalOrder, tip);
      return false;
    }
    this.states.set(partId, 'installed');
    this.complete(step);
    emitTip(`✅ 已回装 ${cfg.displayName}`);
    this.bump();
    return true;
  }

  notifyToleranceFail(partId: string): void {
    const cfg = this.partById.get(partId);
    this.penalize(
      `tol:${partId}`,
      this.def.scoring.deductToleranceFail,
      `⚠️ 回装位置超出公差：${cfg?.displayName ?? partId}`,
    );
  }

  tryToggleClip(partId: string): boolean {
    const cfg = this.partById.get(partId);
    if (!cfg || cfg.kind !== 'clip') return false;
    const state = this.getState(partId);
    if (state === 'clip_closed') {
      const step = openStep(partId);
      if (!prereqsMet(step, this.completed, this.stepPrereqs)) {
        this.penalize(
          `pry:${partId}`,
          this.def.scoring.deductClipPry,
          cfg.tips.pry ?? `⚠️ 无法打开 ${cfg.displayName}`,
        );
        return false;
      }
      this.states.set(partId, 'clip_open');
      this.complete(step);
      emitTip(`✅ 已打开 ${cfg.displayName}`);
      this.bump();
      return true;
    }
    const step = closeStep(partId);
    if (!prereqsMet(step, this.completed, this.stepPrereqs)) {
      this.penalize(
        `close:${partId}`,
        this.def.scoring.deductIllegalOrder,
        cfg.tips.installLocked ?? `⚠️ 无法锁止 ${cfg.displayName}`,
      );
      return false;
    }
    this.states.set(partId, 'clip_closed');
    this.complete(step);
    emitTip(`✅ 已锁止 ${cfg.displayName}`);
    this.bump();
    return true;
  }

  /** Pinch-dwell remove/install for rotate_nut. */
  tryNutAction(partId: string): boolean {
    const cfg = this.partById.get(partId);
    if (!cfg || cfg.kind !== 'rotate_nut') return false;
    const state = this.getState(partId);
    if (state === 'installed') {
      if (!this.tryBeginRemove(partId)) return false;
      this.notifyRemoved(partId);
      if (cfg.thread === 'reverse' && cfg.tips.wrongDirection) {
        // Tip only — no auto-deduct for direction in first version.
        emitTip(cfg.tips.wrongDirection);
      }
      return true;
    }
    if (state === 'removed') {
      return this.tryInstall(partId);
    }
    return false;
  }

  completeClean(cleanId: string): boolean {
    const spot = this.def.cleanSpots.find((s) => s.cleanId === cleanId);
    if (!spot) return false;
    if (this.completed.has(spot.stepId)) return false;
    if (!prereqsMet(spot.stepId, this.completed, this.stepPrereqs)) {
      emitTip(`⚠️ 请先拆下零件再清洁：${spot.displayName}`);
      this.bump();
      return false;
    }
    if (this.getState(spot.partId) !== 'removed') {
      emitTip(`⚠️ 请先拆下零件再清洁：${spot.displayName}`);
      this.bump();
      return false;
    }
    this.complete(spot.stepId);
    emitTip(`✅ ${spot.displayName}`);
    this.bump();
    return true;
  }

  buildChromeSteps(): StepChromeRow[] {
    let sawIncomplete = false;
    return this.requiredSteps.map((stepId) => {
      const label = stepLabel(this.def, stepId);
      if (this.completed.has(stepId)) {
        return { stepId, label, status: 'done' as const };
      }
      const missing = missingPrereqs(stepId, this.completed, this.stepPrereqs);
      if (missing.length > 0) {
        return {
          stepId,
          label,
          status: 'locked' as const,
          lockReason: `需先完成：${missing.map((m) => stepLabel(this.def, m)).join('、')}`,
        };
      }
      if (!sawIncomplete) {
        sawIncomplete = true;
        return { stepId, label, status: 'current' as const };
      }
      return { stepId, label, status: 'todo' as const };
    });
  }

  snapshot(): SessionSnapshot {
    return {
      score: this.getScore(),
      faultLog: this.getFaultLog(),
      completedSteps: this.getCompletedSteps(),
      requiredSteps: [...this.requiredSteps],
      passed: this.getPassed(),
      finished: this.finished || this.getPassed(),
      partStates: Object.fromEntries(this.states),
      steps: this.buildChromeSteps(),
      activeCleanIds: this.getActiveCleanIds(),
    };
  }
}

let current: TrainingSession | null = null;

export function setTrainingSession(session: TrainingSession | null): void {
  current = session;
  emitSessionChange();
}

export function getTrainingSession(): TrainingSession | null {
  return current;
}
