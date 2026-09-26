import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const backendDir = path.join(root, "apps/backend");
const frontendDir = path.join(root, "apps/frontend");

/**
 * Real-browser E2E for the training client.
 * Starts backend (:3001) + frontend (:3000); suites open `/?e2e=1#/train`.
 * Full-session demo needs a long budget (many real pointer drags).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 8 * 60_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    // Rsbuild binds `localhost` (often ::1 only); 127.0.0.1 would hang the ready check.
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Bypass `vp` (EINVAL under Playwright) and `pnpm` wrappers (hang on teardown).
      // Build shared package once, then exec nest so SIGKILL reaches the server.
      command: "pnpm --filter @lhs-vsts/machine build && exec ./node_modules/.bin/nest start",
      cwd: backendDir,
      url: "http://localhost:3001/api/machines/current",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      // Omit gracefulShutdown → Playwright SIGKILLs the process group (SIGKILL is not a typed option).
    },
    {
      command: "exec ./node_modules/.bin/rsbuild",
      cwd: frontendDir,
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
