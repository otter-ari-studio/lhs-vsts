import { MAT } from "../materials";

/** Main chassis: canopy body + lip + chimney (identifiable side-suction hood). */
export function ShellMainKitbash() {
  return (
    <group>
      {/* Main body */}
      <mesh position={[0, 0.25, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.45, 0.35]} />
        <meshStandardMaterial {...MAT.metal} />
      </mesh>
      {/* Side suction face bevel hint */}
      <mesh position={[0, 0.18, 0.1]} castShadow>
        <boxGeometry args={[0.68, 0.32, 0.04]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      {/* Angled suction plane — side-suction read */}
      <mesh position={[0, 0.12, 0.14]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.66, 0.2, 0.018]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      {/* Canopy lip */}
      <mesh position={[0, 0.02, 0.12]} castShadow>
        <boxGeometry args={[0.78, 0.06, 0.22]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      {/* Lip edge bead — sharper canopy silhouette */}
      <mesh position={[0, -0.005, 0.2]} castShadow>
        <boxGeometry args={[0.8, 0.02, 0.03]} />
        <meshStandardMaterial {...MAT.metal} />
      </mesh>
      {/* Chimney */}
      <mesh position={[0, 0.62, -0.08]} castShadow>
        <boxGeometry args={[0.28, 0.35, 0.22]} />
        <meshStandardMaterial {...MAT.metalLight} />
      </mesh>
      {/* Chimney collar — stack read */}
      <mesh position={[0, 0.46, -0.08]} castShadow>
        <boxGeometry args={[0.32, 0.04, 0.26]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      {/* Control strip */}
      <mesh position={[0.22, 0.42, 0.125]}>
        <boxGeometry args={[0.18, 0.04, 0.01]} />
        <meshStandardMaterial {...MAT.plastic} />
      </mesh>
      {/* Control buttons — plastic vs metal cue */}
      <mesh position={[0.16, 0.42, 0.132]}>
        <boxGeometry args={[0.028, 0.022, 0.008]} />
        <meshStandardMaterial {...MAT.plasticAccent} />
      </mesh>
      <mesh position={[0.22, 0.42, 0.132]}>
        <boxGeometry args={[0.028, 0.022, 0.008]} />
        <meshStandardMaterial {...MAT.plasticAccent} />
      </mesh>
      <mesh position={[0.28, 0.42, 0.132]}>
        <boxGeometry args={[0.028, 0.022, 0.008]} />
        <meshStandardMaterial {...MAT.plasticAccent} />
      </mesh>
    </group>
  );
}

export function OilBoxKitbash() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.05, 0.14]} />
        <meshStandardMaterial {...MAT.plasticAccent} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.3, 0.012, 0.15]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      {/* Side rails — detachable scan cue */}
      <mesh position={[-0.145, 0.01, 0]}>
        <boxGeometry args={[0.012, 0.04, 0.12]} />
        <meshStandardMaterial {...MAT.metal} />
      </mesh>
      <mesh position={[0.145, 0.01, 0]}>
        <boxGeometry args={[0.012, 0.04, 0.12]} />
        <meshStandardMaterial {...MAT.metal} />
      </mesh>
      {/* Handle notch */}
      <mesh position={[0, -0.01, 0.06]}>
        <boxGeometry args={[0.08, 0.02, 0.03]} />
        <meshStandardMaterial {...MAT.plastic} />
      </mesh>
      {/* Pull tab — grab affordance */}
      <mesh position={[0, -0.025, 0.075]}>
        <boxGeometry args={[0.06, 0.014, 0.02]} />
        <meshStandardMaterial {...MAT.plastic} />
      </mesh>
    </group>
  );
}

function FilterMesh({ color }: { color: typeof MAT.filter | typeof MAT.filterAlt }) {
  const bars = [-0.14, -0.07, 0, 0.07, 0.14];
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.018, 0.18]} />
        <meshStandardMaterial {...color} />
      </mesh>
      {bars.map((x) => (
        <mesh key={x} position={[x, 0.012, 0]}>
          <boxGeometry args={[0.012, 0.006, 0.16]} />
          <meshStandardMaterial {...MAT.metalLight} />
        </mesh>
      ))}
      {/* Outer frame rails */}
      <mesh position={[0, 0.012, 0.09]}>
        <boxGeometry args={[0.42, 0.01, 0.012]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      <mesh position={[0, 0.012, -0.09]}>
        <boxGeometry args={[0.42, 0.01, 0.012]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      <mesh position={[-0.205, 0.012, 0]}>
        <boxGeometry args={[0.012, 0.01, 0.18]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      <mesh position={[0.205, 0.012, 0]}>
        <boxGeometry args={[0.012, 0.01, 0.18]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      {/* Cross frame */}
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.42, 0.004, 0.02]} />
        <meshStandardMaterial {...MAT.metal} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.2, 0.004, 0.02]} />
        <meshStandardMaterial {...MAT.metal} />
      </mesh>
      {/* Pull lip */}
      <mesh position={[0, 0.006, 0.1]}>
        <boxGeometry args={[0.1, 0.008, 0.02]} />
        <meshStandardMaterial {...MAT.metalLight} />
      </mesh>
    </group>
  );
}

