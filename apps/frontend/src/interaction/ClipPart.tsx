import { getTrainingSession } from "@lhs-vsts/machine";
import type { PartDef, Vec3 } from "@lhs-vsts/machine";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Vector3 } from "three";

import { KitbashPart } from "../visual/kitbash/KitbashAdapter";
import { COLLIDER_RADIUS, SOP_PICK_PRIORITY } from "./defaults";
import { surfaceDistance } from "./operationSurface";
import { setPartPose } from "./partPoseHub";
import { registerInteractable, unregisterInteractable, type HandInteractable } from "./registry";
import { SopTargetHighlight } from "./SopTargetHighlight";

interface ClipPartProps {
  part: PartDef;
  isSopTarget: boolean;
}

const _tmp = new Vector3();

export function ClipPart({ part, isSopTarget }: ClipPartProps) {
  const groupRef = useRef<Group>(null);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const sopRef = useRef(isSopTarget);
  sopRef.current = isSopTarget;
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];

  const api = useMemo(() => {
    const self: HandInteractable = {
      id: part.partId,
      kind: "clip",
      interactionRadius: COLLIDER_RADIUS.clip,
      // Only the current SOP clip is live — otherwise left/right clips steal aim
      // and spam pry tips while working on the nut / cover.
      isInteractableNow: () => sopRef.current,
      pickPriority: () => (sopRef.current ? SOP_PICK_PRIORITY : 0),
      distanceTo(handPos) {
        const g = groupRef.current;
        if (!g) return Number.POSITIVE_INFINITY;
        g.getWorldPosition(_tmp);
        return surfaceDistance([handPos.x, handPos.y, handPos.z], [_tmp.x, _tmp.y, _tmp.z]);
      },
      copyWorldPosition(out) {
        const g = groupRef.current;
        if (!g) return false;
        g.getWorldPosition(out);
        return true;
      },
      onPinchStart() {
        const mgr = getTrainingSession();
        if (!mgr) return false;
        if (mgr.tryToggleClip(part.partId)) {
          setOpen(mgr.getState(part.partId) === "clip_open");
          return true;
        }
        return false;
      },
      onPinchHold() {},
      onPinchEnd() {},
      onHover(active) {
        setHover(active);
      },
    };
    return self;
  }, [part.partId, groupRef, setHover, setOpen, sopRef]);

  useEffect(() => {
    registerInteractable(api);
    return () => unregisterInteractable(api);
  }, [api]);

  // Sync open from session (e.g. restart).
  useEffect(() => {
    const mgr = getTrainingSession();
    if (mgr) setOpen(mgr.getState(part.partId) === "clip_open");
  }, [part.partId, setOpen]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    g.getWorldPosition(_tmp);
    setPartPose(part.partId, [_tmp.x, _tmp.y, _tmp.z]);
  });

  return (
    <group
      ref={groupRef}
      name={part.partId}
      position={part.anchor.position}
      rotation={[rotation[0], rotation[1], rotation[2] + (open ? 0.7 : 0)]}
      userData={{ partId: part.partId, kind: part.kind }}
    >
      <group scale={isSopTarget || hover ? 1.05 : 1}>
        {part.visual.adapter === "kitbash" && part.visual.kitbashKey ? (
          <KitbashPart kitbashKey={part.visual.kitbashKey} />
        ) : null}
      </group>
      <SopTargetHighlight
        active={isSopTarget}
        hover={hover}
        radius={0.035}
        ringRadius={0.07}
        label={isSopTarget ? part.displayName : undefined}
      />
    </group>
  );
}
