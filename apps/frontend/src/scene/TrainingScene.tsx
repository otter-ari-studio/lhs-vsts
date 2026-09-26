import { setTrainingSession, TrainingSession, type MachineDef } from "@lhs-vsts/machine";
import { Environment, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { ACESFilmicToneMapping } from "three";

import { loadMachineDef } from "../api/loadMachineDef";
import { E2eHarness, isE2eMode } from "../e2e/E2eHarness";
import { isOrbitLocked, subscribeOrbitLock } from "../interaction/orbitLockHub";
import { clearPartPoses } from "../interaction/partPoseHub";
import { PointerInteraction } from "../interaction/PointerInteraction";
import { clearInteractables } from "../interaction/registry";
import { MachineView } from "../visual/MachineView";

interface TrainingSceneProps {
  /** Bumps to restart session with a fresh TrainingSession. */
  restartToken: number;
  onSessionReady?: (session: TrainingSession) => void;
}

function OrbitGate() {
  const { controls } = useThree();
  useEffect(() => {
    return subscribeOrbitLock(() => {
      const c = controls as { enabled?: boolean } | null;
      if (c && "enabled" in c) c.enabled = !isOrbitLocked();
    });
  }, [controls]);
  useFrame(() => {
    const c = controls as { enabled?: boolean } | null;
    if (c && "enabled" in c) c.enabled = !isOrbitLocked();
  });
  return null;
}

/**
 * Training R3F scene: lighting, Kitbash machine, mouse click/drag interaction.
 */
export function TrainingScene({ restartToken, onSessionReady }: TrainingSceneProps) {
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
        camera={{ position: [0.55, 0.42, 1.55], fov: 42, near: 0.05, far: 50 }}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.92 }}
      >
        <color attach="background" args={["#0c121c"]} />
        {/* Soft IBL for metal read. Local HDR (no CDN preset). Suspense + skip in e2e so harness mounts without waiting on IBL. */}
        {isE2eMode() ? null : (
          <Suspense fallback={null}>
            <Environment
              files="empty_warehouse_01_1k.hdr"
              path="/hdri/"
              environmentIntensity={0.32}
            />
          </Suspense>
        )}
        <ambientLight intensity={0.28} />
        <hemisphereLight args={["#b8c6d6", "#1a2028", 0.32]} />
        <directionalLight
          castShadow
          position={[2.2, 3.4, 2.0]}
          intensity={0.95}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0002}
          shadow-camera-near={0.5}
          shadow-camera-far={10}
          shadow-camera-left={-1.4}
          shadow-camera-right={1.4}
          shadow-camera-top={1.6}
          shadow-camera-bottom={-1.0}
        />
        {/* Soft fill opposite key — separates chassis edge without washout */}
        <directionalLight position={[-1.8, 1.6, -1.2]} intensity={0.22} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow>
          <planeGeometry args={[6, 6]} />
          <meshStandardMaterial color="#141c28" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh position={[0, 0.7, -0.9]} receiveShadow>
          <planeGeometry args={[6, 3]} />
          <meshStandardMaterial color="#1c2836" roughness={0.96} metalness={0.02} />
        </mesh>

        {def ? <MachineView key={restartToken} def={def} /> : null}
        <PointerInteraction />
        {isE2eMode() ? <E2eHarness /> : null}
        {/* E2E disables orbit so Playwright drags never rotate the camera. */}
        {isE2eMode() ? null : (
          <>
            <OrbitGate />
            <OrbitControls
              makeDefault
              target={[0, 0.15, 0.1]}
              enablePan={false}
              minDistance={0.7}
              maxDistance={3.2}
              minPolarAngle={Math.PI * 0.12}
              maxPolarAngle={Math.PI * 0.55}
              minAzimuthAngle={-Math.PI * 0.55}
              maxAzimuthAngle={Math.PI * 0.55}
            />
          </>
        )}
      </Canvas>
    </div>
  );
}
