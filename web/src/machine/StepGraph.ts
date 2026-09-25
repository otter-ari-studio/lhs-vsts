import {
  closeStep,
  installStep,
  openStep,
  removeStep,
  type MachineDef,
  type PartDef,
} from './types';

export type PartRuntimeState = 'installed' | 'removed' | 'clip_open' | 'clip_closed';

export interface StepInfo {
  stepId: string;
  /** Human label for chrome */
  label: string;
  prereqs: string[];
}

/** Build remove/open/install/close/clean step → prereq map from MachineDef. */
export function buildStepPrereqs(def: MachineDef): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const part of def.parts) {
    if (part.kind === 'fixed_shell') continue;
    if (part.kind === 'clip') {
      map.set(openStep(part.partId), [...part.removePrereqs]);
      map.set(closeStep(part.partId), [...part.installPrereqs]);
    } else {
      map.set(removeStep(part.partId), [...part.removePrereqs]);
      map.set(installStep(part.partId), [...part.installPrereqs]);
    }
  }

  for (const spot of def.cleanSpots) {
    // Clean activates after the owning part is removed.
    map.set(spot.stepId, [removeStep(spot.partId)]);
  }

  return map;
}

/** Default curriculum: every non-shell step in topological order. */
export function buildRequiredSteps(def: MachineDef): string[] {
  const prereqs = buildStepPrereqs(def);
  return topoSortSteps([...prereqs.keys()], prereqs);
}

export function topoSortSteps(
  stepIds: string[],
  prereqs: Map<string, string[]>,
): string[] {
  const remaining = new Set(stepIds);
  const done = new Set<string>();
  const ordered: string[] = [];

  // Steps may reference prereqs not in the set (treat as already satisfied for ordering).
  while (remaining.size > 0) {
    let progressed = false;
    for (const id of [...remaining]) {
      const req = prereqs.get(id) ?? [];
      if (req.every((r) => done.has(r) || !remaining.has(r))) {
        ordered.push(id);
        done.add(id);
        remaining.delete(id);
        progressed = true;
      }
    }
    if (!progressed) {
      // Cycle or missing — append rest in stable order.
      ordered.push(...[...remaining].sort());
      break;
    }
  }
  return ordered;
}

export function prereqsMet(
  stepId: string,
  completed: ReadonlySet<string>,
  prereqs: Map<string, string[]>,
): boolean {
  const req = prereqs.get(stepId) ?? [];
  return req.every((s) => completed.has(s));
}

export function initialPartStates(def: MachineDef): Map<string, PartRuntimeState> {
  const states = new Map<string, PartRuntimeState>();
  for (const part of def.parts) {
    if (part.kind === 'fixed_shell') continue;
    if (part.kind === 'clip') {
      states.set(part.partId, 'clip_closed');
    } else {
      states.set(part.partId, 'installed');
    }
  }
  return states;
}

export function stepLabel(def: MachineDef, stepId: string): string {
  for (const part of def.parts) {
    if (stepId === removeStep(part.partId)) return `拆下 ${part.displayName}`;
    if (stepId === installStep(part.partId)) return `回装 ${part.displayName}`;
    if (stepId === openStep(part.partId)) return `打开 ${part.displayName}`;
    if (stepId === closeStep(part.partId)) return `锁止 ${part.displayName}`;
  }
  for (const spot of def.cleanSpots) {
    if (stepId === spot.stepId) return spot.displayName;
  }
  return stepId;
}

export function listStepInfos(def: MachineDef): StepInfo[] {
  const prereqs = buildStepPrereqs(def);
  return buildRequiredSteps(def).map((stepId) => ({
    stepId,
    label: stepLabel(def, stepId),
    prereqs: prereqs.get(stepId) ?? [],
  }));
}

export function findPartDef(def: MachineDef, partId: string): PartDef | undefined {
  return def.parts.find((p) => p.partId === partId);
}

/** Whether curriculum is passed (all required steps completed). Score ignored. */
export function isPassed(
  requiredSteps: readonly string[],
  completed: ReadonlySet<string>,
): boolean {
  return requiredSteps.every((s) => completed.has(s));
}

/** Missing prereqs for a step (for chrome lock reasons). */
export function missingPrereqs(
  stepId: string,
  completed: ReadonlySet<string>,
  prereqs: Map<string, string[]>,
): string[] {
  return (prereqs.get(stepId) ?? []).filter((s) => !completed.has(s));
}
