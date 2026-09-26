import { describe, expect, it } from "vite-plus/test";
import {
  buildRequiredSteps,
  buildStepPrereqs,
  initialPartStates,
  isPassed,
  listStepInfos,
  missingPrereqs,
  prereqsMet,
  stepLabel,
  topoSortSteps,
} from "../src/StepGraph.js";
import { clipNutDef, miniDef } from "./fixtures.js";

describe("StepGraph", () => {
  it("builds prereqs including cleans", () => {
    const prereqs = buildStepPrereqs(miniDef);
    expect(prereqs.get("clean_oil_box")).toEqual(["remove_oil_box"]);
    expect(prereqsMet("remove_filter_top", new Set(["remove_oil_box"]), prereqs)).toBe(true);
    expect(prereqsMet("remove_filter_top", new Set(), prereqs)).toBe(false);
  });

  it("orders required steps topologically", () => {
    const required = buildRequiredSteps(miniDef);
    expect(required).toContain("clean_oil_box");
    expect(required.indexOf("remove_oil_box")).toBeLessThan(required.indexOf("clean_oil_box"));
  });

  it("isPassed ignores score", () => {
    const required = buildRequiredSteps(miniDef);
    expect(isPassed(required, new Set(required))).toBe(true);
    expect(isPassed(required, new Set(required.slice(0, -1)))).toBe(false);
  });

  it("labels steps and lists infos", () => {
    expect(stepLabel(miniDef, "remove_oil_box")).toBe("拆下 集油盒");
    expect(stepLabel(miniDef, "install_oil_box")).toBe("回装 集油盒");
    expect(stepLabel(miniDef, "clean_oil_box")).toBe("清洁集油盒");
    expect(stepLabel(miniDef, "unknown_step")).toBe("unknown_step");

    const infos = listStepInfos(miniDef);
    expect(infos.some((i) => i.stepId === "remove_oil_box")).toBe(true);
  });

  it("initialPartStates skips fixed_shell and sets clip closed", () => {
    const states = initialPartStates(clipNutDef);
    expect(states.has("shell")).toBe(false);
    expect(states.get("clip_a")).toBe("clip_closed");
    expect(states.get("panel")).toBe("installed");
  });

  it("missingPrereqs lists incomplete deps", () => {
    const prereqs = buildStepPrereqs(miniDef);
    expect(missingPrereqs("remove_filter_top", new Set(), prereqs)).toEqual(["remove_oil_box"]);
  });

  it("topoSortSteps appends remainder on cycle", () => {
    const prereqs = new Map([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);
    const ordered = topoSortSteps(["a", "b"], prereqs);
    expect(ordered.sort()).toEqual(["a", "b"]);
  });

  it("labels open/close for clips", () => {
    expect(stepLabel(clipNutDef, "open_clip_a")).toBe("打开 卡扣A");
    expect(stepLabel(clipNutDef, "close_clip_a")).toBe("锁止 卡扣A");
  });
});
