import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";

import { JOINT_COUNT } from "./types";

export interface LandmarkRigHandle {
  updateSkeleton: (worldPoints: Vector3[], opts?: { pinching?: boolean }) => void;
  hideSkeleton: () => void;
}

interface LandmarkRigProps {
  color: string;
  /** Kept for API compatibility; glove uses fixed anatomic radii. */
  jointSize?: number;
}

/** Bone segments as [startJoint, endJoint, radius]. Skip wrist→MCP (palm pad covers). */
const FINGER_BONES: readonly [number, number, number][] = [
  // Thumb
  [1, 2, 0.01],
  [2, 3, 0.009],
  [3, 4, 0.008],
  // Index
  [5, 6, 0.01],
  [6, 7, 0.009],
  [7, 8, 0.0075],
  // Middle
  [9, 10, 0.01],
  [10, 11, 0.009],
  [11, 12, 0.0075],
  // Ring
  [13, 14, 0.01],
  [14, 15, 0.0085],
  [15, 16, 0.007],
  // Pinky
  [17, 18, 0.009],
  [18, 19, 0.008],
  [19, 20, 0.0065],
];

const JOINT_RADII: readonly { index: number; radius: number }[] = [
  { index: 0, radius: 0.016 },
  { index: 1, radius: 0.01 },
  { index: 2, radius: 0.009 },
  { index: 3, radius: 0.008 },
  { index: 4, radius: 0.008 },
  { index: 5, radius: 0.011 },
  { index: 6, radius: 0.009 },
  { index: 7, radius: 0.008 },
  { index: 8, radius: 0.0075 },
  { index: 9, radius: 0.011 },
  { index: 10, radius: 0.009 },
  { index: 11, radius: 0.008 },
  { index: 12, radius: 0.0075 },
  { index: 13, radius: 0.01 },
  { index: 14, radius: 0.009 },
  { index: 15, radius: 0.008 },
  { index: 16, radius: 0.007 },
  { index: 17, radius: 0.009 },
  { index: 18, radius: 0.008 },
  { index: 19, radius: 0.007 },
  { index: 20, radius: 0.0065 },
];

const PINCH_COLOR = "#ffee58";
const _mid = new Vector3();
const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);
const _mcp = new Vector3();
const _palmX = new Vector3();
const _palmY = new Vector3();
const _palmZ = new Vector3();

/**
 * Procedural glove mesh driven by MediaPipe 21 landmarks.
 * Palm pad + finger capsules — readable motion without a GLTF asset.
 */
