import { useEffect, useState } from 'react';
import { LockManager, setLockManager } from '../machine/LockManager';
import { PART_LAYOUT } from '../machine/partLayout';
import { parseKind, type MachineConfig } from '../machine/types';
import { ClipPart } from './ClipPart';
import { GrabPart } from './GrabPart';
import { NutPart } from './NutPart';

export function MachineParts() {
  const [config, setConfig] = useState<MachineConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/machines/range_hood_generic.json')
      .then((r) => r.json())
      .then((data: MachineConfig) => {
        if (cancelled) return;
        setConfig(data);
        setLockManager(new LockManager(data));
      })
      .catch((err) => {
        console.error('[MachineParts] failed to load machine JSON', err);
      });
    return () => {
      cancelled = true;
      setLockManager(null);
    };
  }, []);

  if (!config) return null;

  return (
    <group>
      {config.parts.map((p) => {
        const kind = parseKind(p.kind);
        if (kind === 'fixed_shell') return null;
        const layout = PART_LAYOUT[p.partId];
        if (!layout) return null;
        if (kind === 'clip') {
          return <ClipPart key={p.partId} config={p} layout={layout} />;
        }
        if (kind === 'rotate_nut') {
          return <NutPart key={p.partId} config={p} layout={layout} />;
        }
        return <GrabPart key={p.partId} config={p} layout={layout} />;
      })}
    </group>
  );
}
