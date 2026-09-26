import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // Serve MediaPipe WASM from /mediapipe (pinned package version in mediapipeLoader).
  output: {
    copy: [
      {
        from: './node_modules/@mediapipe/tasks-vision/wasm',
        to: 'mediapipe',
      },
    ],
  },
});
