import { expect, test, type Page } from "@playwright/test";

async function waitForE2e(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__lhsE2e?.ready === true, null, {
    timeout: 60_000,
  });
}

async function currentStepLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__lhsE2e?.currentStepLabel() ?? null);
}

async function inventory(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__lhsE2e?.inventory() ?? []);
}

async function completedSteps(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__lhsE2e?.completedSteps() ?? []);
}

/** Real user-style drag on the WebGL canvas. */
async function dragPartToCanvasLeft(page: Page, partId: string): Promise<void> {
  await page.waitForFunction(
    (id) => {
      const p = window.__lhsE2e?.projectPart(id);
      return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
    },
    partId,
    { timeout: 30_000 },
  );

  const start = await page.evaluate((id) => window.__lhsE2e!.projectPart(id)!, partId);
  const rect = await page.evaluate(() => window.__lhsE2e!.canvasRect());

  // Release near the left edge of the canvas (inventory side), still on the canvas.
  const endX = rect.left + Math.min(48, rect.width * 0.08);
  const endY = start.y;

  // Aim slightly above the projected center so the ray hits the part mesh.
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // Intermediate points so PointerInteraction receives move frames / throw samples
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(start.x + (endX - start.x) * t, start.y + (endY - start.y) * t, {
      steps: 2,
    });
  }
  await page.mouse.up();
}

test.describe("training canvas real drag", () => {
  test("drag oil_box off the hood into inventory via pointer events", async ({ page }) => {
    await page.goto("/?e2e=1");
    await page.getByRole("button", { name: "进入训练" }).click();
    await expect(page).toHaveURL(/#train/);

    await expect(page.getByTestId("train-viewport")).toBeVisible();
    await expect(page.getByTestId("sop-steps")).toContainText("拆下", {
      timeout: 60_000,
    });

    await waitForE2e(page);

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
