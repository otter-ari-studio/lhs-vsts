import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Euler, Group, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { findNearestInteractable, type HandInteractable } from '../interaction/registry';
import { handDataHub } from './HandDataHub';
import {
  HAND_DEFAULTS,
  LANDMARK_MAX_STEP,
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
const _delta = new Vector3();

/**
 * Relative wrist drive + landmark skeleton with per-frame smoothing
 * (targets update on WS samples; display lerps every render frame).
 */
export function RelativeHandDriver({ handId, calibrateToken }: RelativeHandDriverProps) {
  const palmRef = useRef<Group>(null);
  const palmMatRef = useRef<MeshStandardMaterial>(null);
  const palmMeshVisible = useRef(true);
  const rigRef = useRef<LandmarkRigHandle>(null);

  const calibrated = useRef(false);
  const originPos = useRef(new Vector3());
  const originRot = useRef(new Quaternion());
  const palmTargetPos = useRef(new Vector3());
  const palmTargetRot = useRef(new Quaternion());
  const prevPalmTs = useRef(-1);
  const prevLmTs = useRef(-1);
  const lastSampleAt = useRef(0);
  const lmVisible = useRef(false);
  const hasSmoothLm = useRef(false);
  const lmTarget = useRef<Vector3[]>(
    Array.from({ length: JOINT_COUNT }, () => new Vector3()),
  );
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
    prevLmTs.current = -1;
    hasSmoothLm.current = false;
    lmVisible.current = false;
    handDataHub.clear(handId);
    rigRef.current?.hideSkeleton();
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
    const dt = Math.min(Math.max(delta, 0.0001), 0.05);

    const sample = handDataHub.tryGetLatest(handId);
    if (!sample) {
      // No sample ever / cleared: keep rest pose, hide skeleton after delay
      if (
        lmVisible.current &&
        state.clock.elapsedTime - lastSampleAt.current > LANDMARK_STALE_HIDE_DELAY
      ) {
        rigRef.current?.hideSkeleton();
        lmVisible.current = false;
        palmMeshVisible.current = true;
        const mesh = palm.children[0];
        if (mesh) mesh.visible = true;
      }
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
      lastSampleAt.current = state.clock.elapsedTime;
    }

    if (justCalibrated || PALM_SMOOTH_SPEED <= 0) {
      palm.position.copy(palmTargetPos.current);
      palm.quaternion.copy(palmTargetRot.current);
    } else {
      const t = 1 - Math.exp(-PALM_SMOOTH_SPEED * dt);
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
    if (!rig) return;

    // Update landmark *targets* only on new samples; display lerps every frame.
    if (hasLm && sample.timestamp !== prevLmTs.current) {
      for (let i = 0; i < JOINT_COUNT; i++) {
        const lm = sample.landmarks![i];
        _lm.set(lm[0], lm[1], lm[2]);
        _world.copy(defaultPos.current).add(_lm).sub(originPos.current);
        if (hasSmoothLm.current) {
          _delta.copy(_world).sub(lmTarget.current[i]);
          const len = _delta.length();
          if (len > LANDMARK_MAX_STEP) {
            _delta.multiplyScalar(LANDMARK_MAX_STEP / len);
            lmTarget.current[i].add(_delta);
          } else {
            lmTarget.current[i].copy(_world);
          }
        } else {
          lmTarget.current[i].copy(_world);
          smoothLm.current[i].copy(_world);
        }
      }
      hasSmoothLm.current = true;
      lmVisible.current = true;
      lastSampleAt.current = state.clock.elapsedTime;
    }
    prevLmTs.current = sample.timestamp;

    if (hasSmoothLm.current && lmVisible.current) {
      const t = 1 - Math.exp(-LANDMARK_SMOOTH_SPEED * dt);
      for (let i = 0; i < JOINT_COUNT; i++) {
        smoothLm.current[i].lerp(lmTarget.current[i], t);
      }
      rig.updateSkeleton(smoothLm.current);
      // Hide redundant wrist ball while skeleton is up
      const mesh = palm.children[0];
      if (mesh) mesh.visible = false;
      palmMeshVisible.current = false;
    }

    const stale =
      state.clock.elapsedTime - lastSampleAt.current > LANDMARK_STALE_HIDE_DELAY;
    if (stale && lmVisible.current) {
      rig.hideSkeleton();
      lmVisible.current = false;
      const mesh = palm.children[0];
      if (mesh) mesh.visible = true;
      palmMeshVisible.current = true;
    }
  });

  return (
    <>
      <group ref={palmRef}>
        <mesh>
          <sphereGeometry args={[0.02, 16, 16]} />
          <meshStandardMaterial ref={palmMatRef} color={baseColor} />
        </mesh>
      </group>
      <LandmarkRig ref={rigRef} color={baseColor} jointSize={0.014} />
    </>
  );
}
