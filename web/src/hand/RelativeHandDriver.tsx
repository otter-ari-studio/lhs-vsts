import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Euler, Group, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { findNearestInteractable, type HandInteractable } from '../interaction/registry';
import { handDataHub } from './HandDataHub';
import {
  HAND_DEFAULTS,
  LANDMARK_SMOOTH_SPEED,
  LANDMARK_STALE_HIDE_DELAY,
  LEFT_HAND_COLOR,
  PALM_SMOOTH_SPEED,
  PINCH_COLOR,
  RIGHT_HAND_COLOR,
} from './defaults';
import { LandmarkRig, type LandmarkRigHandle } from './LandmarkRig';
import { JOINT_COUNT } from './protocol';

interface RelativeHandDriverProps {
  handId: 0 | 1;
  /** Bumps when UI requests Recalibrate. */
  calibrateToken: number;
}

const _wrist = new Vector3();
const _rawRot = new Quaternion();
const _targetPos = new Vector3();
const _relRot = new Quaternion();
const _targetRot = new Quaternion();
const _world = new Vector3();
const _lm = new Vector3();

/**
 * Ports Unity VirtualHandDriver: relative wrist drive + landmark skeleton.
 */
export function RelativeHandDriver({ handId, calibrateToken }: RelativeHandDriverProps) {
  const palmRef = useRef<Group>(null);
  const palmMatRef = useRef<MeshStandardMaterial>(null);
  const rigRef = useRef<LandmarkRigHandle>(null);

  const calibrated = useRef(false);
  const originPos = useRef(new Vector3());
  const originRot = useRef(new Quaternion());
  const palmTargetPos = useRef(new Vector3());
  const palmTargetRot = useRef(new Quaternion());
  const prevPalmTs = useRef(-1);
  const prevLmTs = useRef(-1);
  const lastLmUpdate = useRef(0);
  const lmVisible = useRef(false);
  const hasSmoothLm = useRef(false);
  const smoothLm = useRef<Vector3[]>(
    Array.from({ length: JOINT_COUNT }, () => new Vector3()),
  );
  const lastPinch = useRef(false);
  const engaged = useRef<HandInteractable | null>(null);

  const rest = HAND_DEFAULTS[handId];
  const defaultPos = useRef(new Vector3(...rest.position));
  const defaultRot = useRef(
    new Quaternion().setFromEuler(new Euler(0, (rest.eulerY * Math.PI) / 180, 0)),
  );
  const baseColor = handId === 0 ? LEFT_HAND_COLOR : RIGHT_HAND_COLOR;

  useEffect(() => {
    calibrated.current = false;
    prevPalmTs.current = -1;
    handDataHub.clear(handId);
  }, [calibrateToken, handId]);

  useEffect(() => {
    const palm = palmRef.current;
    if (!palm) return;
    palm.position.copy(defaultPos.current);
    palm.quaternion.copy(defaultRot.current);
  }, []);

  useFrame((state, delta) => {
    const palm = palmRef.current;
    if (!palm) return;

    const sample = handDataHub.tryGetLatest(handId);
    if (!sample) {
      return;
    }

    const hasLm =
      sample.landmarks !== null && sample.landmarks.length === JOINT_COUNT;
    if (hasLm) {
      const w = sample.landmarks![0];
      _wrist.set(w[0], w[1], w[2]);
    } else {
      _wrist.set(sample.position[0], sample.position[1], sample.position[2]);
    }
    _rawRot.set(
      sample.rotation[0],
      sample.rotation[1],
      sample.rotation[2],
      sample.rotation[3],
    );

    let justCalibrated = false;
    if (!calibrated.current) {
      originPos.current.copy(_wrist);
      originRot.current.copy(_rawRot);
      calibrated.current = true;
      justCalibrated = true;
    }

    _targetPos.copy(defaultPos.current).add(_wrist).sub(originPos.current);
    _relRot.copy(originRot.current).invert().multiply(_rawRot);
    _targetRot.copy(defaultRot.current).multiply(_relRot);

    if (justCalibrated || sample.timestamp !== prevPalmTs.current) {
      palmTargetPos.current.copy(_targetPos);
      palmTargetRot.current.copy(_targetRot);
      prevPalmTs.current = sample.timestamp;
    }

    if (justCalibrated || PALM_SMOOTH_SPEED <= 0) {
      palm.position.copy(palmTargetPos.current);
      palm.quaternion.copy(palmTargetRot.current);
    } else {
      const t = 1 - Math.exp(-PALM_SMOOTH_SPEED * delta);
      palm.position.lerp(palmTargetPos.current, t);
      palm.quaternion.slerp(palmTargetRot.current, t);
    }

    const mat = palmMatRef.current;
    if (mat) {
      const pinch = sample.pinching;
      mat.color.set(pinch ? PINCH_COLOR : baseColor);
      mat.emissive.set(pinch ? PINCH_COLOR : '#000000');
      mat.emissiveIntensity = pinch ? 0.45 : 0;
    }

    // Pinch → nearest interactable (Unity VirtualHandDriver dispatch)
    const pinch = sample.pinching;
    const handPos = palm.position;
    const handRot = {
      x: palm.quaternion.x,
      y: palm.quaternion.y,
      z: palm.quaternion.z,
      w: palm.quaternion.w,
    };
    if (pinch && !lastPinch.current) {
      engaged.current = findNearestInteractable(handPos);
      engaged.current?.onPinchStart(handPos, handRot);
    } else if (pinch && lastPinch.current && engaged.current) {
      engaged.current.onPinchHold(handPos, handRot);
    } else if (!pinch && lastPinch.current) {
      engaged.current?.onPinchEnd(handPos);
      engaged.current = null;
    }
    lastPinch.current = pinch;

    const rig = rigRef.current;
    if (!rig) {
      prevLmTs.current = sample.timestamp;
      return;
    }

    if (hasLm) {
      if (sample.timestamp !== prevLmTs.current) {
        const now = state.clock.elapsedTime;
        const dt = lmVisible.current
          ? Math.max(now - lastLmUpdate.current, 0.0001)
          : Number.POSITIVE_INFINITY;
        const t =
          LANDMARK_SMOOTH_SPEED <= 0 || dt > 10
            ? 1
            : 1 - Math.exp(-LANDMARK_SMOOTH_SPEED * dt);
        for (let i = 0; i < JOINT_COUNT; i++) {
          const lm = sample.landmarks![i];
          _lm.set(lm[0], lm[1], lm[2]);
          _world.copy(defaultPos.current).add(_lm).sub(originPos.current);
          if (hasSmoothLm.current) {
            smoothLm.current[i].lerp(_world, t);
          } else {
            smoothLm.current[i].copy(_world);
          }
        }
        hasSmoothLm.current = true;
        rig.updateSkeleton(smoothLm.current);
        lastLmUpdate.current = now;
        lmVisible.current = true;
      } else if (
        lmVisible.current &&
        state.clock.elapsedTime - lastLmUpdate.current > LANDMARK_STALE_HIDE_DELAY
      ) {
        rig.hideSkeleton();
        lmVisible.current = false;
      }
    } else if (lmVisible.current) {
      hasSmoothLm.current = false;
      rig.hideSkeleton();
      lmVisible.current = false;
    }
    prevLmTs.current = sample.timestamp;
  });

  return (
    <>
      <group ref={palmRef}>
        <mesh>
          <sphereGeometry args={[0.028, 16, 16]} />
          <meshStandardMaterial ref={palmMatRef} color={baseColor} />
        </mesh>
      </group>
      <LandmarkRig ref={rigRef} color={baseColor} />
    </>
  );
}
