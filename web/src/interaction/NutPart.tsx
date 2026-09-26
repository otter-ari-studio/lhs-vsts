import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Vector3 } from 'three';
import { getTrainingSession, subscribeSession } from '../machine';
import type { PartDef, Vec3 } from '../machine/types';
import { KitbashPart } from '../visual/kitbash/KitbashAdapter';
import {
  COLLIDER_RADIUS,
  INSTALLED_PICK_PRIORITY,
  REMOVED_PICK_PRIORITY,
  SOP_PICK_PRIORITY,
} from './defaults';
import { isInstallOfferPart, PROP_OFFER_POS } from './partOffer';
import { surfaceDistance } from './operationSurface';
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
const PARK_OFFSET: Vec3 = [0.22, 0.08, 0.12];

export function NutPart({ part, isSopTarget }: NutPartProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const [removed, setRemoved] = useState(false);
  const sopRef = useRef(isSopTarget);
  sopRef.current = isSopTarget;
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];
  const carrying = useRef(false);
  const grabOffset = useRef(new Vector3());
  const followPos = useRef(new Vector3(...part.anchor.position));
  const homePos = useMemo(
    () => new Vector3(...part.anchor.position),
    [part.anchor.position],
  );
  const spinUntil = useRef(0);
  const popT = useRef(0);
  const offerTipShown = useRef(false);

  useEffect(() => {
    const sync = () => {
      const mgr = getTrainingSession();
      if (mgr) setRemoved(mgr.getState(part.partId) === 'removed');
    };
    sync();
    return subscribeSession(sync);
  }, [part.partId]);

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: part.partId,
      kind: 'rotate_nut',
      interactionRadius: COLLIDER_RADIUS.grabbable,
      isInteractableNow() {
        const mgr = getTrainingSession();
        if (!mgr) return true;
        if (carrying.current) return false;
        const st = mgr.getState(part.partId);
        if (st === 'installed') return true;
        if (st === 'removed') return isInstallOfferPart(part.partId);
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
        const mgr = getTrainingSession();
        const st = mgr?.getState(part.partId);

        if (st === 'removed' && isInstallOfferPart(part.partId)) {
          carrying.current = true;
          const g = groupRef.current;
          if (g) {
            g.getWorldPosition(_tmp);
            grabOffset.current.set(_tmp.x - handPos.x, _tmp.y - handPos.y, 0);
          }
          return true;
        }

        if (st === 'installed') {
          if (!mgr?.tryNutAction(part.partId)) return false;
          setRemoved(true);
          const follow = '螺母已拧下 · 再点击风轮叶轮取下';
          if (part.thread === 'reverse' && part.tips.wrongDirection) {
            mgr.tip(`${part.tips.wrongDirection} · ${follow}`);
          } else {
            mgr.tip(follow);
          }
          return true;
        }

        return false;
      },
      onPinchHold(handPos) {
        if (!carrying.current) return;
        followPos.current.copy(handPos).add(grabOffset.current);
        followPos.current.z = homePos.z;
      },
      onPinchEnd(handPos) {
        const mgr = getTrainingSession();
        const g = groupRef.current;
        if (carrying.current && mgr && g) {
          carrying.current = false;
          g.getWorldPosition(_tmp);
          const range = Math.max(part.snapRangeMeters ?? 0.08, 0.18);
          const slot: [number, number, number] = [homePos.x, homePos.y, homePos.z];
          const partNear =
            surfaceDistance([_tmp.x, _tmp.y, _tmp.z], slot) <= range;
          const pointerNear =
            surfaceDistance([handPos.x, handPos.y, handPos.z], slot) <= range;
          if ((partNear || pointerNear) && mgr.canInstall(part.partId)) {
            if (mgr.tryInstall(part.partId)) {
              setRemoved(false);
              g.position.copy(homePos);
              followPos.current.copy(homePos);
              spinUntil.current = performance.now() + 700;
              mgr.tip(`✅ 已自动拧上 ${part.displayName}`);
              return;
            }
          }
          g.position.set(...PROP_OFFER_POS);
          followPos.current.set(...PROP_OFFER_POS);
          mgr.tip('放到螺母安装位松手，即可自动拧上');
        }
      },
      onHover(active) {
        setHover(active);
      },
    };
    Object.defineProperty(self, 'interactionRadius', {
      get() {
        if (isInstallOfferPart(part.partId) || sopRef.current) {
          return COLLIDER_RADIUS.rotate_nut_sop;
        }
        return COLLIDER_RADIUS.rotate_nut;
      },
      enumerable: true,
      configurable: true,
    });
    return self;
  }, [part, homePos]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  useFrame(({ clock }, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const mgr = getTrainingSession();
    const st = mgr?.getState(part.partId);
    const offering = !!mgr && st === 'removed' && isInstallOfferPart(part.partId);

    if (carrying.current) {
      const t = 1 - Math.exp(-40 * dt);
      g.position.lerp(followPos.current, t);
    } else if (offering) {
      if (!offerTipShown.current) {
        offerTipShown.current = true;
        popT.current = 0;
        mgr?.tip(`道具已弹出：拖拽「${part.displayName}」放回安装位`);
      }
      popT.current = Math.min(1, popT.current + dt * 3.2);
      const ease = 1 - (1 - popT.current) ** 3;
      const bob = 0.012 * Math.sin(clock.elapsedTime * 5);
      g.position.set(
        PROP_OFFER_POS[0],
        PROP_OFFER_POS[1] + bob + (1 - ease) * 0.12,
        PROP_OFFER_POS[2],
      );
    } else if (st === 'removed') {
      offerTipShown.current = false;
      g.position.set(
        part.anchor.position[0] + PARK_OFFSET[0],
        part.anchor.position[1] + PARK_OFFSET[1],
        part.anchor.position[2] + PARK_OFFSET[2],
      );
    } else {
      offerTipShown.current = false;
      g.position.copy(homePos);
    }

    const mesh = meshRef.current;
    if (mesh) {
      const now = performance.now();
      if (now < spinUntil.current) {
        mesh.rotation.z += dt * 14;
      } else if (spinUntil.current > 0) {
        mesh.rotation.z = 0;
        spinUntil.current = 0;
      }
      const pulse = offering || isSopTarget || hover ? 1.08 : 1;
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
      <group ref={meshRef}>
        {part.visual.adapter === 'kitbash' && part.visual.kitbashKey ? (
          <KitbashPart kitbashKey={part.visual.kitbashKey} />
        ) : null}
      </group>
      <SopTargetHighlight
        active={isSopTarget || (removed && isInstallOfferPart(part.partId))}
        hover={hover}
        radius={0.04}
        ringRadius={0.08}
        label={
          removed && isInstallOfferPart(part.partId)
            ? `拖回 · ${part.displayName}`
            : isSopTarget
              ? part.displayName
              : undefined
        }
      />
    </group>
  );
}
