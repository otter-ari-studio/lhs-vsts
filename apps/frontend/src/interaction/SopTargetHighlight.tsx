import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { DoubleSide, type Mesh, type MeshBasicMaterial } from "three";

import { isE2eMode } from "../e2e/E2eHarness";

interface SopTargetHighlightProps {
  /** When true, pulse ring + core (SOP current target). */
  active: boolean;
  /** Hover-only static marker (non-SOP). */
  hover?: boolean;
  /** Core sphere radius (meters). */
  radius?: number;
  /** Outer pulse ring radius. */
  ringRadius?: number;
  /** Floating label (part name) — always readable in front of geometry. */
  label?: string;
}

/**
 * Visible cue for the current SOP part.
 * Uses depthTest=false so deep/occluded parts (e.g. wind cover) still flash.
 *
 * Html labels are skipped in `?e2e=1` — drei Html portals into the DOM and
 * race with inventory hide (`visible=false`) causing `removeChildFromContainer`.
 */
export function SopTargetHighlight({
  active,
  hover = false,
  radius = 0.045,
  ringRadius = 0.09,
  label,
}: SopTargetHighlightProps) {
  const coreMat = useRef<MeshBasicMaterial>(null);
  const ringMat = useRef<MeshBasicMaterial>(null);
  const glowMat = useRef<MeshBasicMaterial>(null);
  const ringMesh = useRef<Mesh>(null);
  const showHtmlLabel = !!label && !isE2eMode();

  useFrame(({ clock }) => {
    if (!active) return;
    const t = clock.elapsedTime;
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    if (coreMat.current) {
      coreMat.current.opacity = 0.55 + 0.4 * pulse;
    }
    if (ringMat.current) {
      ringMat.current.opacity = 0.25 + 0.55 * pulse;
    }
    if (glowMat.current) {
      glowMat.current.opacity = 0.12 + 0.2 * pulse;
    }
    if (ringMesh.current) {
      const s = 0.9 + 0.35 * pulse;
      ringMesh.current.scale.set(s, s, s);
    }
  });

  if (!active && !hover) return null;

  if (!active && hover) {
    return (
      <mesh>
        <sphereGeometry args={[radius * 0.7, 10, 10]} />
        <meshBasicMaterial
          color="#f0c14a"
          transparent
          opacity={0.55}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    );
  }

  return (
    <group>
      {/* Soft glow volume — readable through shell */}
      <mesh>
        <sphereGeometry args={[ringRadius * 1.15, 16, 16]} />
        <meshBasicMaterial
          ref={glowMat}
          color="#3ddc97"
          transparent
          opacity={0.2}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius, 14, 14]} />
        <meshBasicMaterial
          ref={coreMat}
          color="#3ddc97"
          transparent
          opacity={0.85}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringMesh} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringRadius * 0.5, ringRadius, 32]} />
        <meshBasicMaterial
          ref={ringMat}
          color="#b8ffe0"
          transparent
          opacity={0.65}
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      {/* Beacon toward camera / front of hood */}
      <mesh position={[0, 0.06, 0.04]}>
        <coneGeometry args={[0.025, 0.07, 10]} />
        <meshBasicMaterial
          color="#f0c14a"
          transparent
          opacity={0.9}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {showHtmlLabel ? (
        <Html
          center
          position={[0, 0.12, 0.06]}
          style={{
            pointerEvents: "none",
            whiteSpace: "nowrap",
            padding: "0.2rem 0.45rem",
            borderRadius: "0.25rem",
            background: "rgba(12, 18, 26, 0.92)",
            border: "1px solid #3ddc97",
            color: "#3ddc97",
            fontSize: "12px",
            fontWeight: 600,
            transform: "translateZ(0)",
          }}
          zIndexRange={[100, 0]}
        >
          {label}
        </Html>
      ) : null}
    </group>
  );
}
