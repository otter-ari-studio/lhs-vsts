import type { Vec3 } from '../hand/protocol';

export interface PartLayout {
  /** Installed / anchor world position (meters) */
  position: Vec3;
  size: Vec3;
  color: string;
}

/** Procedural stand-in geometry for range_hood_generic (no GLTF yet). */
export const PART_LAYOUT: Record<string, PartLayout> = {
  oil_box: {
    position: [0, -0.02, 0.22],
    size: [0.28, 0.07, 0.14],
    color: '#c4a35a',
  },
  filter_top: {
    position: [0, 0.08, 0.18],
    size: [0.4, 0.025, 0.18],
    color: '#7a8a9a',
  },
  filter_bottom: {
    position: [0, 0.04, 0.18],
    size: [0.4, 0.025, 0.18],
    color: '#667788',
  },
  clip_left: {
    position: [-0.3, 0.22, 0.14],
    size: [0.04, 0.06, 0.04],
    color: '#333333',
  },
  clip_right: {
    position: [0.3, 0.22, 0.14],
    size: [0.04, 0.06, 0.04],
    color: '#333333',
  },
  panel_glass: {
    position: [0, 0.22, 0.14],
    size: [0.52, 0.26, 0.02],
    color: '#88b8e0',
  },
  wind_cover: {
    position: [0, 0.28, -0.02],
    size: [0.22, 0.22, 0.06],
    color: '#9aa3ab',
  },
  nut_wind: {
    position: [0, 0.28, 0.04],
    size: [0.05, 0.05, 0.04],
    color: '#b8860b',
  },
  wind_wheel: {
    position: [0, 0.28, -0.08],
    size: [0.18, 0.18, 0.08],
    color: '#5c6b7a',
  },
};
