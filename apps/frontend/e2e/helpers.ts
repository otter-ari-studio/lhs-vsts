import { expect, type Page } from "@playwright/test";

export async function waitForE2e(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__lhsE2e?.ready === true, null, {
    timeout: 60_000,
  });
}

export async function currentStepLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__lhsE2e?.currentStepLabel() ?? null);
}

export async function currentStepId(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__lhsE2e?.currentStepId() ?? null);
}

export async function inventory(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__lhsE2e?.inventory() ?? []);
}

export async function completedSteps(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__lhsE2e?.completedSteps() ?? []);
}

export async function e2eScore(page: Page): Promise<number | null> {
  return page.evaluate(() => window.__lhsE2e?.score() ?? null);
}

export async function e2ePassed(page: Page): Promise<boolean | null> {
  return page.evaluate(() => window.__lhsE2e?.passed() ?? null);
}

export async function e2eFaultCount(page: Page): Promise<number | null> {
  return page.evaluate(() => window.__lhsE2e?.faultCount() ?? null);
}

export async function e2eSessionId(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__lhsE2e?.sessionId() ?? null);
}

export async function applianceWashPending(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__lhsE2e?.applianceWashPending() ?? false);
}

export async function partKind(page: Page, partId: string): Promise<string | null> {
  return page.evaluate((id) => window.__lhsE2e?.partKind(id) ?? null, partId);
}

/** Map chrome stepId → partId (remove_/install_/open_/close_). */
export function partIdFromStep(stepId: string): string | null {
  for (const prefix of ["remove_", "install_", "open_", "close_"] as const) {
    if (stepId.startsWith(prefix)) return stepId.slice(prefix.length);
  }
  return null;
}

async function waitForProjectable(
  page: Page,
  partId: string,
  mode: "part" | "offer",
): Promise<void> {
  await page.waitForFunction(
    ({ id, m }) => {
      const p =
        m === "offer"
          ? (window.__lhsE2e?.projectOfferOrPart(id) ?? window.__lhsE2e?.projectPart(id))
          : window.__lhsE2e?.projectPart(id);
      return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
    },
    { id: partId, m: mode },
    { timeout: 30_000 },
  );
}

async function mouseDrag(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
): Promise<void> {
  // Hover briefly so PointerInteraction hover/HUD locks onto the part.
  await page.mouse.move(start.x, start.y);
  await page.waitForTimeout(80);
  await page.mouse.down();
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Ease-in toward the slot so the last frames linger near the anchor.
    const e = t * t;
    await page.mouse.move(start.x + (end.x - start.x) * e, start.y + (end.y - start.y) * e, {
      steps: 2,
    });
  }
  // Settle on the slot before release (snap checks pointer + part distance).
  await page.mouse.move(end.x, end.y);
  await page.waitForTimeout(60);
  await page.mouse.up();
}

/** Real user-style drag on the WebGL canvas — release near the left edge (inventory). */
export async function dragPartToCanvasLeft(page: Page, partId: string): Promise<void> {
  await waitForProjectable(page, partId, "part");

  const start = await page.evaluate((id) => window.__lhsE2e!.projectPart(id)!, partId);
  const rect = await page.evaluate(() => window.__lhsE2e!.canvasRect());

  const endX = rect.left + Math.min(48, rect.width * 0.08);
  const endY = start.y;

  await mouseDrag(page, start, { x: endX, y: endY });
}

/** Click the projected part (clip open/close, nut remove). */
export async function clickPart(page: Page, partId: string): Promise<void> {
  await waitForProjectable(page, partId, "part");
  const pos = await page.evaluate((id) => window.__lhsE2e!.projectPart(id)!, partId);
  await page.mouse.click(pos.x, pos.y - 2);
}

/**
 * Drag offered part toward its install anchor / slot and release.
 * Uses projectOfferOrPart for the grab start and projectAnchor for the drop.
 */
export async function dragPartToAnchor(page: Page, partId: string): Promise<void> {
  await waitForProjectable(page, partId, "offer");

  const start = await page.evaluate(
    (id) => window.__lhsE2e!.projectOfferOrPart(id) ?? window.__lhsE2e!.projectPart(id)!,
    partId,
  );
  await page.waitForFunction(
    (id) => {
      const p = window.__lhsE2e?.projectAnchor(id);
      return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
    },
    partId,
    { timeout: 15_000 },
  );
  const end = await page.evaluate((id) => window.__lhsE2e!.projectAnchor(id)!, partId);

  await mouseDrag(page, start, end);
}

/** Enter training from guide with e2e harness enabled. */
export async function enterTraining(page: Page): Promise<void> {
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "进入训练" }).click();
  await expect(page).toHaveURL(/#train/);
  await expect(page.getByTestId("train-viewport")).toBeVisible();
  await expect(page.getByTestId("sop-steps")).toContainText("拆下", {
    timeout: 60_000,
  });
  await waitForE2e(page);
}

/** Drive one chrome current step with real pointer events. */
export async function actCurrentChromeStep(page: Page): Promise<string | null> {
  const stepId = await currentStepId(page);
  if (!stepId) return null;

  if (stepId === "appliance_wash") {
    const overlay = page.locator(".wash-overlay");
    const pending = await applianceWashPending(page);
    const visible = await overlay.isVisible().catch(() => false);
    if (visible) {
      await expect(overlay).toBeHidden({ timeout: 20_000 });
    } else if (pending) {
      await expect(overlay).toBeVisible({ timeout: 15_000 });
      await expect(overlay).toBeHidden({ timeout: 20_000 });
    }
    return stepId;
  }

  const partId = partIdFromStep(stepId);
  if (!partId) return stepId;

  if (stepId.startsWith("open_") || stepId.startsWith("close_")) {
    await clickPart(page, partId);
    return stepId;
  }

  if (stepId.startsWith("remove_")) {
    const kind = await partKind(page, partId);
    if (kind === "rotate_nut") {
      await clickPart(page, partId);
    } else {
      await dragPartToCanvasLeft(page, partId);
    }
    return stepId;
  }

  if (stepId.startsWith("install_")) {
    // Wait for offer tray / pop-out before aiming (nuts park nearby; grabbables pop).
    await expect
      .poll(
        async () => {
          const completed = await completedSteps(page);
          if (completed.includes(stepId)) return true;
          const offered = await page.evaluate(
            (id) => window.__lhsE2e?.isInstallOffer(id) ?? false,
            partId,
          );
          return offered;
        },
        { timeout: 20_000 },
      )
      .toBeTruthy();

    const already = await completedSteps(page);
    if (!already.includes(stepId)) {
      await dragPartToAnchor(page, partId);
    }
    return stepId;
  }

  return stepId;
}

/** Retry the current step until it leaves chrome current (or completed). */
export async function completeCurrentStep(page: Page, timeoutMs = 45_000): Promise<string> {
  const started = await currentStepId(page);
  if (!started) throw new Error("No current chrome step");

  await expect
    .poll(
      async () => {
        const cur = await currentStepId(page);
        const done = await completedSteps(page);
        if (started === "appliance_wash") {
          // Wash is chrome-only; done when it is no longer current.
          if (cur !== started) return true;
          await actCurrentChromeStep(page);
          return (await currentStepId(page)) !== started;
        }
        if (done.includes(started) || cur !== started) return true;
        if (cur === started) {
          await actCurrentChromeStep(page);
        }
        const after = await completedSteps(page);
        return after.includes(started) || (await currentStepId(page)) !== started;
      },
      { timeout: timeoutMs, intervals: [500, 1000, 1500] },
    )
    .toBeTruthy();

  return started;
}
