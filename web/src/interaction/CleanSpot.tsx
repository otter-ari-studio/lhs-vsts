import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Vector3 } from 'three';
import { getTrainingSession } from '../machine/TrainingSession';
import type { CleanSpotDef, Vec3 } from '../machine/types';
import { createDwellTracker } from './dwell';
import { getPartPose } from './partPoseHub';
import {
  registerInteractable,
  unregisterInteractable,
  type HandInteractable,
} from './registry';

interface CleanSpotProps {
  spot: CleanSpotDef;
  /** Fallback when part pose not published yet. */
  partWorldPos: Vec3;
  isSopTarget: boolean;
}

const _tmp = new Vector3();

function resolveWorldPos(spot: CleanSpotDef, partWorldPos: Vec3): Vec3 {
  if (spot.space === 'world') return spot.position;
  return [
    partWorldPos[0] + spot.position[0],
    partWorldPos[1] + spot.position[1],
    partWorldPos[2] + spot.position[2],
  ];
}

/**
 * Clean hotspot: proximity hover dwell (default ~1.5s) completes the step.
 * Pinch is not required — UI fallback lives on TrainPage.
 */
export function CleanSpotMesh({ spot, partWorldPos, isSopTarget }: CleanSpotProps) {
  const groupRef = useRef<Group>(null);
  const dwell = useRef(createDwellTracker(spot.dwellMs));
  const [hover, setHover] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const partPosRef = useRef(partWorldPos);
  partPosRef.current = partWorldPos;
  const hoverRef = useRef(false);
  const progressRef = useRef(0);
  const activeRef = useRef(false);

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: `clean:${spot.cleanId}`,
      kind: 'clean',
      interactionRadius: spot.radiusMeters,
      isInteractableNow() {
        const mgr = getTrainingSession();
        if (!mgr) return false;
        return mgr.getActiveCleanIds().includes(spot.cleanId);
      },
      distanceTo(handPos) {
        const live = getPartPose(spot.partId) ?? partPosRef.current;
        const pos = resolveWorldPos(spot, live);
        _tmp.set(pos[0], pos[1], pos[2]);
        return _tmp.distanceTo(handPos);
      },
      onPinchStart() {},
      onPinchHold() {},
      onPinchEnd() {},
      onHover(activeHover) {
        hoverRef.current = activeHover;
        setHover(activeHover);
      },
    };
    return self;
  }, [spot, partPosRef, hoverRef, setHover]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  useFrame((_, dt) => {
    const mgr = getTrainingSession();
    const nowActive = mgr?.getActiveCleanIds().includes(spot.cleanId) ?? false;
    if (nowActive !== activeRef.current) {
      activeRef.current = nowActive;
      setActive(nowActive);
    }

    const live = getPartPose(spot.partId) ?? partPosRef.current;
    const pos = resolveWorldPos(spot, live);
    const g = groupRef.current;
    if (g) g.position.set(pos[0], pos[1], pos[2]);

    if (!nowActive) {
      if (progressRef.current !== 0) {
        dwell.current.reset();
        progressRef.current = 0;
        setProgress(0);
      }
      return;
    }

    const done = dwell.current.tick(hoverRef.current, dt * 1000);
    const nextProgress = dwell.current.progress();
    if (nextProgress !== progressRef.current) {
      progressRef.current = nextProgress;
      setProgress(nextProgress);
    }
    if (done) {
      mgr?.completeClean(spot.cleanId);
      dwell.current.reset();
      progressRef.current = 0;
      setProgress(0);
    }
  });

  if (!active) return null;

  const highlight = hover || isSopTarget;

  return (
    <group ref={groupRef} position={partWorldPos} name={`clean:${spot.cleanId}`}>
      <mesh>
        <sphereGeometry args={[spot.radiusMeters * 0.35, 16, 16]} />
        <meshBasicMaterial
          color={highlight ? '#3ddc97' : '#5b9bd5'}
          transparent
          opacity={0.35 + progress * 0.4}
          wireframe
        />
      </mesh>
      {progress > 0 ? (
        <mesh>
          <ringGeometry
            args={[
              spot.radiusMeters * 0.4,
              spot.radiusMeters * 0.48,
              32,
              1,
              0,
              progress * Math.PI * 2,
            ]}
          />
          <meshBasicMaterial color="#3ddc97" />
        </mesh>
      ) : null}
    </group>
  );
}
