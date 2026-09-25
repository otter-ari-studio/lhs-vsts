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

interface NutPartProps {
  config: PartConfig;
  layout: PartLayout;
}

/** MVP B: pinch only shows tip; rotation gesture later. */
export function NutPart({ config, layout }: NutPartProps) {
  const groupRef = useRef<Group>(null);

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: config.partId,
      interactionRadius: 0.06,
      isInteractableNow: () => true,
      distanceTo(handPos: Vector3) {
        const g = groupRef.current;
        if (!g) return Number.POSITIVE_INFINITY;
        return g.position.distanceTo(handPos);
      },
      onPinchStart() {
        const mgr = getLockManager();
        mgr?.tip(
          config.wrongDirectionTip ||
            `⚠️ ${config.displayName}：请旋转拆卸（旋转手势尚未接入）`,
        );
      },
      onPinchHold() {},
      onPinchEnd() {},
    };
    return self;
  }, [config]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  return (
    <group ref={groupRef} position={layout.position}>
      <mesh castShadow>
        <cylinderGeometry args={[layout.size[0] * 0.5, layout.size[0] * 0.5, layout.size[2], 12]} />
        <meshStandardMaterial color={layout.color} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}
