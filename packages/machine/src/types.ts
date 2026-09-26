/** Logical meters in training world space (Y-up). */
export type Vec3 = [number, number, number];

export type PartKind = 'fixed_shell' | 'grabbable' | 'clip' | 'rotate_nut';

export type VisualAdapter = 'kitbash' | 'gltf';

export type NutThread = 'normal' | 'reverse';

export type CleanSpace = 'world' | 'part_local';

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

export interface PartAnchor {
  position: Vec3;
  /** Euler XYZ radians; omitted = [0,0,0] */
  rotation?: Vec3;
}

export interface PartVisual {
  adapter: VisualAdapter;
  /** Key into Kitbash geometry registry when adapter === 'kitbash' */
  kitbashKey?: string;
  gltfUrl?: string;
  nodeName?: string;
}

export interface PartTips {
  removeLocked?: string;
  installLocked?: string;
  pry?: string;
  wrongDirection?: string;
}

export interface PartDef {
  partId: string;
  displayName: string;
  kind: PartKind;
  anchor: PartAnchor;
  visual: PartVisual;
  removePrereqs: string[];
  installPrereqs: string[];
  tips: PartTips;
  snapRangeMeters?: number;
  thread?: NutThread;
}

export interface CleanSpotDef {
  cleanId: string;
  displayName: string;
  /** Owning part; usually must be removed before clean activates */
  partId: string;
  position: Vec3;
  space: CleanSpace;
  radiusMeters: number;
  dwellMs: number;
  /** e.g. clean_oil_box */
  stepId: string;
}

export interface MachineDef {
  machineId: string;
  displayName: string;
  unit: 'meter';
  scoring: ScoringConfig;
  assemblyDefaults: AssemblyDefaults;
  parts: PartDef[];
  cleanSpots: CleanSpotDef[];
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

export function cleanStep(cleanId: string): string {
  return `clean_${cleanId}`;
}
