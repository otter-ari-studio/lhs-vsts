import { useEffect, useSyncExternalStore } from 'react';
import type { MachineDef } from '../machine/types';
import { getTrainingSession, subscribeSession } from '../machine';
import { closeStep, installStep, openStep, removeStep } from '../machine/types';
import { ClipPart } from '../interaction/ClipPart';
import { CleanSpotMesh } from '../interaction/CleanSpot';
import { GrabInstallGhost, GrabPart } from '../interaction/GrabPart';
import { NutPart } from '../interaction/NutPart';
import { getPartPose } from '../interaction/partPoseHub';
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

function currentSopPartIds(def: MachineDef): Set<string> {
  const session = getTrainingSession();
  if (!session) return new Set();
  const snap = session.snapshot();
  const current = snap.steps.find((s) => s.status === 'current');
  if (!current) return new Set();
  const id = current.stepId;
  const ids = new Set<string>();
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
  for (const spot of def.cleanSpots) {
    if (id === spot.stepId) ids.add(`clean:${spot.cleanId}`);
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
  }, [def.machineId]);

  const sopTargets = currentSopPartIds(def);
  const snapRange = def.assemblyDefaults.snapRangeMeters;
  const session = getTrainingSession();

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
            partInventory.has(part.partId);
          return (
            <group key={part.partId}>
              <GrabPart part={part} snapRange={snapRange} isSopTarget={isTarget} />
              <GrabInstallGhost
                part={part}
                active={!!showInstallGhost}
                snapRange={snapRange}
              />
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
      {def.cleanSpots.map((spot) => {
        const part = def.parts.find((p) => p.partId === spot.partId);
        const pose =
          getPartPose(spot.partId) ?? part?.anchor.position ?? ([0, 0, 0] as const);
        return (
          <CleanSpotMesh
            key={spot.cleanId}
            spot={spot}
            partWorldPos={[pose[0], pose[1], pose[2]]}
            isSopTarget={sopTargets.has(`clean:${spot.cleanId}`)}
          />
        );
      })}
    </group>
  );
}
