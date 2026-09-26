import type {
  AssemblyDefaults,
  CleanSpace,
  CleanSpotDef,
  MachineDef,
  NutThread,
  PartDef,
  PartKind,
  PartTips,
  PartVisual,
  ScoringConfig,
  Vec3,
  VisualAdapter,
} from './types.js';

const PART_KINDS = new Set<PartKind>([
  'fixed_shell',
  'grabbable',
  'clip',
  'rotate_nut',
]);

const VISUAL_ADAPTERS = new Set<VisualAdapter>(['kitbash', 'gltf']);
const THREADS = new Set<NutThread>(['normal', 'reverse']);
const SPACES = new Set<CleanSpace>(['world', 'part_local']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`MachineDef: ${field} must be a non-empty string`);
  }
  return v;
}

function asOptionalString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') {
    throw new Error('MachineDef: optional string field has wrong type');
  }
  return v;
}

function asNumber(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`MachineDef: ${field} must be a finite number`);
  }
  return v;
}

function asStringArray(v: unknown, field: string): string[] {
  if (!Array.isArray(v)) {
    throw new Error(`MachineDef: ${field} must be an array`);
  }
  return v.map((item, i) => asString(item, `${field}[${i}]`));
}

function asVec3(v: unknown, field: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3) {
    throw new Error(`MachineDef: ${field} must be [x,y,z]`);
  }
  return [
    asNumber(v[0], `${field}[0]`),
    asNumber(v[1], `${field}[1]`),
    asNumber(v[2], `${field}[2]`),
  ];
}

function parseScoring(raw: unknown): ScoringConfig {
  if (!isRecord(raw)) throw new Error('MachineDef: scoring must be an object');
  return {
    baseScore: asNumber(raw.baseScore, 'scoring.baseScore'),
    deductIllegalOrder: asNumber(raw.deductIllegalOrder, 'scoring.deductIllegalOrder'),
    deductClipPry: asNumber(raw.deductClipPry, 'scoring.deductClipPry'),
    deductNutWrongDirection: asNumber(
      raw.deductNutWrongDirection,
      'scoring.deductNutWrongDirection',
    ),
    deductToleranceFail: asNumber(raw.deductToleranceFail, 'scoring.deductToleranceFail'),
  };
}

function parseAssemblyDefaults(raw: unknown): AssemblyDefaults {
  if (!isRecord(raw)) {
    throw new Error('MachineDef: assemblyDefaults must be an object');
  }
  return {
    positionToleranceMeters: asNumber(
      raw.positionToleranceMeters,
      'assemblyDefaults.positionToleranceMeters',
    ),
    angleToleranceDegrees: asNumber(
      raw.angleToleranceDegrees,
      'assemblyDefaults.angleToleranceDegrees',
    ),
    snapRangeMeters: asNumber(raw.snapRangeMeters, 'assemblyDefaults.snapRangeMeters'),
  };
}

function parseKind(raw: unknown, field: string): PartKind {
  const s = asString(raw, field);
  if (!PART_KINDS.has(s as PartKind)) {
    throw new Error(`MachineDef: unknown part kind "${s}"`);
  }
  return s as PartKind;
}

function parseVisual(raw: unknown, partId: string): PartVisual {
  if (!isRecord(raw)) {
    throw new Error(`MachineDef: parts[${partId}].visual must be an object`);
  }
  const adapter = asString(raw.adapter, `parts[${partId}].visual.adapter`);
  if (!VISUAL_ADAPTERS.has(adapter as VisualAdapter)) {
    throw new Error(`MachineDef: unknown visual adapter "${adapter}"`);
  }
  const visual: PartVisual = { adapter: adapter as VisualAdapter };
  const kitbashKey = asOptionalString(raw.kitbashKey);
  const gltfUrl = asOptionalString(raw.gltfUrl);
  const nodeName = asOptionalString(raw.nodeName);
  if (kitbashKey) visual.kitbashKey = kitbashKey;
  if (gltfUrl) visual.gltfUrl = gltfUrl;
  if (nodeName) visual.nodeName = nodeName;
  if (visual.adapter === 'kitbash' && !visual.kitbashKey) {
    throw new Error(`MachineDef: parts[${partId}] kitbash visual needs kitbashKey`);
  }
  return visual;
}

function parseTips(raw: unknown): PartTips {
  if (raw === undefined || raw === null) return {};
  if (!isRecord(raw)) throw new Error('MachineDef: tips must be an object');
  const tips: PartTips = {};
  const removeLocked = asOptionalString(raw.removeLocked);
  const installLocked = asOptionalString(raw.installLocked);
  const pry = asOptionalString(raw.pry);
  const wrongDirection = asOptionalString(raw.wrongDirection);
  if (removeLocked) tips.removeLocked = removeLocked;
  if (installLocked) tips.installLocked = installLocked;
  if (pry) tips.pry = pry;
  if (wrongDirection) tips.wrongDirection = wrongDirection;
  return tips;
}

function parseThread(raw: unknown, field: string): NutThread | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const s = asString(raw, field);
  if (!THREADS.has(s as NutThread)) {
    throw new Error(`MachineDef: unknown thread "${s}"`);
  }
  return s as NutThread;
}

