import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Euler, Group, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import {
  GRASP_CONFIRM_FRAMES,
  GRASP_OFF_RATIO,
  GRASP_ON_RATIO,
  GRASP_RATIO_EMA,
  HAND_DEFAULTS,
  LANDMARK_MAX_STEP,
  LANDMARK_SMOOTH_SPEED,
  LANDMARK_STALE_HIDE_DELAY,
  LEFT_HAND_COLOR,
  PALM_SMOOTH_SPEED,
  PINCH_COLOR,
  RIGHT_HAND_COLOR,
} from "./defaults";
import { ema } from "./deskDepth";
import { fingerOpenRatio, updateGraspStateConfirmed } from "./grasp";
import { handHub } from "./HandHub";
import { handWorldHub } from "./handWorldHub";
import { LandmarkRig, type LandmarkRigHandle } from "./LandmarkRig";
import { JOINT_COUNT, type HandId, type Vec3 } from "./types";
import { projectToSurface } from "../interaction/operationSurface";
import { operationSurfaceHub } from "../interaction/operationSurfaceHub";

interface RelativeHandDriverProps {
  handId: HandId;
  /** Bumps when UI requests Recalibrate (depth origin only; XY is absolute). */
  calibrateToken: number;
}

const _wrist = new Vector3();
const _rawRot = new Quaternion();
const _targetPos = new Vector3();
const _targetRot = new Quaternion();
const _relRot = new Quaternion();
const _lm = new Vector3();
const _delta = new Vector3();
const _aim = new Vector3();
const _tmpVecs: Vec3[] = Array.from({ length: JOINT_COUNT }, () => [0, 0, 0]);

/** Finger tips — contact / aim point for top-cam ↔ scene mapping. */
const TIP_IDX = [8, 12, 16, 20] as const;

/**
 * Absolute screen-mapped wrist + glove (HandHub already in scene meters).
 * Grasp = finger curl; pick point = fingertip centroid (matches visual aim).
 */
