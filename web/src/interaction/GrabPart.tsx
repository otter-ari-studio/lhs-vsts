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
import { setGrabHolding } from './grabHoldHub';
import { INVENTORY_PARK, partInventory } from './partInventory';
import { setPartPose } from './partPoseHub';
import {
  registerInteractable,
  unregisterInteractable,
  type HandInteractable,
} from './registry';
import { SopTargetHighlight } from './SopTargetHighlight';
import {
  detectLateralThrow,
  pushThrowSample,
  type ThrowSample,
} from './throwDetect';

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
  const throwBuf = useRef<ThrowSample[]>([]);
  const [hover, setHover] = useState(false);
  const [inInventory, setInInventory] = useState(() => partInventory.has(part.partId));
  const tipShown = useRef(false);
  const sopRef = useRef(isSopTarget);
  sopRef.current = isSopTarget;
  const meshScaleRef = useRef<Group>(null);
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];

  useEffect(() => {
    return partInventory.subscribe(() => {
      const now = partInventory.has(part.partId);
      setInInventory(now);
      if (!now) {
        const mgr = getTrainingSession();
        const g = groupRef.current;
        if (g && mgr?.getState(part.partId) === 'installed') {
          g.position.copy(installedPos);
          followPos.current.copy(installedPos);
          g.visible = true;
        }
      }
    });
  }, [part.partId, installedPos, followPos, groupRef]);

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: part.partId,
      kind: 'grabbable',
      interactionRadius: COLLIDER_RADIUS.grabbable,
      isInteractableNow() {
        if (grabbed.current) return false;
        if (partInventory.has(part.partId)) return false;
        const mgr = getTrainingSession();
        if (!mgr) return true;
        const st = mgr.getState(part.partId);
        if (st === 'installed') return true;
        // Removed but not yet bagged — rare; allow SOP re-pick only
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
        throwBuf.current = [];
        setGrabHolding(part.partId, true);
        const g = groupRef.current;
        if (g) {
          g.getWorldPosition(_tmp);
          grabOffset.current.copy(_tmp).sub(handPos);
        }
        if (mgr && !tipShown.current) {
          tipShown.current = true;
          mgr.tip('取下后向左或向右甩一下松手 → 进入左侧物品栏；回装捏闪烁安装位');
        }
      },
      onPinchHold(handPos) {
        if (!grabbed.current) return;
        followPos.current.copy(handPos).add(grabOffset.current);
        pushThrowSample(throwBuf.current, performance.now(), handPos.x);
      },
      onPinchEnd(handPos) {
        if (!grabbed.current) return;
        grabbed.current = false;
        setGrabHolding(part.partId, false);
        const mgr = getTrainingSession();
        const g = groupRef.current;
        if (!mgr || !g) return;
        const range = part.snapRangeMeters ?? snapRange;
        g.getWorldPosition(_tmp);
        pushThrowSample(throwBuf.current, performance.now(), handPos.x);
        const throwDir = detectLateralThrow(throwBuf.current);
        throwBuf.current = [];

        if (_tmp.distanceTo(installedPos) <= range && mgr.tryInstall(part.partId)) {
          partInventory.dequeue(part.partId);
          g.position.copy(installedPos);
          followPos.current.copy(installedPos);
          g.visible = true;
          setInInventory(false);
          return;
        }

        if (mgr.getState(part.partId) === 'removed') {
          // Lateral throw L/R → inventory; also bag on plain release away from install.
          partInventory.enqueue(part.partId);
          g.position.set(...INVENTORY_PARK);
          followPos.current.copy(g.position);
          g.visible = false;
          setInInventory(true);
          if (throwDir) {
            mgr.tip(
              throwDir === 'left'
                ? '已甩向左侧 · 零件进入物品栏'
                : '已甩向右侧 · 零件进入物品栏',
            );
          } else {
            mgr.tip('零件已进入左侧物品栏');
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
    if (inInventory && !grabbed.current) {
      g.visible = false;
      g.position.set(...INVENTORY_PARK);
      setPartPose(part.partId, INVENTORY_PARK);
      return;
    }
    g.visible = true;
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
      <SopTargetHighlight
        active={isSopTarget && !inInventory}
        hover={hover}
        radius={0.03}
        ringRadius={0.07}
      />
    </group>
  );
}

/**
 * Install-slot interactable: pinch here while part is in inventory → reinstall.
 */
export function GrabInstallGhost({
  part,
  active,
  snapRange,
}: {
  part: PartDef;
  active: boolean;
  snapRange: number;
}) {
  const groupRef = useRef<Group>(null);
  const sopActive = useRef(active);
  sopActive.current = active;
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];
  const _local = useMemo(() => new Vector3(), []);

  const api = useMemo(() => {
    const home = new Vector3(...part.anchor.position);
    const self: HandInteractable = {
      id: `${part.partId}:install-slot`,
      kind: 'grabbable',
      interactionRadius: Math.max(COLLIDER_RADIUS.grabbable, snapRange * 1.5),
      isInteractableNow() {
        return sopActive.current && partInventory.has(part.partId);
      },
      pickPriority: () => SOP_PICK_PRIORITY,
      distanceTo(handPos) {
        return home.distanceTo(handPos);
      },
      onPinchStart() {
        const mgr = getTrainingSession();
        if (!mgr || !partInventory.has(part.partId)) return;
        if (mgr.tryInstall(part.partId)) {
          partInventory.dequeue(part.partId);
          mgr.tip(`已回装 · ${part.displayName}`);
        }
      },
      onPinchHold() {},
      onPinchEnd() {},
    };
    return self;
  }, [part, snapRange, _local]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  // Sync mesh visibility when install succeeds elsewhere
  useEffect(() => {
    return partInventory.subscribe(() => {
      /* GrabPart listens too — ghost only needs active prop from parent */
    });
  }, []);

  if (!active) return null;

  return (
    <group
      ref={groupRef}
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
