import { expect, test } from "@playwright/test";

import {
  completedSteps,
  currentStepLabel,
  dragPartToCanvasLeft,
  enterTraining,
  inventory,
} from "./helpers.js";

test.describe("training canvas real drag", () => {
  test("drag oil_box off the hood into inventory via pointer events", async ({ page }) => {
    await enterTraining(page);

    // First SOP target on the seeded range hood is 集油盒 (oil_box).
    await expect
      .poll(async () => currentStepLabel(page), { timeout: 30_000 })
      .toMatch(/集油盒|oil_box|拆下/);

    await dragPartToCanvasLeft(page, "oil_box");

    await expect.poll(async () => inventory(page), { timeout: 15_000 }).toContain("oil_box");

    await expect
      .poll(async () => completedSteps(page), { timeout: 10_000 })
      .toContain("remove_oil_box");

    await expect(page.getByTestId("train-inventory")).toContainText("集油盒");
  });
});
