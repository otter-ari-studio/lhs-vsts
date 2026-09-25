import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Vector3 } from 'three';
import { getTrainingSession, subscribeSession } from '../machine';
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
import { isInstallOfferPart, PROP_OFFER_POS } from './partOffer';
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
  const dwell = useRef(createDwellTracker(NUT_DWELL_MS));
  const [hover, setHover] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removed, setRemoved] = useState(false);
  const sopRef = useRef(isSopTarget);
  sopRef.current = isSopTarget;
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];
  const tipShown = useRef(false);
  const actedThisPinch = useRef(false);
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
        return g.getWorldPosition(_tmp).distanceTo(handPos);
      },
      onPinchStart(handPos) {
        actedThisPinch.current = false;
        dwell.current.reset();
        setProgress(0);
        const mgr = getTrainingSession();
        const st = mgr?.getState(part.partId);

        if (st === 'removed' && isInstallOfferPart(part.partId)) {
          carrying.current = true;
          const g = groupRef.current;
          if (g) {
            g.getWorldPosition(_tmp);
            grabOffset.current.copy(_tmp).sub(handPos);
          }
          // Tighten radius while carrying doesn't matter — already engaged
          return;
        }

        // Tighten for dwell-unscrew: use smaller effective check via distance already
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
      onPinchHold(handPos, dtSec) {
        if (actedThisPinch.current) return;
        const mgr = getTrainingSession();
        const st = mgr?.getState(part.partId);

        if (carrying.current) {
          followPos.current.copy(handPos).add(grabOffset.current);
          return;
        }

        if (st === 'removed') {
          dwell.current.reset();
          setProgress(0);
          return;
        }

        const done = dwell.current.tick(true, dtSec * 1000);
        setProgress(dwell.current.progress());
        if (done) {
          if (mgr?.tryNutAction(part.partId)) {
            actedThisPinch.current = true;
            setRemoved(mgr.getState(part.partId) === 'removed');
            dwell.current.reset();
            setProgress(0);
            if (mgr.getState(part.partId) === 'removed') {
              mgr.tip('螺母已拧下 · 再捏住风轮叶轮取下');
            }
          } else {
            dwell.current.reset();
            setProgress(0);
          }
        }
      },
      onPinchEnd() {
        const mgr = getTrainingSession();
        const g = groupRef.current;
        if (carrying.current && mgr && g) {
          carrying.current = false;
          g.getWorldPosition(_tmp);
          const range = Math.max(part.snapRangeMeters ?? 0.08, 0.12);
          if (_tmp.distanceTo(homePos) <= range && mgr.canInstall(part.partId)) {
            if (mgr.tryInstall(part.partId)) {
              actedThisPinch.current = true;
              setRemoved(false);
              g.position.copy(homePos);
              followPos.current.copy(homePos);
              spinUntil.current = performance.now() + 700;
              mgr.tip(`✅ 已自动拧上 ${part.displayName}`);
              dwell.current.reset();
              setProgress(0);
              return;
            }
          }
          g.position.set(...PROP_OFFER_POS);
          followPos.current.set(...PROP_OFFER_POS);
          mgr.tip('放到螺母安装位松手，即可自动拧上');
        }
        actedThisPinch.current = false;
        dwell.current.reset();
        setProgress(0);
      },
      onHover(active) {
        setHover(active);
      },
    };
    // Prefer smaller pick when unscrewing so wheel isn't stolen — mutate per-frame via getter-like
    Object.defineProperty(self, 'interactionRadius', {
      get() {
        return isInstallOfferPart(part.partId)
          ? COLLIDER_RADIUS.grabbable
          : COLLIDER_RADIUS.rotate_nut;
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
        mgr?.tip(`道具已弹出：抓住「${part.displayName}」放回安装位`);
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
      {progress > 0 ? (
        <mesh position={[0, 0.04, 0]}>
          <ringGeometry args={[0.025, 0.032, 24, 1, 0, progress * Math.PI * 2]} />
          <meshBasicMaterial color="#3ddc97" />
        </mesh>
      ) : null}
      <SopTargetHighlight
        active={isSopTarget || (removed && isInstallOfferPart(part.partId))}
        hover={hover}
        radius={0.04}
        ringRadius={0.08}
        label={
          removed && isInstallOfferPart(part.partId)
            ? `抓住 · ${part.displayName}`
            : isSopTarget
              ? part.displayName
              : undefined
        }
      />
    </group>
  );
}