export function FilterTopKitbash() {
  return <FilterMesh color={MAT.filter} />;
}

export function FilterBottomKitbash() {
  return <FilterMesh color={MAT.filterAlt} />;
}

function ClipMesh({ side }: { side: "left" | "right" }) {
  const flip = side === "right" ? 1 : -1;
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.035, 0.055, 0.035]} />
        <meshStandardMaterial {...MAT.plastic} />
      </mesh>
      {/* Latch arm */}
      <mesh position={[flip * 0.02, 0.02, 0.01]} rotation={[0, 0, flip * 0.35]}>
        <boxGeometry args={[0.05, 0.012, 0.018]} />
        <meshStandardMaterial {...MAT.metalLight} />
      </mesh>
      {/* Latch tip — clip silhouette */}
      <mesh position={[flip * 0.042, 0.028, 0.01]} rotation={[0, 0, flip * 0.35]}>
        <boxGeometry args={[0.018, 0.01, 0.014]} />
        <meshStandardMaterial {...MAT.metal} />
      </mesh>
      {/* Pivot pin cue */}
      <mesh position={[0, 0.01, 0.02]}>
        <boxGeometry args={[0.012, 0.012, 0.01]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
    </group>
  );
}

export function ClipLeftKitbash() {
  return <ClipMesh side="left" />;
}

export function ClipRightKitbash() {
  return <ClipMesh side="right" />;
}

export function PanelGlassKitbash() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.52, 0.26, 0.018]} />
        <meshStandardMaterial {...MAT.glass} />
      </mesh>
      {/* Frame edge — dark rim against glass */}
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.54, 0.28, 0.006]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      {/* Front bezel rails */}
      <mesh position={[0, 0.135, 0.006]}>
        <boxGeometry args={[0.54, 0.012, 0.008]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      <mesh position={[0, -0.135, 0.006]}>
        <boxGeometry args={[0.54, 0.012, 0.008]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      <mesh position={[-0.265, 0, 0.006]}>
        <boxGeometry args={[0.012, 0.28, 0.008]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      <mesh position={[0.265, 0, 0.006]}>
        <boxGeometry args={[0.012, 0.28, 0.008]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
    </group>
  );
}

export function WindCoverKitbash() {
  return (
    <group>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 24]} />
        <meshStandardMaterial {...MAT.windCoverBody} />
      </mesh>
      <mesh position={[0, 0, 0.015]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.01, 16]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      {/* Front face disc so it reads after glass is gone */}
      <mesh position={[0, 0, 0.028]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 24]} />
        <meshStandardMaterial {...MAT.windCoverFace} />
      </mesh>
      {/* Rim ring — cover ID after glass removal */}
      <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.008, 8, 24]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
    </group>
  );
}

export function NutWindKitbash() {
  return (
    <group>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.018, 6]} />
        <meshStandardMaterial {...MAT.brass} />
      </mesh>
      <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.008, 12]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
    </group>
  );
}

export function WindWheelKitbash() {
  const blades = [0, 1, 2, 3, 4, 5].map((i) => (i * Math.PI) / 3);
  return (
    <group>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.05, 16]} />
        <meshStandardMaterial {...MAT.impeller} />
      </mesh>
      {blades.map((angle) => (
        <mesh
          key={angle}
          position={[Math.cos(angle) * 0.055, Math.sin(angle) * 0.055, 0]}
          rotation={[0, 0, angle]}
          castShadow
        >
          <boxGeometry args={[0.09, 0.018, 0.06]} />
          <meshStandardMaterial {...MAT.impeller} />
        </mesh>
      ))}
      {/* Hub cap — impeller ID cue */}
      <mesh position={[0, 0, 0.028]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.008, 12]} />
        <meshStandardMaterial {...MAT.metalLight} />
      </mesh>
    </group>
  );
}
