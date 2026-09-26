import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import type { HandId } from "../hand/types";
import { handWorldHub } from "../hand/handWorldHub";
import { aimTargetHub } from "./aimTargetHub";

const _aim = new Vector3();
const _target = new Vector3();
const _dir = new Vector3();
const _mid = new Vector3();
const _up = new Vector3(0, 1, 0);

const IDLE = new Color("#7ec8ff");
const GRASP = new Color("#ffee58");
const IN_RANGE = new Color("#3ddc97");
const NEAR = new Color("#ffb74d");

const GUIDE_MAX_M = 0.65;

/**
 * Aim orb at the grasp contact point + guide stem to the shared aim target
 * (same part as the right-side HUD — not an independent nearest-part guess).
 */
export function HandAimCursor() {
  const groups = useRef<(Group | null)[]>([null, null]);
  const orbs = useRef<(Mesh | null)[]>([null, null]);
  const stems = useRef<(Mesh | null)[]>([null, null]);
  const mats = useMemo(
    () =>
      [0, 1].map(
        () =>
          new MeshBasicMaterial({
            color: IDLE.clone(),
            transparent: true,
            opacity: 0.95,
          }),
      ),
    [],
  );
  const stemMats = useMemo(
    () =>
      [0, 1].map(
        () =>
          new MeshBasicMaterial({
            color: "#9ad0ff",
            transparent: true,
            opacity: 0.5,
          }),
      ),
    [],
  );

  useFrame(() => {
    const shared = aimTargetHub.get();
    if (shared) {
      _target.set(shared.position[0], shared.position[1], shared.position[2]);
    }

    // Draw stem only on the hand closest to the shared target (one line, not two fighting).
    let stemHand: HandId | null = null;
    let stemDist = Number.POSITIVE_INFINITY;
    if (shared) {
      for (const handId of [0, 1] as HandId[]) {
        const pose = handWorldHub.tryGet(handId);
        if (!pose) continue;
        const dx = pose.interactionPoint[0] - shared.position[0];
        const dy = pose.interactionPoint[1] - shared.position[1];
        const dz = pose.interactionPoint[2] - shared.position[2];
        const d = Math.hypot(dx, dy, dz);
        if (d < stemDist) {
          stemDist = d;
          stemHand = handId;
        }
      }
    }

    for (const handId of [0, 1] as HandId[]) {
      const group = groups.current[handId];
      const orb = orbs.current[handId];
      const stem = stems.current[handId];
      const mat = mats[handId]!;
      if (!group || !orb || !stem) continue;

      const pose = handWorldHub.tryGet(handId);
      if (!pose) {
        group.visible = false;
        continue;
      }
      group.visible = true;
      _aim.set(pose.interactionPoint[0], pose.interactionPoint[1], pose.interactionPoint[2]);
      orb.position.copy(_aim);

      const distToTarget = shared
        ? Math.hypot(
            _aim.x - shared.position[0],
            _aim.y - shared.position[1],
            _aim.z - shared.position[2],
          )
        : Number.POSITIVE_INFINITY;

      let color = pose.pinching ? GRASP : IDLE;
      let scale = pose.pinching ? 1.3 : 1;
      if (shared?.inRange && distToTarget < 0.35) {
        color = IN_RANGE;
        scale = 1.55;
      } else if (shared && distToTarget < 0.45) {
        color = NEAR;
        scale = 1.2;
      }
      mat.color.copy(color);
      orb.scale.setScalar(scale);

      if (shared && handId === stemHand && distToTarget <= GUIDE_MAX_M) {
        placeStem(stem, _aim, _target);
        stemMats[handId]!.opacity = shared.inRange ? 0.9 : 0.45;
        stemMats[handId]!.color.copy(shared.inRange ? IN_RANGE : color);
      } else {
        stem.visible = false;
      }
    }
  });

  return (
    <>
      {([0, 1] as HandId[]).map((handId) => (
        <group
          key={handId}
          ref={(el) => {
            groups.current[handId] = el;
          }}
          visible={false}
        >
          <mesh
            ref={(el) => {
              orbs.current[handId] = el;
            }}
            material={mats[handId]}
            renderOrder={10}
          >
            <sphereGeometry args={[0.02, 18, 18]} />
          </mesh>
          <mesh
            ref={(el) => {
              stems.current[handId] = el;
            }}
            material={stemMats[handId]}
            visible={false}
            renderOrder={9}
          >
            <cylinderGeometry args={[0.004, 0.004, 1, 6]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function placeStem(mesh: Mesh, a: Vector3, b: Vector3): void {
  _dir.copy(b).sub(a);
  const len = _dir.length();
  if (len < 1e-4) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  _mid.copy(a).add(b).multiplyScalar(0.5);
  mesh.position.copy(_mid);
  _dir.multiplyScalar(1 / len);
  mesh.quaternion.setFromUnitVectors(_up, _dir);
  mesh.scale.set(1, len, 1);
}
