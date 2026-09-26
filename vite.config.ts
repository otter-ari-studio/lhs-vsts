import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    sortImports: true,
    sortPackageJson: true,
    sortTailwindcss: true,
    ignorePatterns: [".agents", ".cursor", ".trellis", "coverage"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [".agents", ".cursor", ".trellis", "coverage"],
  },
  run: {
    cache: true,
  },
});
