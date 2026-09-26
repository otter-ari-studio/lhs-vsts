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
import { isInstallOfferPart, PROP_OFFER_POS } from './partOffer';
import { setPartPose } from './partPoseHub';
import { surfaceDistance } from './operationSurface';
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
  const [offered, setOffered] = useState(false);
  const tipShown = useRef(false);
  const sopRef = useRef(isSopTarget);
  sopRef.current = isSopTarget;
  const meshScaleRef = useRef<Group>(null);
  const spinUntil = useRef(0);
  const popT = useRef(0);
  const offerTipShown = useRef(false);
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
        const mgr = getTrainingSession();
        if (!mgr) return true;
        const st = mgr.getState(part.partId);
        // Operation-surface: only the current SOP part is live on the face.
        if (st === 'installed') return sopRef.current;
        if (st === 'removed' && isInstallOfferPart(part.partId)) return true;
        if (partInventory.has(part.partId)) return false;
        if (st === 'removed') return sopRef.current;
        return false;
      },
      pickPriority() {
        if (isInstallOfferPart(part.partId)) return SOP_PICK_PRIORITY + 1;
        if (sopRef.current) return SOP_PICK_PRIORITY;
        const mgr = getTrainingSession();
        const st = mgr?.getState(part.partId);
        if (st === 'removed') return REMOVED_PICK_PRIORITY;
        return INSTALLED_PICK_PRIORITY;
      },
      distanceTo(handPos) {
        const g = groupRef.current;
        if (!g) return Number.POSITIVE_INFINITY;
        g.getWorldPosition(_tmp);
        return surfaceDistance(
          [handPos.x, handPos.y, handPos.z],
          [_tmp.x, _tmp.y, _tmp.z],
        );
      },
      copyWorldPosition(out) {
        const g = groupRef.current;
        if (!g) return false;
        g.getWorldPosition(out);
        return true;
      },
      onPinchStart(handPos) {
        if (grabbed.current) return true;
        const mgr = getTrainingSession();
        const st = mgr?.getState(part.partId) ?? 'installed';
        if (st === 'installed') {
          if (!mgr?.tryBeginRemove(part.partId)) return false;
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
          mgr.tip('点击取下零件，拖到左侧入栏；回装时拖回安装位松手');
        }
        return true;
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
        const range = Math.max(part.snapRangeMeters ?? snapRange, 0.12);
        g.getWorldPosition(_tmp);
        pushThrowSample(throwBuf.current, performance.now(), handPos.x);
        const throwDir = detectLateralThrow(throwBuf.current);
        throwBuf.current = [];

        // Place into slot → auto install (拧上)
        if (_tmp.distanceTo(installedPos) <= range && mgr.canInstall(part.partId)) {
          if (mgr.tryInstall(part.partId)) {
            partInventory.dequeue(part.partId);
            g.position.copy(installedPos);
            followPos.current.copy(installedPos);
            g.visible = true;
            setInInventory(false);
            setOffered(false);
            spinUntil.current = performance.now() + 700;
            mgr.tip(`✅ 已自动拧上 ${part.displayName}`);
            return;
          }
        }

        if (mgr.getState(part.partId) === 'removed') {
          if (isInstallOfferPart(part.partId)) {
            // Still this step — return to offer tray
            g.position.set(...PROP_OFFER_POS);
            followPos.current.set(...PROP_OFFER_POS);
            g.visible = true;
            setOffered(true);
            mgr.tip('放到机身安装位松手，即可自动拧上');
            return;
          }
          partInventory.enqueue(part.partId);
          g.position.set(...INVENTORY_PARK);
          followPos.current.copy(g.position);
          g.visible = false;
          setInInventory(true);
          setOffered(false);
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
    Object.defineProperty(self, 'interactionRadius', {
      get() {
        return sopRef.current || isInstallOfferPart(part.partId)
          ? COLLIDER_RADIUS.grabbable + 0.06
          : COLLIDER_RADIUS.grabbable;
      },
      enumerable: true,
      configurable: true,
    });
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
    const mgr = getTrainingSession();
    const st = mgr?.getState(part.partId);
    const shouldOffer =
      !!mgr && st === 'removed' && isInstallOfferPart(part.partId) && !grabbed.current;

    if (shouldOffer !== offered) {
      setOffered(shouldOffer);
      if (shouldOffer && !offerTipShown.current) {
        offerTipShown.current = true;
        popT.current = 0;
        g.position.set(...PROP_OFFER_POS);
        followPos.current.set(...PROP_OFFER_POS);
        g.visible = true;
        mgr?.tip(`道具已弹出：拖拽「${part.displayName}」放回安装位`);
      }
      if (!shouldOffer) offerTipShown.current = false;
    }

    if (inInventory && !grabbed.current && !shouldOffer) {
      g.visible = false;
      g.position.set(...INVENTORY_PARK);
      setPartPose(part.partId, INVENTORY_PARK);
      return;
    }

    g.visible = true;
    if (grabbed.current) {
      const t = 1 - Math.exp(-40 * dt);
      g.position.lerp(followPos.current, t);
    } else if (shouldOffer) {
      popT.current = Math.min(1, popT.current + dt * 3.2);
      const ease = 1 - (1 - popT.current) ** 3;
      const bob = 0.012 * Math.sin(clock.elapsedTime * 5);
      g.position.set(
        PROP_OFFER_POS[0],
        PROP_OFFER_POS[1] + bob + (1 - ease) * 0.12,
        PROP_OFFER_POS[2],
      );
    }

    setPartPose(part.partId, [g.position.x, g.position.y, g.position.z]);

    const mesh = meshScaleRef.current;
    if (mesh) {
      const now = performance.now();
      if (now < spinUntil.current) {
        mesh.rotation.z += dt * 14;
      } else if (spinUntil.current > 0) {
        mesh.rotation.z = 0;
        spinUntil.current = 0;
      }

      const popScale = shouldOffer ? 0.75 + 0.25 * Math.min(1, popT.current) : 1;
      const pulse = isSopTarget || shouldOffer
        ? 1.04 + 0.05 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 7))
        : hover
          ? 1.03
          : 1;
      mesh.scale.setScalar(pulse * popScale);
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
        active={(isSopTarget || offered) && !grabbed.current}
        hover={hover}
        radius={0.05}
        ringRadius={0.1}
        label={
          offered
            ? `拖回 · ${part.displayName}`
            : isSopTarget && !inInventory
              ? part.displayName
              : undefined
        }
      />
    </group>
  );
}

/**
 * Visual install slot only — pinch-to-install disabled.
 * Props are grabbed from the offer tray and snapped in by GrabPart.
 */
export function GrabInstallGhost({
  part,
  active,
}: {
  part: PartDef;
  active: boolean;
  snapRange?: number;
}) {
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];
  if (!active) return null;

  return (
    <group
      position={part.anchor.position}
      rotation={rotation}
      name={`${part.partId}:install-ghost`}
    >
      <mesh>
        <boxGeometry args={[0.12, 0.08, 0.06]} />
        <meshBasicMaterial color="#3ddc97" wireframe transparent opacity={0.55} />
      </mesh>
      <SopTargetHighlight
        active
        radius={0.04}
        ringRadius={0.09}
        label="放入此处"
      />
    </group>
  );
}
