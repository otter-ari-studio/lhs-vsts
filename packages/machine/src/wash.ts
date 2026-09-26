import type { MachineDef } from "./types.js";

export const APPLIANCE_WASH_STEP_ID = "appliance_wash";
export const APPLIANCE_WASH_DURATION_MS = 3000;

export function isCleanStepId(stepId: string, def: MachineDef): boolean {
  return def.cleanSpots.some((s) => s.stepId === stepId);
}
