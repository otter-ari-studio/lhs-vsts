import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Vector3 } from 'three';
import { getTrainingSession } from '../machine/TrainingSession';
import type { PartDef, Vec3 } from '../machine/types';
import { KitbashPart } from '../visual/kitbash/KitbashAdapter';
import {
  COLLIDER_RADIUS,
  INSTALLED_PICK_PRIORITY,
  REMOVED_PICK_PRIORITY,
  SOP_PICK_PRIORITY,
} from './defaults';
import {
  claimDropSlot,
  distanceToDropTray,
  releaseDropSlot,
} from './dropTray';
import { setGrabHolding } from './grabHoldHub';
import { setPartPose } from './partPoseHub';
import {
  registerInteractable,
  unregisterInteractable,
  type HandInteractable,
} from './registry';
import { SopTargetHighlight } from './SopTargetHighlight';

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
  const tipShown = useRef(false);
  const sopRef = useRef(isSopTarget);
  sopRef.current = isSopTarget;
  const meshScaleRef = useRef<Group>(null);
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: part.partId,
      kind: 'grabbable',
      interactionRadius: COLLIDER_RADIUS.grabbable,
      isInteractableNow() {
        if (grabbed.current) return false;
        const mgr = getTrainingSession();
        if (!mgr) return true;
        const st = mgr.getState(part.partId);
        // Installed: can detach. Removed: only re-pick when it is the SOP install target
        // (parts on the tray must not stick when the hand passes by).
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
      onPinchStart(handPos) {
        if (grabbed.current) return;
        const mgr = getTrainingSession();
        const st = mgr?.getState(part.partId) ?? 'installed';
        if (st === 'installed') {
          if (!mgr?.tryBeginRemove(part.partId)) return;
          mgr.notifyRemoved(part.partId);
        }
        grabbed.current = true;
        setGrabHolding(part.partId, true);
        const g = groupRef.current;
        if (g) {
          g.getWorldPosition(_tmp);
          grabOffset.current.copy(_tmp).sub(handPos);
        }
        if (mgr && !tipShown.current) {
          tipShown.current = true;
          mgr.tip('捏紧约半秒取下 → 松开放到左侧绿色放置区；回装时对准机身闪烁位');
        }
      },
      onPinchHold(handPos) {
        if (!grabbed.current) return;
        followPos.current.copy(handPos).add(grabOffset.current);
      },
      onPinchEnd() {
        if (!grabbed.current) return;
        grabbed.current = false;
        setGrabHolding(part.partId, false);
        const mgr = getTrainingSession();
        const g = groupRef.current;
        if (!mgr || !g) return;
        const range = part.snapRangeMeters ?? snapRange;
        g.getWorldPosition(_tmp);
        const distTray = distanceToDropTray(_tmp);

        if (_tmp.distanceTo(installedPos) <= range && mgr.tryInstall(part.partId)) {
          releaseDropSlot(part.partId);
          g.position.copy(installedPos);
          followPos.current.copy(installedPos);
          return;
        }

        if (mgr.getState(part.partId) === 'removed') {
          const slot = claimDropSlot(part.partId);
          g.position.set(slot[0], slot[1], slot[2]);
          followPos.current.copy(g.position);
          if (distTray > 0.15) {
            mgr.tip('零件已放到左侧放置区');
          }
          return;
        }

        mgr.notifyToleranceFail(part.partId);
        g.position.copy(installedPos);
        followPos.current.copy(installedPos);
      },
      onHover(active) {
        setHover(active);
      },
    };
    return self;
  }, [part, snapRange, installedPos, followPos, grabOffset, grabbed, groupRef, setHover, sopRef]);

  useEffect(() => {
    registerInteractable(api);
    return () => {
      unregisterInteractable(api);
      if (grabbed.current) {
        grabbed.current = false;
        setGrabHolding(part.partId, false);
      }
    };
  }, [api, part.partId]);

  useFrame(({ clock }, dt) => {
    const g = groupRef.current;
    if (!g) return;
    if (grabbed.current) {
      const t = 1 - Math.exp(-40 * dt);
      g.position.lerp(followPos.current, t);
    }
    setPartPose(part.partId, [g.position.x, g.position.y, g.position.z]);

    const mesh = meshScaleRef.current;
    if (mesh) {
      const pulse = isSopTarget
        ? 1.04 + 0.05 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 7))
        : hover
          ? 1.03
          : 1;
      mesh.scale.setScalar(pulse);
    }
  });

  return (
    <group
      ref={groupRef}
      name={part.partId}
      position={part.anchor.position}
      rotation={rotation}
      userData={{ partId: part.partId, kind: part.kind }}
    >
      <group ref={meshScaleRef}>
        {part.visual.adapter === 'kitbash' && part.visual.kitbashKey ? (
          <KitbashPart kitbashKey={part.visual.kitbashKey} />
        ) : (
          <mesh>
            <boxGeometry args={[0.06, 0.06, 0.06]} />
            <meshStandardMaterial color="#aa44ff" wireframe />
          </mesh>
        )}
      </group>
      <SopTargetHighlight active={isSopTarget} hover={hover} radius={0.03} ringRadius={0.07} />
    </group>
  );
}

/** Empty install slot marker at the part's home pose (when SOP is install). */
export function GrabInstallGhost({ part, active }: { part: PartDef; active: boolean }) {
  if (!active) return null;
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];
  return (
    <group
      position={part.anchor.position}
      rotation={rotation}
      name={`${part.partId}:install-ghost`}
    >
      <mesh>
        <boxGeometry args={[0.11, 0.07, 0.05]} />
        <meshBasicMaterial color="#3ddc97" wireframe transparent opacity={0.65} />
      </mesh>
      <SopTargetHighlight active radius={0.035} ringRadius={0.08} />
    </group>
  );
}
