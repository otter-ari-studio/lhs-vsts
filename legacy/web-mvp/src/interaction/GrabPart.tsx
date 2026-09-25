import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Group, Vector3 } from 'three';
import { getLockManager } from '../machine/LockManager';
import type { PartLayout } from '../machine/partLayout';
import type { PartConfig } from '../machine/types';
import {
  registerInteractable,
  unregisterInteractable,
  type HandInteractable,
} from './registry';

interface GrabPartProps {
  config: PartConfig;
  layout: PartLayout;
}

export function GrabPart({ config, layout }: GrabPartProps) {
  const groupRef = useRef<Group>(null);
  const grabbed = useRef(false);
  const grabOffset = useRef(new Vector3());
  const followPos = useRef(new Vector3(...layout.position));
  const installedPos = useMemo(
    () => new Vector3(...layout.position),
    [layout.position],
  );

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: config.partId,
      interactionRadius: 0.08,
      isInteractableNow() {
        if (grabbed.current) return false;
        const mgr = getLockManager();
        if (!mgr) return true;
        const st = mgr.getState(config.partId);
        return st === 'installed' || st === 'removed';
      },
      distanceTo(handPos: Vector3) {
        const g = groupRef.current;
        if (!g) return Number.POSITIVE_INFINITY;
        return g.position.distanceTo(handPos);
      },
      onPinchStart(handPos) {
        if (grabbed.current) return;
        const mgr = getLockManager();
        const st = mgr?.getState(config.partId) ?? 'installed';
        if (st === 'installed') {
          if (!mgr?.tryBeginRemove(config.partId)) return;
          mgr.notifyRemoved(config.partId);
        }
        grabbed.current = true;
        const g = groupRef.current;
        if (g) grabOffset.current.copy(g.position).sub(handPos);
      },
      onPinchHold(handPos) {
        if (!grabbed.current) return;
        followPos.current.copy(handPos).add(grabOffset.current);
      },
      onPinchEnd() {
        if (!grabbed.current) return;
        grabbed.current = false;
        const mgr = getLockManager();
        const g = groupRef.current;
        if (!mgr || !g) return;
        const snap =
          config.snapRangeMeters || mgr.config.assemblyDefaults.snapRangeMeters;
        const dist = g.position.distanceTo(installedPos);
        if (dist <= snap) {
          if (mgr.tryInstall(config.partId)) {
            g.position.copy(installedPos);
            followPos.current.copy(installedPos);
          }
        }
      },
    };
    return self;
  }, [config, installedPos]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    if (grabbed.current) {
      const t = 1 - Math.exp(-40 * dt);
      g.position.lerp(followPos.current, t);
    }
  });

  const opacity = layout.color === '#88b8e0' ? 0.55 : 1;

  return (
    <group ref={groupRef} position={layout.position}>
      <mesh castShadow>
        <boxGeometry args={layout.size} />
        <meshStandardMaterial
          color={layout.color}
          transparent={opacity < 1}
          opacity={opacity}
          metalness={0.25}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}