function parsePart(raw: unknown, index: number): PartDef {
  if (!isRecord(raw)) {
    throw new Error(`MachineDef: parts[${index}] must be an object`);
  }
  const partId = asString(raw.partId, `parts[${index}].partId`);
  if ('prefabPath' in raw && raw.prefabPath) {
    throw new Error(
      `MachineDef: parts[${partId}] must not include Unity prefabPath (use visual.adapter)`,
    );
  }
  if (!isRecord(raw.anchor)) {
    throw new Error(`MachineDef: parts[${partId}].anchor must be an object`);
  }
  const anchor: PartDef['anchor'] = {
    position: asVec3(raw.anchor.position, `parts[${partId}].anchor.position`),
  };
  if (raw.anchor.rotation !== undefined) {
    anchor.rotation = asVec3(raw.anchor.rotation, `parts[${partId}].anchor.rotation`);
  }

  const part: PartDef = {
    partId,
    displayName: asString(raw.displayName, `parts[${partId}].displayName`),
    kind: parseKind(raw.kind, `parts[${partId}].kind`),
    anchor,
    visual: parseVisual(raw.visual, partId),
    removePrereqs: asStringArray(raw.removePrereqs ?? [], `parts[${partId}].removePrereqs`),
    installPrereqs: asStringArray(raw.installPrereqs ?? [], `parts[${partId}].installPrereqs`),
    tips: parseTips(raw.tips),
  };

  if (raw.snapRangeMeters !== undefined) {
    part.snapRangeMeters = asNumber(raw.snapRangeMeters, `parts[${partId}].snapRangeMeters`);
  }
  const thread = parseThread(raw.thread, `parts[${partId}].thread`);
  if (thread) part.thread = thread;

  return part;
}

function parseCleanSpot(raw: unknown, index: number): CleanSpotDef {
  if (!isRecord(raw)) {
    throw new Error(`MachineDef: cleanSpots[${index}] must be an object`);
  }
  const cleanId = asString(raw.cleanId, `cleanSpots[${index}].cleanId`);
  const spaceRaw = asString(raw.space ?? 'world', `cleanSpots[${cleanId}].space`);
  if (!SPACES.has(spaceRaw as CleanSpace)) {
    throw new Error(`MachineDef: unknown clean space "${spaceRaw}"`);
  }
  return {
    cleanId,
    displayName: asString(raw.displayName, `cleanSpots[${cleanId}].displayName`),
    partId: asString(raw.partId, `cleanSpots[${cleanId}].partId`),
    position: asVec3(raw.position, `cleanSpots[${cleanId}].position`),
    space: spaceRaw as CleanSpace,
    radiusMeters: asNumber(raw.radiusMeters, `cleanSpots[${cleanId}].radiusMeters`),
    dwellMs: asNumber(raw.dwellMs ?? 1500, `cleanSpots[${cleanId}].dwellMs`),
    stepId: asString(raw.stepId, `cleanSpots[${cleanId}].stepId`),
  };
}

/**
 * Decode / validate MachineDef from JSON (fetch or fixture).
 * Rejects Unity `prefabPath` and unknown kinds/adapters.
 */
export function parseMachineDef(raw: unknown): MachineDef {
  if (!isRecord(raw)) throw new Error('MachineDef: root must be an object');

  const unit = asString(raw.unit ?? 'meter', 'unit');
  if (unit !== 'meter') {
    throw new Error(`MachineDef: unit must be "meter", got "${unit}"`);
  }

  const partsRaw = raw.parts;
  if (!Array.isArray(partsRaw) || partsRaw.length === 0) {
    throw new Error('MachineDef: parts must be a non-empty array');
  }
  const parts = partsRaw.map(parsePart);

  const partIds = new Set(parts.map((p) => p.partId));
  if (partIds.size !== parts.length) {
    throw new Error('MachineDef: duplicate partId');
  }

  const cleanRaw = raw.cleanSpots ?? [];
  if (!Array.isArray(cleanRaw)) {
    throw new Error('MachineDef: cleanSpots must be an array');
  }
  const cleanSpots = cleanRaw.map(parseCleanSpot);
  for (const spot of cleanSpots) {
    if (!partIds.has(spot.partId)) {
      throw new Error(
        `MachineDef: cleanSpots[${spot.cleanId}] references unknown partId "${spot.partId}"`,
      );
    }
  }

  return {
    machineId: asString(raw.machineId, 'machineId'),
    displayName: asString(raw.displayName, 'displayName'),
    unit: 'meter',
    scoring: parseScoring(raw.scoring),
    assemblyDefaults: parseAssemblyDefaults(raw.assemblyDefaults),
    parts,
    cleanSpots,
  };
}

/** List partIds in definition order (stable mount order for visuals). */
export function listPartIds(def: MachineDef): string[] {
  return def.parts.map((p) => p.partId);
}

export function findPart(def: MachineDef, partId: string): PartDef | undefined {
  return def.parts.find((p) => p.partId === partId);
}
