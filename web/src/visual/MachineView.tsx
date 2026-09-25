import type { MachineDef, PartDef, Vec3 } from '../machine/types';
import { KitbashPart } from './kitbash/KitbashAdapter';

interface PartAnchorGroupProps {
  part: PartDef;
}

function PartAnchorGroup({ part }: PartAnchorGroupProps) {
  const rotation: Vec3 = part.anchor.rotation ?? [0, 0, 0];
  const visual = part.visual;

  return (
    <group
      name={part.partId}
      userData={{ partId: part.partId, kind: part.kind }}
      position={part.anchor.position}
      rotation={rotation}
    >
      {visual.adapter === 'kitbash' && visual.kitbashKey ? (
        <KitbashPart kitbashKey={visual.kitbashKey} />
      ) : (
        <mesh>
          <boxGeometry args={[0.06, 0.06, 0.06]} />
          <meshStandardMaterial color="#aa44ff" wireframe />
        </mesh>
      )}
    </group>
  );
}

interface MachineViewProps {
  def: MachineDef;
}

/**
 * Mounts every MachineDef part at its logical anchor.
 * Future GLTF adapter swaps visual only — same partId / anchor groups.
 */
export function MachineView({ def }: MachineViewProps) {
  return (
    <group name={`machine:${def.machineId}`}>
      {def.parts.map((part) => (
        <PartAnchorGroup key={part.partId} part={part} />
      ))}
    </group>
  );
}
