import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { DoubleSide, type Mesh, type MeshBasicMaterial } from 'three';

interface SopTargetHighlightProps {
  /** When true, pulse ring + core (SOP current target). */
  active: boolean;
  /** Hover-only static marker (non-SOP). */
  hover?: boolean;
  /** Core sphere radius (meters). */
  radius?: number;
  /** Outer pulse ring radius. */
  ringRadius?: number;
}

/**
 * Visible cue for the current SOP part: green core + expanding ring flash.
 */
export function SopTargetHighlight({
  active,
  hover = false,
  radius = 0.028,
  ringRadius = 0.055,
}: SopTargetHighlightProps) {
  const coreMat = useRef<MeshBasicMaterial>(null);
  const ringMat = useRef<MeshBasicMaterial>(null);
  const ringMesh = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!active) return;
    const t = clock.elapsedTime;
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    if (coreMat.current) {
      coreMat.current.opacity = 0.4 + 0.45 * pulse;
    }
    if (ringMat.current) {
      ringMat.current.opacity = 0.15 + 0.55 * pulse;
    }
    if (ringMesh.current) {
      const s = 0.85 + 0.35 * pulse;
      ringMesh.current.scale.set(s, s, s);
    }
  });

  if (!active && !hover) return null;

  if (!active && hover) {
    return (
      <mesh>
        <sphereGeometry args={[radius * 0.7, 10, 10]} />
        <meshBasicMaterial color="#f0c14a" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    );
  }

  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 12, 12]} />
        <meshBasicMaterial
          ref={coreMat}
          color="#3ddc97"
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringMesh} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringRadius * 0.55, ringRadius, 32]} />
        <meshBasicMaterial
          ref={ringMat}
          color="#7dffc0"
          transparent
          opacity={0.5}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
