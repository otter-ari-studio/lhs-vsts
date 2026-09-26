import { withRsbuildConfig } from "@rstest/adapter-rsbuild";
import { defineConfig } from "@rstest/core";

// Docs: https://rstest.rs/config/
//
// Coverage gate (AC9): lines ≥ 90 on included sources.
// Included: API client, loadMachineDef, submit-once helper, AdminPage,
// pointer drag session + grabbable drag API (AC10 automated 3D drag).
// Excluded from the gate: pure R3F meshes (visual/), scene shells, hand UI,
// other interaction React components, TrainPage chrome.
export default defineConfig({
  extends: withRsbuildConfig(),
  setupFiles: ["./tests/rstest.setup.ts"],
  coverage: {
    enabled: false,
    provider: "istanbul",
    include: [
      "src/api/**/*.{ts,tsx}",
      "src/ui/AdminPage.tsx",
      "src/interaction/pointerDragSession.ts",
      "src/interaction/grabbableDragApi.ts",
    ],
    exclude: [
      "src/visual/**",
      "src/scene/**",
      "src/hand/**",
      "src/App.tsx",
      "src/index.tsx",
      "src/ui/TrainPage.tsx",
      "src/ui/GuidePage.tsx",
      "**/*.{test,spec}.{ts,tsx}",
    ],
    thresholds: {
      lines: 90,
    },
    reporters: ["text", "html"],
  },
});
