import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import { defineConfig } from '@rstest/core';

// Docs: https://rstest.rs/config/
//
// Coverage gate (AC9): lines ≥ 90 on included sources.
// Included: API client, loadMachineDef, submit-once helper, AdminPage.
// Excluded from the gate (documented): pure R3F/Three meshes (visual/), scene shells,
// hand tracking UI, interaction React components, TrainPage chrome (score path lives in
// src/api/submitSessionScore.ts). Do NOT exclude api/ or AdminPage.
export default defineConfig({
  extends: withRsbuildConfig(),
  setupFiles: ['./tests/rstest.setup.ts'],
  coverage: {
    enabled: false,
    provider: 'istanbul',
    include: ['src/api/**/*.{ts,tsx}', 'src/ui/AdminPage.tsx'],
    exclude: [
      'src/visual/**',
      'src/scene/**',
      'src/hand/**',
      'src/interaction/**',
      'src/App.tsx',
      'src/index.tsx',
      'src/ui/TrainPage.tsx',
      'src/ui/GuidePage.tsx',
      '**/*.{test,spec}.{ts,tsx}',
    ],
    thresholds: {
      lines: 90,
    },
    reporters: ['text', 'html'],
  },
});
