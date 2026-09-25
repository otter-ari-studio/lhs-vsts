import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Vector3 } from 'three';
import { getTrainingSession } from '../machine/TrainingSession';
import type { PartDef, Vec3 } from '../machine/types';
import { KitbashPart } from '../visual/kitbash/KitbashAdapter';
import { COLLIDER_RADIUS } from './defaults';
import {
  registerInteractable,
  unregisterInteractable,
  type HandInteractable,
} from './registry';

interface ClipPartProps {
  part: PartDef;
  isSopTarget: boolean;
}

const _tmp = new Vector3();

export function ClipPart({ part, isSopTarget }: ClipPartProps) {
  const groupRef = useRef<Group>(null);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: part.partId,
      kind: 'clip',
      interactionRadius: COLLIDER_RADIUS.clip,
      isInteractableNow: () => true,
      distanceTo(handPos) {
        const g = groupRef.current;
        if (!g) return Number.POSITIVE_INFINITY;
        return g.getWorldPosition(_tmp).distanceTo(handPos);
      },
      onPinchStart() {
        const mgr = getTrainingSession();
        if (!mgr) return;
        if (mgr.tryToggleClip(part.partId)) {
          setOpen(mgr.getState(part.partId) === 'clip_open');
        }
      },
      onPinchHold() {},
      onPinchEnd() {},
      onHover(active) {
        setHover(active);
      },
    };
    return self;
  }, [part.partId, groupRef, setHover, setOpen]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  // Sync open from session (e.g. restart).
  useEffect(() => {
    const mgr = getTrainingSession();
    if (mgr) setOpen(mgr.getState(part.partId) === 'clip_open');
  }, [part.partId, setOpen]);

  const highlight = hover || isSopTarget;

  return (
    <group
      ref={groupRef}
      name={part.partId}
      position={part.anchor.position}
      rotation={[rotation[0], rotation[1], rotation[2] + (open ? 0.7 : 0)]}
      userData={{ partId: part.partId, kind: part.kind }}
    >
      <group scale={highlight ? 1.05 : 1}>
        {part.visual.adapter === 'kitbash' && part.visual.kitbashKey ? (
          <KitbashPart kitbashKey={part.visual.kitbashKey} />
        ) : null}
      </group>
      {highlight ? (
        <mesh>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshBasicMaterial
            color={isSopTarget ? '#3ddc97' : '#f0c14a'}
            transparent
            opacity={0.55}
          />
        </mesh>
      ) : null}
    </group>
  );
}
