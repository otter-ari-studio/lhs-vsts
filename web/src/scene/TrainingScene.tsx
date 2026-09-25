import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RelativeHandDriver } from '../hand/RelativeHandDriver';
import { loadMachineDef, type MachineDef } from '../machine';
import { MachineView } from '../visual/MachineView';

interface TrainingSceneProps {
  calibrateToken: number;
}

/**
 * Training R3F scene: lighting, floor/wall, Kitbash machine, dual virtual hands.
 * Hand samples come from HandHub (owned by TrainPage / useHandCamera).
 */
export function TrainingScene({ calibrateToken }: TrainingSceneProps) {
  const [def, setDef] = useState<MachineDef | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadMachineDef()
      .then((machine) => {
        if (!cancelled) setDef(machine);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setDef, setError]);

  return (
    <div className="training-scene-root">
      {error ? <div className="scene-banner error">{error}</div> : null}
      {!def && !error ? <div className="scene-banner">加载机型…</div> : null}
      <Canvas
        shadows
        camera={{ position: [0.75, 0.55, 1.35], fov: 45, near: 0.05, far: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#101725']} />
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#c9d6e5', '#2a3038', 0.4]} />
        <directionalLight
          castShadow
          position={[2.4, 3.8, 2.2]}
          intensity={1.15}
          shadow-mapSize={[1024, 1024]}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow>
          <planeGeometry args={[6, 6]} />
          <meshStandardMaterial color="#1a2533" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.7, -0.9]} receiveShadow>
          <planeGeometry args={[6, 3]} />
          <meshStandardMaterial color="#243040" roughness={0.95} />
        </mesh>

        {def ? <MachineView def={def} /> : null}

        <RelativeHandDriver handId={0} calibrateToken={calibrateToken} />
        <RelativeHandDriver handId={1} calibrateToken={calibrateToken} />

        <OrbitControls
          target={[0, 0.2, 0.15]}
          enablePan={false}
          minDistance={0.7}
          maxDistance={3.2}
          maxPolarAngle={Math.PI * 0.48}
        />
      </Canvas>
    </div>
  );
}
