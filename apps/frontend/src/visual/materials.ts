/** Shared mid-fidelity material presets for Kitbash parts. */
export const MAT = {
  metal: {
    color: "#8a939c",
    metalness: 0.62,
    roughness: 0.32,
  },
  metalDark: {
    color: "#5c6670",
    metalness: 0.55,
    roughness: 0.4,
  },
  metalLight: {
    color: "#a8b0b8",
    metalness: 0.5,
    roughness: 0.38,
  },
  plastic: {
    color: "#3a4048",
    metalness: 0.05,
    roughness: 0.72,
  },
  plasticAccent: {
    color: "#c4a35a",
    metalness: 0.15,
    roughness: 0.55,
  },
  filter: {
    color: "#6e7d8c",
    metalness: 0.35,
    roughness: 0.55,
  },
  filterAlt: {
    color: "#556677",
    metalness: 0.35,
    roughness: 0.55,
  },
  glass: {
    color: "#88b8e0",
    metalness: 0.08,
    roughness: 0.12,
    transparent: true,
    opacity: 0.42,
  },
  brass: {
    color: "#b8860b",
    metalness: 0.7,
    roughness: 0.35,
  },
  impeller: {
    color: "#4a5a68",
    metalness: 0.45,
    roughness: 0.45,
  },
} as const;
