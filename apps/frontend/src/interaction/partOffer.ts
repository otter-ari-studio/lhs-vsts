import { getTrainingSession } from "@lhs-vsts/machine";
import { installStep } from "@lhs-vsts/machine";
import type { Vec3 } from "@lhs-vsts/machine";

/**
 * World position where the current reinstall prop "pops out" for grab.
 * Right-front of the hood so hands can reach without fighting the chassis.
 */
export const PROP_OFFER_POS: Vec3 = [0.34, 0.22, 0.22];

/** Current chrome install_* part id, or null. */
export function currentInstallOfferPartId(): string | null {
  const session = getTrainingSession();
  if (!session) return null;
  const current = session.buildChromeSteps().find((s) => s.status === "current");
  if (!current?.stepId.startsWith("install_")) return null;
  const partId = current.stepId.slice("install_".length);
  if (session.getState(partId) !== "removed") return null;
  if (!session.canInstall(partId)) return null;
  return partId;
}

export function isInstallOfferPart(partId: string): boolean {
  return currentInstallOfferPartId() === partId;
}

export function installStepIdFor(partId: string): string {
  return installStep(partId);
}
