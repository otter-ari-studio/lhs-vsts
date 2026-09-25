import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MeshBasicMaterial } from 'three';
import { DROP_TRAY_CENTER, DROP_TRAY_SIZE } from './dropTray';
import { getGrabHoldCount } from './grabHoldHub';

/**
 * Staging platform in front-right of the hood. Pulses green while a part is held.
 */
export function DropTrayVisual() {
  const matRef = useRef<MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    if (getGrabHoldCount() > 0) {
      const pulse = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 5));
      matRef.current.opacity = pulse;
      matRef.current.color.set('#3ddc97');
    } else {
      matRef.current.opacity = 0.22;
      matRef.current.color.set('#5b9bd5');
    }
  });

  return (
    <group position={DROP_TRAY_CENTER} name="drop-tray">
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[DROP_TRAY_SIZE[0], DROP_TRAY_SIZE[2]]} />
        <meshBasicMaterial
          ref={matRef}
          color="#5b9bd5"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[DROP_TRAY_SIZE[0], DROP_TRAY_SIZE[1], DROP_TRAY_SIZE[2]]} />
        <meshStandardMaterial color="#1a2533" transparent opacity={0.55} />
      </mesh>
      {(
        [
          [-DROP_TRAY_SIZE[0] / 2, 0.02, -DROP_TRAY_SIZE[2] / 2],
          [DROP_TRAY_SIZE[0] / 2, 0.02, -DROP_TRAY_SIZE[2] / 2],
          [-DROP_TRAY_SIZE[0] / 2, 0.02, DROP_TRAY_SIZE[2] / 2],
          [DROP_TRAY_SIZE[0] / 2, 0.02, DROP_TRAY_SIZE[2] / 2],
        ] as const
      ).map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.008, 0.04, 0.008]} />
          <meshBasicMaterial color="#3ddc97" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}
