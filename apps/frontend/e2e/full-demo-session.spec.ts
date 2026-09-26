import { expect, test } from "@playwright/test";

import {
  applianceWashPending,
  completedSteps,
  completeCurrentStep,
  currentStepId,
  e2eFaultCount,
  e2ePassed,
  e2eScore,
  enterTraining,
  inventory,
} from "./helpers.js";

type ScoreRow = {
  id: string;
  score: number;
  passed: boolean;
  machineId: string;
  finishedAt: string;
};

const TEARDOWN_DONE_MARKERS = [
  "remove_oil_box",
  "remove_filter_top",
  "remove_filter_bottom",
  "open_clip_left",
  "open_clip_right",
  "remove_panel_glass",
  "remove_wind_cover",
  "remove_nut_wind",
  "remove_wind_wheel",
] as const;

test.describe("full training demo session", () => {
  test.setTimeout(8 * 60_000);

  test("合格整局：拆 → 清 → 装 → 结束写分 100", async ({ page }) => {
    // Capture page errors that historically flake (Html unmount / R3F).
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await enterTraining(page);

    // Baseline so AC3 asserts *this* run's POST, not a stale perfect score.
    const baselineRes = await page.request.get("http://localhost:3001/api/scores");
    expect(baselineRes.ok()).toBeTruthy();
    const baselineIds = new Set(((await baselineRes.json()) as ScoreRow[]).map((s) => s.id));

    let spottedOil = false;
    let spottedClip = false;
    let spottedNut = false;
    let spottedInstall = false;
    let sawWashGate = false;
    let sawReinstallStart = false;

    // Drive chrome current until passed / end screen.
    for (let guard = 0; guard < 40; guard++) {
      if ((await e2ePassed(page)) === true) break;

      const cur = await currentStepId(page);
      if (!cur) {
        // Brief settle — session may be finishing.
        await page.waitForTimeout(500);
        if ((await e2ePassed(page)) === true) break;
        continue;
      }

      const finishedStep = await completeCurrentStep(page, 60_000);

      // --- D6 spot checks ---
      if (
        finishedStep === "remove_oil_box" ||
        (await completedSteps(page)).includes("remove_oil_box")
      ) {
        if (!spottedOil) {
          await expect.poll(async () => inventory(page)).toContain("oil_box");
          await expect.poll(async () => completedSteps(page)).toContain("remove_oil_box");
          spottedOil = true;
        }
      }

      const done = await completedSteps(page);
      if (!spottedClip && (done.includes("open_clip_left") || done.includes("open_clip_right"))) {
        expect(done.some((s: string) => s === "open_clip_left" || s === "open_clip_right")).toBe(
          true,
        );
        spottedClip = true;
      }
      if (!spottedNut && done.includes("remove_nut_wind")) {
        spottedNut = true;
      }
      if (!spottedInstall) {
        const installDone = done.find((s: string) => s.startsWith("install_"));
        if (installDone) {
          spottedInstall = true;
        }
      }

      // --- Gate: teardown complete → wash ---
      if (!sawWashGate && TEARDOWN_DONE_MARKERS.every((s) => done.includes(s))) {
        await expect
          .poll(
            async () => {
              const pending = await applianceWashPending(page);
              const step = await currentStepId(page);
              return pending || step === "appliance_wash" || step?.startsWith("install_");
            },
            { timeout: 20_000 },
          )
          .toBeTruthy();
        sawWashGate = true;
      }

      // --- Gate: wash done → first install current ---
      if (sawWashGate && !sawReinstallStart) {
        const step = await currentStepId(page);
        if (step?.startsWith("install_")) {
          sawReinstallStart = true;
        }
      }
    }

    // Ensure wash / reinstall gates were observed (or already past if very fast).
    if (!sawWashGate) {
      const done = await completedSteps(page);
      expect(TEARDOWN_DONE_MARKERS.every((s) => done.includes(s))).toBe(true);
      sawWashGate = true;
    }
    await expect
      .poll(
        async () => {
          const step = await currentStepId(page);
          const passed = await e2ePassed(page);
          return sawReinstallStart || !!step?.startsWith("install_") || passed === true;
        },
        { timeout: 30_000 },
      )
      .toBeTruthy();

    // Spot-check requirements must have fired during the run.
    expect(spottedOil).toBe(true);
    expect(spottedClip).toBe(true);
    expect(spottedNut).toBe(true);
    expect(spottedInstall).toBe(true);

    // --- Final: passed + end screen 合格 / 100 / 无错因 ---
    await expect.poll(async () => e2ePassed(page), { timeout: 60_000 }).toBe(true);
    await expect.poll(async () => e2eScore(page)).toBe(100);
    await expect.poll(async () => e2eFaultCount(page)).toBe(0);

    const end = page.locator(".end-screen");
    await expect(end).toBeVisible({ timeout: 30_000 });
    await expect(end.getByRole("heading", { name: "合格" })).toBeVisible();
    await expect(end.locator(".end-score")).toContainText("100");
    await expect(end.getByText("无扣分记录")).toBeVisible();
    await expect(end.locator(".fault-block")).toHaveCount(0);

    // Score POST is fire-and-forget; poll until a *new* perfect record appears.
    await expect
      .poll(
        async () => {
          const res = await page.request.get("http://localhost:3001/api/scores");
          expect(res.ok()).toBeTruthy();
          const scores = (await res.json()) as ScoreRow[];
          const fresh = scores
            .filter((s) => !baselineIds.has(s.id) && s.passed && s.score === 100)
            .toSorted((a, b) => b.finishedAt.localeCompare(a.finishedAt));
          return fresh[0] ?? null;
        },
        { timeout: 30_000 },
      )
      .toMatchObject({ passed: true, score: 100 });

    // Soft assert: no removeChildFromContainer (or similar) during the run.
    const fatal = pageErrors.filter((m) => /removeChildFromContainer|NotFoundError/i.test(m));
    expect(fatal, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});