export const LandmarkRig = forwardRef<LandmarkRigHandle, LandmarkRigProps>(function LandmarkRig(
  { color },
  ref,
) {
  const groupRef = useRef<Group>(null);
  const boneRefs = useRef<(Mesh | null)[]>([]);
  const jointMeshes = useRef<(Mesh | null)[]>(
    Array.from({ length: JOINT_RADII.length }, () => null),
  );
  const palmRef = useRef<Mesh>(null);
  const baseColor = useMemo(() => new Color(color), [color]);
  const pinchColor = useMemo(() => new Color(PINCH_COLOR), []);

  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: baseColor.clone(),
        roughness: 0.55,
        metalness: 0.08,
        emissive: new Color("#000000"),
        emissiveIntensity: 0,
      }),
    [baseColor],
  );

  useLayoutEffect(() => {
    const apply = (mesh: Mesh | null) => {
      if (mesh) mesh.material = mat;
    };
    apply(palmRef.current);
    for (const m of boneRefs.current) apply(m);
    for (const m of jointMeshes.current) apply(m);
    return () => {
      mat.dispose();
    };
  }, [mat, boneRefs, jointMeshes, palmRef]);

  useImperativeHandle(
    ref,
    () => ({
      updateSkeleton(worldPoints: Vector3[], opts) {
        if (worldPoints.length !== JOINT_COUNT) return;

        for (let i = 0; i < FINGER_BONES.length; i++) {
          const mesh = boneRefs.current[i];
          if (!mesh) continue;
          const [ai, bi, radius] = FINGER_BONES[i];
          placeCapsule(mesh, worldPoints[ai], worldPoints[bi], radius);
        }

        for (let i = 0; i < JOINT_RADII.length; i++) {
          const mesh = jointMeshes.current[i];
          if (!mesh) continue;
          const { index, radius } = JOINT_RADII[i];
          mesh.position.copy(worldPoints[index]);
          mesh.scale.setScalar(radius * 2);
        }

        placePalm(palmRef.current, worldPoints);

        const pinching = opts?.pinching === true;
        mat.color.copy(pinching ? pinchColor : baseColor);
        mat.emissive.copy(pinching ? pinchColor : baseColor);
        mat.emissiveIntensity = pinching ? 0.35 : 0.05;

        if (groupRef.current) groupRef.current.visible = true;
      },
      hideSkeleton() {
        if (groupRef.current) groupRef.current.visible = false;
      },
    }),
    [baseColor, mat, pinchColor, boneRefs, groupRef, jointMeshes, palmRef],
  );

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={palmRef} castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {FINGER_BONES.map(([a, b], i) => (
        <mesh
          key={`bone-${a}-${b}`}
          ref={(el) => {
            boneRefs.current[i] = el;
          }}
          castShadow
        >
          <capsuleGeometry args={[1, 1, 4, 8]} />
        </mesh>
      ))}
      {JOINT_RADII.map(({ index }, i) => (
        <mesh
          key={`joint-${index}`}
          ref={(el) => {
            jointMeshes.current[i] = el;
          }}
          castShadow
        >
          <sphereGeometry args={[0.5, 12, 12]} />
        </mesh>
      ))}
    </group>
  );
});

/** CapsuleGeometry([1,1]): total height 3 along Y. Scale Y by len/3, XZ by radius. */
function placeCapsule(mesh: Mesh, a: Vector3, b: Vector3, radius: number): void {
  _dir.copy(b).sub(a);
  const len = _dir.length();
  if (len < 1e-5) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  _mid.copy(a).add(b).multiplyScalar(0.5);
  mesh.position.copy(_mid);
  _dir.multiplyScalar(1 / len);
  mesh.quaternion.setFromUnitVectors(_up, _dir);
  mesh.scale.set(radius, len / 3, radius);
}

/** Palm pad: wrist → MCP center, width from index–pinky. */
function placePalm(mesh: Mesh | null, pts: Vector3[]): void {
  if (!mesh) return;
  const wrist = pts[0];
  const indexMcp = pts[5];
  const midMcp = pts[9];
  const pinkyMcp = pts[17];

  _mcp
    .copy(indexMcp)
    .add(midMcp)
    .add(pinkyMcp)
    .multiplyScalar(1 / 3);
  _mid.copy(wrist).add(_mcp).multiplyScalar(0.5);

  _palmY.copy(_mcp).sub(wrist);
  const palmLen = Math.max(_palmY.length(), 0.025);
  _palmY.multiplyScalar(1 / palmLen);

  _palmX.copy(pinkyMcp).sub(indexMcp);
  const palmWidth = Math.max(_palmX.length(), 0.045);
  _palmX.normalize();

  _palmZ.copy(_palmX).cross(_palmY);
  if (_palmZ.lengthSq() < 1e-8) {
    _palmZ.set(0, 0, 1);
  } else {
    _palmZ.normalize();
  }
  _palmX.copy(_palmY).cross(_palmZ).normalize();

  mesh.position.copy(_mid);
  mesh.matrix.makeBasis(_palmX, _palmY, _palmZ);
  mesh.quaternion.setFromRotationMatrix(mesh.matrix);
  mesh.scale.set(palmWidth * 0.58, palmLen * 0.78, 0.024);
}
