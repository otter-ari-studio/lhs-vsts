import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Mesh,
  Vector3,
} from 'three';
import { HAND_CONNECTIONS, JOINT_COUNT } from './types';

export interface LandmarkRigHandle {
  updateSkeleton: (worldPoints: Vector3[]) => void;
  hideSkeleton: () => void;
}

interface LandmarkRigProps {
  color: string;
  jointSize?: number;
}

export const LandmarkRig = forwardRef<LandmarkRigHandle, LandmarkRigProps>(
  function LandmarkRig({ color, jointSize = 0.016 }, ref) {
    const groupRef = useRef<Group>(null);
    const jointRefs = useRef<(Mesh | null)[]>([]);
    const lineRef = useRef<LineSegments>(null);
    const colorObj = useMemo(() => new Color(color), [color]);

    const lineGeo = useMemo(() => {
      const geo = new BufferGeometry();
      const positions = new Float32Array(HAND_CONNECTIONS.length * 2 * 3);
      geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
      return geo;
    }, []);

    useLayoutEffect(() => () => lineGeo.dispose(), [lineGeo]);

    useImperativeHandle(
      ref,
      () => ({
        updateSkeleton(worldPoints: Vector3[]) {
          if (worldPoints.length !== JOINT_COUNT) return;
          for (let i = 0; i < JOINT_COUNT; i++) {
            const mesh = jointRefs.current[i];
            if (mesh) mesh.position.copy(worldPoints[i]);
          }
          const attr = lineGeo.getAttribute('position') as Float32BufferAttribute;
          let w = 0;
          for (const [a, b] of HAND_CONNECTIONS) {
            const pa = worldPoints[a];
            const pb = worldPoints[b];
            attr.setXYZ(w++, pa.x, pa.y, pa.z);
            attr.setXYZ(w++, pb.x, pb.y, pb.z);
          }
          attr.needsUpdate = true;
          if (groupRef.current) groupRef.current.visible = true;
        },
        hideSkeleton() {
          if (groupRef.current) groupRef.current.visible = false;
        },
      }),
      [lineGeo],
    );

    return (
      <group ref={groupRef} visible={false}>
        {Array.from({ length: JOINT_COUNT }, (_, i) => (
          <mesh
            key={i}
            ref={(el) => {
              jointRefs.current[i] = el;
            }}
            scale={jointSize}
          >
            <sphereGeometry args={[0.5, 12, 12]} />
            <meshBasicMaterial color={colorObj} />
          </mesh>
        ))}
        <lineSegments ref={lineRef} geometry={lineGeo}>
          <lineBasicMaterial color={colorObj} />
        </lineSegments>
      </group>
    );
  },
);
