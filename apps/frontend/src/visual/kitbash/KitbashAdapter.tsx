import type { ReactNode } from "react";

import {
  ClipLeftKitbash,
  ClipRightKitbash,
  FilterBottomKitbash,
  FilterTopKitbash,
  NutWindKitbash,
  OilBoxKitbash,
  PanelGlassKitbash,
  ShellMainKitbash,
  WindCoverKitbash,
  WindWheelKitbash,
} from "./parts";

const REGISTRY: Record<string, () => ReactNode> = {
  shell_main: () => <ShellMainKitbash />,
  oil_box: () => <OilBoxKitbash />,
  filter_top: () => <FilterTopKitbash />,
  filter_bottom: () => <FilterBottomKitbash />,
  clip_left: () => <ClipLeftKitbash />,
  clip_right: () => <ClipRightKitbash />,
  panel_glass: () => <PanelGlassKitbash />,
  wind_cover: () => <WindCoverKitbash />,
  nut_wind: () => <NutWindKitbash />,
  wind_wheel: () => <WindWheelKitbash />,
};

/** Known kitbash geometry keys (for tests / validation helpers). */
export function listKitbashKeys(): string[] {
  return Object.keys(REGISTRY);
}

/**
 * Mid-fidelity procedural geometry by kitbashKey.
 * Logic (SOP / grab) must not live here — only visuals.
 */
export function KitbashPart({ kitbashKey }: { kitbashKey: string }) {
  const factory = REGISTRY[kitbashKey];
  if (!factory) {
    return (
      <mesh>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshStandardMaterial color="#ff4466" />
      </mesh>
    );
  }
  return <>{factory()}</>;
}
