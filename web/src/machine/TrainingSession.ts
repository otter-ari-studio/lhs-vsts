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
import {
  APPLIANCE_WASH_STEP_ID,
  isCleanStepId,
} from './wash';

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
  /** True after full teardown of cleanable parts, before batch wash finishes. */
  applianceWashPending: boolean;
}

/**
 * Order graph + scoring for one training run.
 * `passed` = all requiredSteps complete; score/faults are independent.
 */
export class TrainingSession {
  readonly def: MachineDef;
  readonly requiredSteps: string[];
  private readonly sessionId = `ts_${Math.random().toString(36).slice(2, 10)}`;
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

  getSessionId(): string {
    return this.sessionId;
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
    // Cooldown blocks both score and tip — avoids "一直提醒卡扣" on sustained grasp.
    if (!this.scores.deduct(key, amount, tip)) return;
    emitTip(tip);
    this.bump();
  }

  tip(msg: string): void {
    emitTip(msg);
  }

  getPart(partId: string): PartDef | undefined {
    return this.partById.get(partId);
  }

  /**
   * Per-spot clean interaction disabled — wash is a single post-teardown overlay.
   * Kept empty so legacy CleanSpotMesh / UI fallback never activate.
   */
  getActiveCleanIds(): string[] {
    return [];
  }

  /** Every part that has a clean spot is removed. */
  isApplianceWashReady(): boolean {
    if (this.def.cleanSpots.length === 0) return false;
    return this.def.cleanSpots.every((s) => this.getState(s.partId) === 'removed');
  }

  /** All clean_* steps already completed. */
  isApplianceWashDone(): boolean {
    if (this.def.cleanSpots.length === 0) return true;
    return this.def.cleanSpots.every((s) => this.completed.has(s.stepId));
  }

  /** Ready for wash overlay: teardown done, cleans not yet batch-completed. */
  isApplianceWashPending(): boolean {
    return this.isApplianceWashReady() && !this.isApplianceWashDone();
  }

  /** Complete every clean_* step at once (after wash animation). */
  completeAllCleans(): boolean {
    if (!this.isApplianceWashReady()) {
      emitTip('⚠️ 请先拆完所有待清洁零件');
      this.bump();
      return false;
    }
    if (this.isApplianceWashDone()) return false;
    for (const spot of this.def.cleanSpots) {
      this.complete(spot.stepId);
    }
    emitTip('✅ 家电清洗完毕');
    this.bump();
    return true;
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

  /** True when part is removed and install prereqs are satisfied (no penalty). */
  canInstall(partId: string): boolean {
    if (this.getState(partId) !== 'removed') return false;
    return prereqsMet(installStep(partId), this.completed, this.stepPrereqs);
  }

  /** Human-readable why install is locked, or null if ready. */
  installBlockReason(partId: string): string | null {
    const cfg = this.partById.get(partId);
    if (!cfg) return '未知零件';
    if (this.getState(partId) !== 'removed') return '零件未在物品栏';
    if (this.canInstall(partId)) return null;
    return cfg.tips.installLocked ?? `需先完成前置步骤才能回装 ${cfg.displayName}`;
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

  /** Grasp remove/install for rotate_nut (same edge as grabbable). */
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

  private isInstallPhaseStep(stepId: string): boolean {
    for (const part of this.def.parts) {
      if (stepId === installStep(part.partId) || stepId === closeStep(part.partId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Chrome SOP: teardown → single「家电清洗」→ reinstall.
   * Individual clean_* steps stay in the graph for install prereqs but are hidden here.
   */
  buildChromeSteps(): StepChromeRow[] {
    const teardown: { stepId: string; label: string }[] = [];
    const reinstall: { stepId: string; label: string }[] = [];

    for (const stepId of this.requiredSteps) {
      if (isCleanStepId(stepId, this.def)) continue;
      const row = { stepId, label: stepLabel(this.def, stepId) };
      if (this.isInstallPhaseStep(stepId)) reinstall.push(row);
      else teardown.push(row);
    }

    const display: { stepId: string; label: string; kind: 'normal' | 'wash' }[] = [
      ...teardown.map((r) => ({ ...r, kind: 'normal' as const })),
    ];
    if (this.def.cleanSpots.length > 0) {
      display.push({
        stepId: APPLIANCE_WASH_STEP_ID,
        label: '家电清洗',
        kind: 'wash',
      });
    }
    display.push(...reinstall.map((r) => ({ ...r, kind: 'normal' as const })));

    let sawIncomplete = false;
    return display.map((item) => {
      if (item.kind === 'wash') {
        if (this.isApplianceWashDone()) {
          return { stepId: item.stepId, label: item.label, status: 'done' as const };
        }
        if (!this.isApplianceWashReady()) {
          const missing = this.def.cleanSpots
            .filter((s) => this.getState(s.partId) !== 'removed')
            .map((s) => this.partById.get(s.partId)?.displayName ?? s.partId);
          const unique = [...new Set(missing)];
          return {
            stepId: item.stepId,
            label: item.label,
            status: 'locked' as const,
            lockReason: `需先拆完：${unique.join('、')}`,
          };
        }
        if (!sawIncomplete) {
          sawIncomplete = true;
          return { stepId: item.stepId, label: item.label, status: 'current' as const };
        }
        return { stepId: item.stepId, label: item.label, status: 'todo' as const };
      }

      if (this.completed.has(item.stepId)) {
        return { stepId: item.stepId, label: item.label, status: 'done' as const };
      }
      const missing = missingPrereqs(item.stepId, this.completed, this.stepPrereqs);
      // Treat incomplete cleans as missing when they block install — surface wash instead.
      const missingVisible = missing.filter((m) => !isCleanStepId(m, this.def));
      if (missingVisible.length > 0) {
        return {
          stepId: item.stepId,
          label: item.label,
          status: 'locked' as const,
          lockReason: `需先完成：${missingVisible.map((m) => stepLabel(this.def, m)).join('、')}`,
        };
      }
      if (missing.some((m) => isCleanStepId(m, this.def)) && !this.isApplianceWashDone()) {
        return {
          stepId: item.stepId,
          label: item.label,
          status: 'locked' as const,
          lockReason: '需先完成：家电清洗',
        };
      }
      if (!sawIncomplete) {
        sawIncomplete = true;
        return { stepId: item.stepId, label: item.label, status: 'current' as const };
      }
      return { stepId: item.stepId, label: item.label, status: 'todo' as const };
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
      applianceWashPending: this.isApplianceWashPending(),
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