export function RelativeHandDriver({ handId, calibrateToken }: RelativeHandDriverProps) {
  const palmRef = useRef<Group>(null);
  const palmMatRef = useRef<MeshStandardMaterial>(null);
  const rigRef = useRef<LandmarkRigHandle>(null);

  const originRot = useRef(new Quaternion());
  const hasRotOrigin = useRef(false);
  const palmTargetPos = useRef(new Vector3());
  const palmTargetRot = useRef(new Quaternion());
  const prevPalmTs = useRef(-1);
  const prevLmTs = useRef(-1);
  const lastSampleAt = useRef(0);
  const lmVisible = useRef(false);
  const hasSmoothLm = useRef(false);
  const lmTarget = useRef<Vector3[]>(Array.from({ length: JOINT_COUNT }, () => new Vector3()));
  const smoothLm = useRef<Vector3[]>(Array.from({ length: JOINT_COUNT }, () => new Vector3()));
  const graspState = useRef(false);
  const graspRatioEma = useRef<number | null>(null);
  const graspPending = useRef(0);

  const rest = HAND_DEFAULTS[handId];
  const defaultPos = useRef(new Vector3(...rest.position));
  const defaultRot = useRef(
    new Quaternion().setFromEuler(new Euler(0, (rest.eulerY * Math.PI) / 180, 0)),
  );
  const baseColor = handId === 0 ? LEFT_HAND_COLOR : RIGHT_HAND_COLOR;

  useEffect(() => {
    hasRotOrigin.current = false;
    prevPalmTs.current = -1;
    prevLmTs.current = -1;
    hasSmoothLm.current = false;
    graspState.current = false;
    graspRatioEma.current = null;
    graspPending.current = 0;
  }, [calibrateToken, handId]);

  useEffect(() => {
    const palm = palmRef.current;
    if (!palm) return;
    palm.position.copy(defaultPos.current);
    palm.quaternion.copy(defaultRot.current);
  }, [defaultPos, defaultRot, palmRef]);

  useFrame((state, delta) => {
    const palm = palmRef.current;
    if (!palm) return;
    const dt = Math.min(Math.max(delta, 0.0001), 0.05);

    const sample = handHub.tryGetLatest(handId);
    if (!sample) {
      handWorldHub.clear(handId);
      if (
        lmVisible.current &&
        state.clock.elapsedTime - lastSampleAt.current > LANDMARK_STALE_HIDE_DELAY
      ) {
        rigRef.current?.hideSkeleton();
        lmVisible.current = false;
        const mesh = palm.children[0];
        if (mesh) mesh.visible = true;
      }
      return;
    }

    const hasLm = sample.landmarks !== null && sample.landmarks.length === JOINT_COUNT;
    if (hasLm) {
      const w = sample.landmarks![0];
      _wrist.set(w[0], w[1], w[2]);
    } else {
      _wrist.set(sample.position[0], sample.position[1], sample.position[2]);
    }
    _rawRot.set(sample.rotation[0], sample.rotation[1], sample.rotation[2], sample.rotation[3]);

    if (!hasRotOrigin.current) {
      originRot.current.copy(_rawRot);
      hasRotOrigin.current = true;
    }

    // Absolute scene position from screen map (already mirrored in HandTracker).
    _targetPos.copy(_wrist);
    _relRot.copy(originRot.current).invert().multiply(_rawRot);
    _targetRot.copy(defaultRot.current).multiply(_relRot);

    if (sample.timestamp !== prevPalmTs.current) {
      palmTargetPos.current.copy(_targetPos);
      palmTargetRot.current.copy(_targetRot);
      prevPalmTs.current = sample.timestamp;
      lastSampleAt.current = state.clock.elapsedTime;
    }

    if (PALM_SMOOTH_SPEED <= 0) {
      palm.position.copy(palmTargetPos.current);
      palm.quaternion.copy(palmTargetRot.current);
    } else {
      const t = 1 - Math.exp(-PALM_SMOOTH_SPEED * dt);
      palm.position.lerp(palmTargetPos.current, t);
      palm.quaternion.slerp(palmTargetRot.current, t);
    }

    const rig = rigRef.current;

    if (rig && hasLm && sample.timestamp !== prevLmTs.current) {
      for (let i = 0; i < JOINT_COUNT; i++) {
        const lm = sample.landmarks![i];
        _lm.set(lm[0], lm[1], lm[2]);
        if (hasSmoothLm.current) {
          _delta.copy(_lm).sub(lmTarget.current[i]);
          const len = _delta.length();
          if (len > LANDMARK_MAX_STEP) {
            _delta.multiplyScalar(LANDMARK_MAX_STEP / len);
            lmTarget.current[i].add(_delta);
          } else {
            lmTarget.current[i].copy(_lm);
          }
        } else {
          lmTarget.current[i].copy(_lm);
          smoothLm.current[i].copy(_lm);
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
    }

    let grasping = sample.pinching;
    if (hasSmoothLm.current && lmVisible.current) {
      for (let i = 0; i < JOINT_COUNT; i++) {
        const v = smoothLm.current[i]!;
        _tmpVecs[i] = [v.x, v.y, v.z];
      }
      const openRaw = fingerOpenRatio(_tmpVecs);
      graspRatioEma.current = ema(graspRatioEma.current, openRaw, GRASP_RATIO_EMA);
      const upd = updateGraspStateConfirmed(
        graspState.current,
        graspRatioEma.current,
        GRASP_ON_RATIO,
        GRASP_OFF_RATIO,
        graspPending.current,
        GRASP_CONFIRM_FRAMES,
      );
      graspState.current = upd.grasping;
      graspPending.current = upd.pendingCount;
      grasping = upd.grasping;
    }

    const mat = palmMatRef.current;
    if (mat) {
      mat.color.set(grasping ? PINCH_COLOR : baseColor);
      mat.emissive.set(grasping ? PINCH_COLOR : "#000000");
      mat.emissiveIntensity = grasping ? 0.45 : 0;
    }

    if (rig && hasSmoothLm.current && lmVisible.current) {
      rig.updateSkeleton(smoothLm.current, { pinching: grasping });
      const mesh = palm.children[0];
      if (mesh) mesh.visible = false;
    }

    const stale = state.clock.elapsedTime - lastSampleAt.current > LANDMARK_STALE_HIDE_DELAY;
    if (stale && lmVisible.current) {
      rig?.hideSkeleton();
      lmVisible.current = false;
      const mesh = palm.children[0];
      if (mesh) mesh.visible = true;
    }

    // Tip XY from tracking; Z locked to current SOP operation face (scheme A).
    if (hasSmoothLm.current && lmVisible.current) {
      _aim.set(0, 0, 0);
      for (const i of TIP_IDX) {
        _aim.add(smoothLm.current[i]!);
      }
      _aim.multiplyScalar(1 / TIP_IDX.length);
    } else {
      _aim.copy(palm.position);
    }
    const faceZ = operationSurfaceHub.get().z;
    const onFace = projectToSurface([_aim.x, _aim.y, _aim.z], faceZ);

    handWorldHub.publish({
      handId,
      palm: [palm.position.x, palm.position.y, palm.position.z],
      interactionPoint: onFace,
      pinching: grasping,
      clockSec: state.clock.elapsedTime,
    });
  });

  return (
    <>
      <group ref={palmRef}>
        <mesh>
          <sphereGeometry args={[0.02, 16, 16]} />
          <meshStandardMaterial ref={palmMatRef} color={baseColor} />
        </mesh>
      </group>
      <LandmarkRig ref={rigRef} color={baseColor} />
    </>
  );
}
