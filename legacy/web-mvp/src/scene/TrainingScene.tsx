import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { RelativeHandDriver } from '../hand/RelativeHandDriver';
import { MachineParts } from '../interaction/MachineParts';
import { RangeHoodShell } from './RangeHoodShell';

interface TrainingSceneProps {
  calibrateToken: number;
}

export function TrainingScene({ calibrateToken }: TrainingSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.55, 2.1], fov: 45, near: 0.05, far: 50 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#1a222c']} />
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[2.5, 4, 2]}
        intensity={1.15}
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight args={['#c9d6e5', '#3a4048', 0.35]} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#2c333c" roughness={0.9} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 0.7, -0.85]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color="#3a4450" roughness={0.95} />
      </mesh>

      <RangeHoodShell />
      <MachineParts />
      <RelativeHandDriver handId={0} calibrateToken={calibrateToken} />
      <RelativeHandDriver handId={1} calibrateToken={calibrateToken} />

      <OrbitControls
        target={[0, 0.2, 0.3]}
        maxPolarAngle={Math.PI * 0.49}
        minDistance={0.8}
        maxDistance={5}
      />
    </Canvas>
  );
}
