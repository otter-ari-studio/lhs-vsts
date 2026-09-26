import { describe, expect, it } from "vite-plus/test";

import { APPLIANCE_WASH_DURATION_MS, APPLIANCE_WASH_STEP_ID, isCleanStepId } from "../src/wash.js";
import { miniDef } from "./fixtures.js";

describe("wash", () => {
  it("exposes wash constants and detects clean step ids", () => {
    expect(APPLIANCE_WASH_STEP_ID).toBe("appliance_wash");
    expect(APPLIANCE_WASH_DURATION_MS).toBe(3000);
    expect(isCleanStepId("clean_oil_box", miniDef)).toBe(true);
    expect(isCleanStepId("remove_oil_box", miniDef)).toBe(false);
  });
});
