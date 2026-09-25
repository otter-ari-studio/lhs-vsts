import { useEffect, useMemo, useRef } from 'react';
import { Group, Vector3 } from 'three';
import { getLockManager } from '../machine/LockManager';
import type { PartConfig } from '../machine/types';
import type { PartLayout } from '../machine/partLayout';
import {
  registerInteractable,
  unregisterInteractable,
  type HandInteractable,
} from './registry';

interface ClipPartProps {
  config: PartConfig;
  layout: PartLayout;
}

export function ClipPart({ config, layout }: ClipPartProps) {
  const groupRef = useRef<Group>(null);
  const openRef = useRef(false);

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: config.partId,
      interactionRadius: 0.07,
      isInteractableNow: () => true,
      distanceTo(handPos: Vector3) {
        const g = groupRef.current;
        if (!g) return Number.POSITIVE_INFINITY;
        return g.position.distanceTo(handPos);
      },
      onPinchStart() {
        const mgr = getLockManager();
        if (!mgr) return;
        if (mgr.tryToggleClip(config.partId)) {
          openRef.current = mgr.getState(config.partId) === 'clip_open';
          const g = groupRef.current;
          if (g) {
            g.rotation.z = openRef.current ? 0.7 : 0;
          }
        }
      },
      onPinchHold() {},
      onPinchEnd() {},
    };
    return self;
  }, [config.partId]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  return (
    <group ref={groupRef} position={layout.position}>
      <mesh castShadow>
        <boxGeometry args={layout.size} />
        <meshStandardMaterial color={layout.color} metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}
