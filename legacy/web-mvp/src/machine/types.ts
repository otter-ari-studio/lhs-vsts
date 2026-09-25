export type PartKind = 'grabbable' | 'clip' | 'rotate_nut' | 'fixed_shell';

export interface ScoringConfig {
  baseScore: number;
  deductIllegalOrder: number;
  deductClipPry: number;
  deductNutWrongDirection: number;
  deductToleranceFail: number;
}

export interface AssemblyDefaults {
  positionToleranceMeters: number;
  angleToleranceDegrees: number;
  snapRangeMeters: number;
}

export interface PartConfig {
  partId: string;
  displayName: string;
  kind: string;
  prefabPath: string;
  anchorName: string;
  positionToleranceMeters: number;
  angleToleranceDegrees: number;
  snapRangeMeters: number;
  thread: string;
  removePrereqs: string[];
  installPrereqs: string[];
  removeLockedTip: string;
  installLockedTip: string;
  pryTip: string;
  wrongDirectionTip: string;
}

export interface MachineConfig {
  machineId: string;
  displayName: string;
  unit: string;
  nutThread: string;
  scoring: ScoringConfig;
  assemblyDefaults: AssemblyDefaults;
  parts: PartConfig[];
}

export function parseKind(kind: string): PartKind {
  if (kind === 'clip') return 'clip';
  if (kind === 'rotate_nut') return 'rotate_nut';
  if (kind === 'fixed_shell') return 'fixed_shell';
  return 'grabbable';
}

export function removeStep(partId: string): string {
  return `remove_${partId}`;
}
export function installStep(partId: string): string {
  return `install_${partId}`;
}
export function openStep(partId: string): string {
  return `open_${partId}`;
}
export function closeStep(partId: string): string {
  return `close_${partId}`;
}
