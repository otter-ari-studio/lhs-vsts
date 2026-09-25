/** Procedural simplified range-hood shell (MVP A — no detachable parts). */
export function RangeHoodShell() {
  return (
    <group position={[0, 0.15, 0]}>
      {/* Main body */}
      <mesh position={[0, 0.25, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.45, 0.35]} />
        <meshStandardMaterial color="#8a939c" metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Canopy lip */}
      <mesh position={[0, 0.02, 0.12]} castShadow>
        <boxGeometry args={[0.78, 0.06, 0.22]} />
        <meshStandardMaterial color="#6d767e" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Chimney */}
      <mesh position={[0, 0.62, -0.08]} castShadow>
        <boxGeometry args={[0.28, 0.35, 0.22]} />
        <meshStandardMaterial color="#9aa3ab" metalness={0.45} roughness={0.4} />
      </mesh>
      {/* Glass panel hint */}
      <mesh position={[0, 0.2, 0.13]}>
        <boxGeometry args={[0.55, 0.28, 0.02]} />
        <meshStandardMaterial
          color="#a8c8e8"
          transparent
          opacity={0.35}
          metalness={0.1}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}
