import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Vector3 } from 'three';
import { getTrainingSession } from '../machine/TrainingSession';
import type { PartDef, Vec3 } from '../machine/types';
import { KitbashPart } from '../visual/kitbash/KitbashAdapter';
import {
  COLLIDER_RADIUS,
  INSTALLED_PICK_PRIORITY,
  NUT_DWELL_MS,
  REMOVED_PICK_PRIORITY,
  SOP_PICK_PRIORITY,
} from './defaults';
import { createDwellTracker } from './dwell';
import {
  registerInteractable,
  unregisterInteractable,
  type HandInteractable,
} from './registry';
import { SopTargetHighlight } from './SopTargetHighlight';

interface NutPartProps {
  part: PartDef;
  isSopTarget: boolean;
}

const _tmp = new Vector3();

export function NutPart({ part, isSopTarget }: NutPartProps) {
  const groupRef = useRef<Group>(null);
  const dwell = useRef(createDwellTracker(NUT_DWELL_MS));
  const [hover, setHover] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removed, setRemoved] = useState(false);
  const sopRef = useRef(isSopTarget);
  sopRef.current = isSopTarget;
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];
  const tipShown = useRef(false);

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: part.partId,
      kind: 'rotate_nut',
      interactionRadius: COLLIDER_RADIUS.rotate_nut,
      isInteractableNow() {
        const mgr = getTrainingSession();
        if (!mgr) return true;
        const st = mgr.getState(part.partId);
        if (st === 'installed') return true;
        if (st === 'removed') return sopRef.current;
        return false;
      },
      pickPriority() {
        if (sopRef.current) return SOP_PICK_PRIORITY;
        const mgr = getTrainingSession();
        const st = mgr?.getState(part.partId);
        if (st === 'removed') return REMOVED_PICK_PRIORITY;
        return INSTALLED_PICK_PRIORITY;
      },
      distanceTo(handPos) {
        const g = groupRef.current;
        if (!g) return Number.POSITIVE_INFINITY;
        return g.getWorldPosition(_tmp).distanceTo(handPos);
      },
      onPinchStart() {
        dwell.current.reset();
        setProgress(0);
        const mgr = getTrainingSession();
        if (
          mgr &&
          !tipShown.current &&
          part.thread === 'reverse' &&
          part.tips.wrongDirection
        ) {
          tipShown.current = true;
          mgr.tip(part.tips.wrongDirection);
        }
      },
      onPinchHold(_handPos, dtSec) {
        const done = dwell.current.tick(true, dtSec * 1000);
        setProgress(dwell.current.progress());
        if (done) {
          const mgr = getTrainingSession();
          if (mgr?.tryNutAction(part.partId)) {
            setRemoved(mgr.getState(part.partId) === 'removed');
            dwell.current.reset();
            setProgress(0);
          }
        }
      },
      onPinchEnd() {
        dwell.current.reset();
        setProgress(0);
      },
      onHover(active) {
        setHover(active);
      },
    };
    return self;
  }, [part, dwell, groupRef, setHover, setProgress, setRemoved, tipShown, sopRef]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  useEffect(() => {
    const mgr = getTrainingSession();
    if (mgr) setRemoved(mgr.getState(part.partId) === 'removed');
  }, [part.partId, setRemoved]);

  const pos: Vec3 = removed
    ? [part.anchor.position[0] + 0.12, part.anchor.position[1], part.anchor.position[2]]
    : part.anchor.position;

  return (
    <group
      ref={groupRef}
      name={part.partId}
      position={pos}
      rotation={rotation}
      userData={{ partId: part.partId, kind: part.kind }}
    >
      <group scale={isSopTarget || hover ? 1.08 : 1}>
        {part.visual.adapter === 'kitbash' && part.visual.kitbashKey ? (
          <KitbashPart kitbashKey={part.visual.kitbashKey} />
        ) : null}
      </group>
      {progress > 0 ? (
        <mesh position={[0, 0.04, 0]}>
          <ringGeometry args={[0.025, 0.032, 24, 1, 0, progress * Math.PI * 2]} />
          <meshBasicMaterial color="#3ddc97" />
        </mesh>
      ) : null}
      <SopTargetHighlight
        active={isSopTarget}
        hover={hover}
        radius={0.04}
        ringRadius={0.08}
        label={isSopTarget ? part.displayName : undefined}
      />
    </group>
  );
}
