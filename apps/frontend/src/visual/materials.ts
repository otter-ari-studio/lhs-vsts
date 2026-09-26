/** Shared mid-fidelity material presets for Kitbash parts. */
export const MAT = {
  metal: {
    color: "#9aa3ac",
    metalness: 0.78,
    roughness: 0.22,
  },
  metalDark: {
    color: "#4e5760",
    metalness: 0.72,
    roughness: 0.28,
  },
  metalLight: {
    color: "#b4bcc4",
    metalness: 0.7,
    roughness: 0.26,
  },
  plastic: {
    color: "#2e343c",
    metalness: 0.02,
    roughness: 0.88,
  },
  plasticAccent: {
    color: "#c9a24a",
    metalness: 0.08,
    roughness: 0.68,
  },
  filter: {
    color: "#7a8a9a",
    metalness: 0.28,
    roughness: 0.62,
  },
  filterAlt: {
    color: "#5a6a7a",
    metalness: 0.28,
    roughness: 0.62,
  },
  glass: {
    color: "#7aa8c8",
    metalness: 0.05,
    roughness: 0.22,
    transparent: true,
    opacity: 0.38,
  },
  brass: {
    color: "#c4921a",
    metalness: 0.82,
    roughness: 0.28,
  },
  impeller: {
    color: "#3d4c58",
    metalness: 0.55,
    roughness: 0.38,
  },
  /** Wind-cover body cylinder — teaching cue with soft emissive. */
  windCoverBody: {
    color: "#6a8aa8",
    metalness: 0.45,
    roughness: 0.42,
    emissive: "#1a3a4a",
    emissiveIntensity: 0.25,
  },
  /** Wind-cover face disc — ID cue after glass removal. */
  windCoverFace: {
    color: "#4a7a9a",
    metalness: 0.45,
    roughness: 0.42,
  },
} as const;
