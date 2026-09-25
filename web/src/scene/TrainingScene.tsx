import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RelativeHandDriver } from '../hand/RelativeHandDriver';
import { InteractionRouter } from '../interaction/InteractionRouter';
import { clearInteractables } from '../interaction/registry';
import { clearPartPoses } from '../interaction/partPoseHub';
import {
  loadMachineDef,
  setTrainingSession,
  TrainingSession,
  type MachineDef,
} from '../machine';
import { MachineView } from '../visual/MachineView';

interface TrainingSceneProps {
  calibrateToken: number;
  /** Bumps to restart session with a fresh TrainingSession. */
  restartToken: number;
  onSessionReady?: (session: TrainingSession) => void;
}

/**
 * Training R3F scene: lighting, Kitbash machine + interactions, dual virtual hands.
 */
export function TrainingScene({
  calibrateToken,
  restartToken,
  onSessionReady,
}: TrainingSceneProps) {
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

  useEffect(() => {
    if (!def) return;
    clearInteractables();
    clearPartPoses();
    const session = new TrainingSession(def);
    setTrainingSession(session);
    onSessionReady?.(session);
    return () => {
      setTrainingSession(null);
      clearInteractables();
      clearPartPoses();
    };
  }, [def, restartToken, onSessionReady]);

  return (
    <div className="training-scene-root">
      {error ? <div className="scene-banner error">{error}</div> : null}
      {!def && !error ? <div className="scene-banner">加载机型…</div> : null}
      <Canvas
        shadows
        camera={{ position: [0, 0.28, 1.45], fov: 42, near: 0.05, far: 50 }}
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

        {def ? <MachineView key={restartToken} def={def} /> : null}
        <InteractionRouter />

        <RelativeHandDriver handId={0} calibrateToken={calibrateToken} />
        <RelativeHandDriver handId={1} calibrateToken={calibrateToken} />

        <OrbitControls
          target={[0, 0.15, 0.1]}
          enablePan={false}
          minDistance={0.85}
          maxDistance={2.8}
          minPolarAngle={Math.PI * 0.28}
          maxPolarAngle={Math.PI * 0.48}
          minAzimuthAngle={-Math.PI * 0.18}
          maxAzimuthAngle={Math.PI * 0.18}
        />
      </Canvas>
    </div>
  );
}
