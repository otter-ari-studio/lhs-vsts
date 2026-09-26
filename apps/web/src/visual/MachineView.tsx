import { useEffect, useSyncExternalStore } from 'react';
import type { MachineDef } from '@lhs-vsts/machine';
import {
  getTrainingSession,
  subscribeSession,
} from '@lhs-vsts/machine';
import { closeStep, installStep, openStep, removeStep } from '@lhs-vsts/machine';
import { ClipPart } from '../interaction/ClipPart';
import { GrabInstallGhost, GrabPart } from '../interaction/GrabPart';
import { NutPart } from '../interaction/NutPart';
import { operationSurfaceHub } from '../interaction/operationSurfaceHub';
import { surfaceZFromPartAnchors } from '../interaction/operationSurface';
import { partInventory } from '../interaction/partInventory';
import { resetGrabHold } from '../interaction/grabHoldHub';
import { KitbashPart } from './kitbash/KitbashAdapter';

interface MachineViewProps {
  def: MachineDef;
}

function FixedShell({ part }: { part: MachineDef['parts'][number] }) {
  const rotation = part.anchor.rotation ?? [0, 0, 0];
  return (
    <group
      name={part.partId}
      position={part.anchor.position}
      rotation={rotation}
      userData={{ partId: part.partId, kind: part.kind }}
    >
      {part.visual.adapter === 'kitbash' && part.visual.kitbashKey ? (
        <KitbashPart kitbashKey={part.visual.kitbashKey} />
      ) : null}
    </group>
  );
}

/**
 * Current SOP part(s). For clip open/close, include every clip that is ready
 * for the same action so left/right both light up instead of only chrome's first row.
 */
function currentSopPartIds(def: MachineDef): Set<string> {
  const session = getTrainingSession();
  if (!session) return new Set();
  const snap = session.snapshot();
  const current = snap.steps.find((s) => s.status === 'current');
  if (!current) return new Set();
  const id = current.stepId;
  const ids = new Set<string>();
  const completed = new Set(snap.completedSteps);

  if (id.startsWith('open_')) {
    for (const part of def.parts) {
      if (part.kind !== 'clip') continue;
      if (session.getState(part.partId) !== 'clip_closed') continue;
      if (part.removePrereqs.every((p) => completed.has(p))) {
        ids.add(part.partId);
      }
    }
    if (ids.size > 0) return ids;
  }

  if (id.startsWith('close_')) {
    for (const part of def.parts) {
      if (part.kind !== 'clip') continue;
      if (session.getState(part.partId) !== 'clip_open') continue;
      if (part.installPrereqs.every((p) => completed.has(p))) {
        ids.add(part.partId);
      }
    }
    if (ids.size > 0) return ids;
  }

  for (const part of def.parts) {
    if (
      id === removeStep(part.partId) ||
      id === installStep(part.partId) ||
      id === openStep(part.partId) ||
      id === closeStep(part.partId)
    ) {
      ids.add(part.partId);
    }
  }
  return ids;
}

/**
 * Mounts every MachineDef part with interaction wrappers.
 * Future GLTF adapter swaps visual only — same partId / anchors.
 */
export function MachineView({ def }: MachineViewProps) {
  useSyncExternalStore(
    subscribeSession,
    () => getTrainingSession()?.getRevision() ?? 0,
    () => 0,
  );
  const invKey = useSyncExternalStore(
    (cb) => partInventory.subscribe(cb),
    () => partInventory.list().join('|'),
    () => '',
  );
  void invKey;

  useEffect(() => {
    partInventory.clear();
    resetGrabHold();
    return () => {
      operationSurfaceHub.clear();
    };
  }, [def.machineId]);

  const sopTargets = currentSopPartIds(def);
  const sopKey = [...sopTargets].sort().join('|');
  const snapRange = def.assemblyDefaults.snapRangeMeters;
  const session = getTrainingSession();

  useEffect(() => {
    const sopIds = sopKey ? sopKey.split('|') : [];
    const sopZs = sopIds.map((id) => {
      const p = def.parts.find((x) => x.partId === id);
      return p?.anchor.position[2] ?? 0.22;
    });
    operationSurfaceHub.set({
      z: surfaceZFromPartAnchors(sopZs),
      partIds: sopIds,
    });
  }, [def.parts, sopKey]);

  return (
    <group name={`machine:${def.machineId}`}>
      {def.parts.map((part) => {
        const isTarget = sopTargets.has(part.partId);
        if (part.kind === 'fixed_shell') {
          return <FixedShell key={part.partId} part={part} />;
        }
        if (part.kind === 'grabbable') {
          const showInstallGhost =
            isTarget &&
            session?.getState(part.partId) === 'removed' &&
            !!session?.canInstall(part.partId);
          return (
            <group key={part.partId}>
              <GrabPart part={part} snapRange={snapRange} isSopTarget={isTarget} />
              <GrabInstallGhost part={part} active={!!showInstallGhost} />
            </group>
          );
        }
        if (part.kind === 'clip') {
          return <ClipPart key={part.partId} part={part} isSopTarget={isTarget} />;
        }
        if (part.kind === 'rotate_nut') {
          return <NutPart key={part.partId} part={part} isSopTarget={isTarget} />;
        }
        return null;
      })}
    </group>
  );
}
