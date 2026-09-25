import { emitScore, emitTip } from './events';
import {
  closeStep,
  installStep,
  openStep,
  parseKind,
  removeStep,
  type MachineConfig,
  type PartConfig,
  type PartKind,
} from './types';

export type PartRuntimeState = 'installed' | 'removed' | 'clip_open' | 'clip_closed';

/**
 * Ports Unity DisassemblyLockManager (order graph + tips + scoring).
 */
export class LockManager {
  readonly config: MachineConfig;
  private readonly stepPrereqs = new Map<string, string[]>();
  private readonly completed = new Set<string>();
  private readonly partConfigs = new Map<string, PartConfig>();
  private readonly states = new Map<string, PartRuntimeState>();
  private score: number;
  private lastPenaltyAt = new Map<string, number>();
  private readonly penaltyCooldownMs = 1500;

  constructor(config: MachineConfig) {
    this.config = config;
    this.score = config.scoring.baseScore;
    this.buildSteps();
    emitScore(this.score);
  }

  getScore(): number {
    return this.score;
  }

  getPartConfig(partId: string): PartConfig | undefined {
    return this.partConfigs.get(partId);
  }

  getState(partId: string): PartRuntimeState {
    return this.states.get(partId) ?? 'installed';
  }

  kindOf(partId: string): PartKind {
    const c = this.partConfigs.get(partId);
    return c ? parseKind(c.kind) : 'grabbable';
  }

  private buildSteps(): void {
    for (const p of this.config.parts) {
      if (!p.partId) continue;
      this.partConfigs.set(p.partId, p);
      const kind = parseKind(p.kind);
      if (kind === 'fixed_shell') continue;
      if (kind === 'clip') {
        this.stepPrereqs.set(openStep(p.partId), p.removePrereqs ?? []);
        this.stepPrereqs.set(closeStep(p.partId), p.installPrereqs ?? []);
        this.states.set(p.partId, 'clip_closed');
      } else {
        this.stepPrereqs.set(removeStep(p.partId), p.removePrereqs ?? []);
        this.stepPrereqs.set(installStep(p.partId), p.installPrereqs ?? []);
        this.states.set(p.partId, 'installed');
      }
    }
  }

  private prereqsMet(stepId: string): boolean {
    const req = this.stepPrereqs.get(stepId) ?? [];
    return req.every((s) => this.completed.has(s));
  }

  private complete(stepId: string): void {
    if (this.completed.has(stepId)) return;
    this.completed.add(stepId);
  }

  private penalize(key: string, amount: number, tip: string): void {
    const now = performance.now();
    const last = this.lastPenaltyAt.get(key);
    emitTip(tip);
    if (last !== undefined && now - last < this.penaltyCooldownMs) return;
    this.lastPenaltyAt.set(key, now);
    this.score = Math.max(0, this.score - amount);
    emitScore(this.score);
  }

  tip(msg: string): void {
    emitTip(msg);
  }

  /** Attempt to begin removing an installed grabbable/nut. */
  tryBeginRemove(partId: string): boolean {
    const cfg = this.partConfigs.get(partId);
    if (!cfg) return false;
    const step = removeStep(partId);
    if (!this.prereqsMet(step)) {
      const tip =
        cfg.removeLockedTip ||
        `⚠️ 顺序锁定：无法拆卸 ${cfg.displayName}`;
      this.penalize(
        `remove:${partId}`,
        this.config.scoring.deductIllegalOrder,
        tip,
      );
      return false;
    }
    return true;
  }

  notifyRemoved(partId: string): void {
    this.states.set(partId, 'removed');
    this.complete(removeStep(partId));
    const cfg = this.partConfigs.get(partId);
    emitTip(`✅ 已拆下 ${cfg?.displayName ?? partId}`);
  }

  tryInstall(partId: string): boolean {
    const cfg = this.partConfigs.get(partId);
    if (!cfg) return false;
    const step = installStep(partId);
    if (!this.prereqsMet(step)) {
      const tip =
        cfg.installLockedTip ||
        `⚠️ 顺序锁定：无法回装 ${cfg.displayName}`;
      this.penalize(
        `install:${partId}`,
        this.config.scoring.deductIllegalOrder,
        tip,
      );
      return false;
    }
    this.states.set(partId, 'installed');
    this.complete(step);
    emitTip(`✅ 已回装 ${cfg.displayName}`);
    return true;
  }

  notifyToleranceFail(partId: string): void {
    const cfg = this.partConfigs.get(partId);
    this.penalize(
      `tol:${partId}`,
      this.config.scoring.deductToleranceFail,
      `⚠️ 回装位置超出公差：${cfg?.displayName ?? partId}`,
    );
  }

  /** Clip open/close toggle. */
  tryToggleClip(partId: string): boolean {
    const cfg = this.partConfigs.get(partId);
    if (!cfg || parseKind(cfg.kind) !== 'clip') return false;
    const state = this.getState(partId);
    if (state === 'clip_closed') {
      const step = openStep(partId);
      if (!this.prereqsMet(step)) {
        this.penalize(
          `pry:${partId}`,
          this.config.scoring.deductClipPry,
          cfg.pryTip || `⚠️ 无法打开 ${cfg.displayName}`,
        );
        return false;
      }
      this.states.set(partId, 'clip_open');
      this.complete(step);
      emitTip(`✅ 已打开 ${cfg.displayName}`);
      return true;
    }
    const step = closeStep(partId);
    if (!this.prereqsMet(step)) {
      this.penalize(
        `close:${partId}`,
        this.config.scoring.deductIllegalOrder,
        cfg.installLockedTip || `⚠️ 无法锁止 ${cfg.displayName}`,
      );
      return false;
    }
    this.states.set(partId, 'clip_closed');
    this.complete(step);
    emitTip(`✅ 已锁止 ${cfg.displayName}`);
    return true;
  }
}

let current: LockManager | null = null;

export function setLockManager(m: LockManager | null): void {
  current = m;
}

export function getLockManager(): LockManager | null {
  return current;
}
