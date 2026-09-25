import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Vector3 } from 'three';
import { getTrainingSession } from '../machine/TrainingSession';
import type { PartDef, Vec3 } from '../machine/types';
import { KitbashPart } from '../visual/kitbash/KitbashAdapter';
import { COLLIDER_RADIUS } from './defaults';
import { setPartPose } from './partPoseHub';
import {
  registerInteractable,
  unregisterInteractable,
  type HandInteractable,
} from './registry';

interface GrabPartProps {
  part: PartDef;
  snapRange: number;
  isSopTarget: boolean;
}

const _tmp = new Vector3();

export function GrabPart({ part, snapRange, isSopTarget }: GrabPartProps) {
  const groupRef = useRef<Group>(null);
  const grabbed = useRef(false);
  const grabOffset = useRef(new Vector3());
  const followPos = useRef(new Vector3(...part.anchor.position));
  const installedPos = useMemo(
    () => new Vector3(...part.anchor.position),
    [part.anchor.position],
  );
  const [hover, setHover] = useState(false);
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: part.partId,
      kind: 'grabbable',
      interactionRadius: part.snapRangeMeters ?? COLLIDER_RADIUS.grabbable,
      isInteractableNow() {
        if (grabbed.current) return false;
        const mgr = getTrainingSession();
        if (!mgr) return true;
        const st = mgr.getState(part.partId);
        return st === 'installed' || st === 'removed';
      },
      distanceTo(handPos) {
        const g = groupRef.current;
        if (!g) return Number.POSITIVE_INFINITY;
        return g.getWorldPosition(_tmp).distanceTo(handPos);
      },
      onPinchStart(handPos) {
        if (grabbed.current) return;
        const mgr = getTrainingSession();
        const st = mgr?.getState(part.partId) ?? 'installed';
        if (st === 'installed') {
          if (!mgr?.tryBeginRemove(part.partId)) return;
          mgr.notifyRemoved(part.partId);
        }
        grabbed.current = true;
        const g = groupRef.current;
        if (g) {
          g.getWorldPosition(_tmp);
          grabOffset.current.copy(_tmp).sub(handPos);
        }
      },
      onPinchHold(handPos) {
        if (!grabbed.current) return;
        followPos.current.copy(handPos).add(grabOffset.current);
      },
      onPinchEnd() {
        if (!grabbed.current) return;
        grabbed.current = false;
        const mgr = getTrainingSession();
        const g = groupRef.current;
        if (!mgr || !g) return;
        const range = part.snapRangeMeters ?? snapRange;
        g.getWorldPosition(_tmp);
        const dist = _tmp.distanceTo(installedPos);
        if (dist <= range) {
          if (mgr.tryInstall(part.partId)) {
            g.position.copy(installedPos);
            followPos.current.copy(installedPos);
          }
        } else if (mgr.getState(part.partId) === 'removed') {
          // Stay where dropped (already removed).
        } else {
          mgr.notifyToleranceFail(part.partId);
          g.position.copy(installedPos);
          followPos.current.copy(installedPos);
        }
      },
      onHover(active) {
        setHover(active);
      },
    };
    return self;
  }, [part, snapRange, installedPos, followPos, grabOffset, grabbed, groupRef, setHover]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    if (grabbed.current) {
      const t = 1 - Math.exp(-40 * dt);
      g.position.lerp(followPos.current, t);
    }
    setPartPose(part.partId, [g.position.x, g.position.y, g.position.z]);
  });

  const highlight = hover || isSopTarget;

  return (
    <group
      ref={groupRef}
      name={part.partId}
      position={part.anchor.position}
      rotation={rotation}
      userData={{ partId: part.partId, kind: part.kind }}
    >
      <group scale={highlight ? 1.03 : 1}>
        {part.visual.adapter === 'kitbash' && part.visual.kitbashKey ? (
          <KitbashPart kitbashKey={part.visual.kitbashKey} />
        ) : (
          <mesh>
            <boxGeometry args={[0.06, 0.06, 0.06]} />
            <meshStandardMaterial color="#aa44ff" wireframe />
          </mesh>
        )}
      </group>
      {highlight ? (
        <mesh>
          <sphereGeometry args={[0.02, 8, 8]} />
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
