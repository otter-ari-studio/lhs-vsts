import { expect, test, type Page } from "@playwright/test";

type E2eApi = {
  ready: boolean;
  projectPart(partId: string): { x: number; y: number } | null;
  inventory(): string[];
  completedSteps(): string[];
  canvasRect(): { left: number; top: number; width: number; height: number };
};

async function waitForE2e(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__lhsE2e?.ready === true, null, {
    timeout: 60_000,
  });
}

async function e2e(page: Page): Promise<E2eApi> {
  const api = await page.evaluate(() => window.__lhsE2e);
  if (!api) throw new Error("__lhsE2e missing — open with ?e2e=1");
  return api as E2eApi;
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

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // Intermediate points so PointerInteraction receives move frames
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(start.x + (endX - start.x) * t, start.y + (endY - start.y) * t);
  }
  await page.mouse.up();
}

test.describe("training canvas real drag", () => {
  test("drag oil_box off the hood into inventory via pointer events", async ({
    page,
  }) => {
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
      .poll(async () => (await e2e(page)).currentStepLabel(), { timeout: 30_000 })
      .toMatch(/集油盒|oil_box|拆下/);

    await dragPartToCanvasLeft(page, "oil_box");

    await expect
      .poll(async () => (await e2e(page)).inventory(), { timeout: 15_000 })
      .toContain("oil_box");

    await expect
      .poll(async () => (await e2e(page)).completedSteps(), { timeout: 10_000 })
      .toContain("remove_oil_box");

    await expect(page.getByTestId("train-inventory")).toContainText("集油盒");
  });
});
