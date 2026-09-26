import { describe, expect, it } from "vite-plus/test";

import { getTrainingSession, setTrainingSession, TrainingSession } from "../src/TrainingSession.js";
import { clipNutDef, miniDef } from "./fixtures.js";

describe("TrainingSession", () => {
  it("illegal order deducts but can still pass", () => {
    const session = new TrainingSession(miniDef);
    expect(session.tryBeginRemove("filter_top")).toBe(false);
    expect(session.getScore()).toBe(95);
    expect(session.getFaultLog()[0]?.reason).toBe("需先拆集油盒");

    expect(session.tryBeginRemove("oil_box")).toBe(true);
    session.notifyRemoved("oil_box");
    expect(session.tryBeginRemove("filter_top")).toBe(true);
    session.notifyRemoved("filter_top");
    expect(session.isApplianceWashPending()).toBe(true);
    expect(session.completeAllCleans()).toBe(true);

    expect(session.tryInstall("filter_top")).toBe(true);
    expect(session.tryInstall("oil_box")).toBe(true);
    expect(session.getPassed()).toBe(true);
    expect(session.snapshot().finished).toBe(true);
  });

  it("completeAllCleans blocked until teardown", () => {
    const session = new TrainingSession(miniDef);
    expect(session.completeAllCleans()).toBe(false);
    expect(session.getActiveCleanIds()).toEqual([]);
    session.notifyRemoved("oil_box");
    expect(session.isApplianceWashReady()).toBe(false);
    session.notifyRemoved("filter_top");
    expect(session.completeAllCleans()).toBe(true);
    expect(session.completeAllCleans()).toBe(false);
  });

  it("chrome collapses cleans into appliance_wash", () => {
    const session = new TrainingSession(miniDef);
    const wash0 = session.buildChromeSteps().find((s) => s.stepId === "appliance_wash");
    expect(wash0?.status).toBe("locked");

    session.notifyRemoved("oil_box");
    session.notifyRemoved("filter_top");
    expect(session.buildChromeSteps().find((s) => s.stepId === "appliance_wash")?.status).toBe(
      "current",
    );

    session.completeAllCleans();
    expect(session.buildChromeSteps().find((s) => s.stepId === "appliance_wash")?.status).toBe(
      "done",
    );
    expect(session.buildChromeSteps().find((s) => s.stepId === "install_filter_top")?.status).toBe(
      "current",
    );
  });

  it("finish marks finished without required pass", () => {
    const session = new TrainingSession(miniDef);
    expect(session.getFinished()).toBe(false);
    session.finish();
    expect(session.getFinished()).toBe(true);
    expect(session.getRevision()).toBeGreaterThan(0);
  });

  it("unknown part helpers return false/safe defaults", () => {
    const session = new TrainingSession(miniDef);
    expect(session.tryBeginRemove("nope")).toBe(false);
    expect(session.tryInstall("nope")).toBe(false);
    expect(session.getState("nope")).toBe("installed");
    expect(session.getPart("oil_box")?.partId).toBe("oil_box");
    expect(session.canInstall("oil_box")).toBe(false);
    expect(session.installBlockReason("nope")).toBe("未知零件");
    expect(session.installBlockReason("oil_box")).toBe("零件未在物品栏");
  });

  it("installBlockReason surfaces tip when removed but locked", () => {
    const session = new TrainingSession(miniDef);
    session.notifyRemoved("oil_box");
    expect(session.installBlockReason("oil_box")).toBe("需先回装滤网并清洁");
  });

  it("notifyToleranceFail deducts", () => {
    const session = new TrainingSession(miniDef);
    session.notifyToleranceFail("oil_box");
    expect(session.getScore()).toBe(95);
  });

  it("completeClean requires removed part and prereqs", () => {
    const session = new TrainingSession(miniDef);
    expect(session.completeClean("missing")).toBe(false);
    expect(session.completeClean("oil_box")).toBe(false);
    session.notifyRemoved("oil_box");
    expect(session.completeClean("oil_box")).toBe(true);
    expect(session.completeClean("oil_box")).toBe(false);
  });

  it("clip open/close and nut action paths", () => {
    const session = new TrainingSession(clipNutDef);
    expect(session.tryToggleClip("panel")).toBe(false);
    expect(session.tryNutAction("panel")).toBe(false);
    expect(session.tryToggleClip("clip_a")).toBe(true); // open
    expect(session.getState("clip_a")).toBe("clip_open");

    // close needs clean_panel — illegal close deducts
    expect(session.tryToggleClip("clip_a")).toBe(false);
    expect(session.getScore()).toBeLessThan(100);

    expect(session.tryBeginRemove("panel")).toBe(true);
    session.notifyRemoved("panel");
    expect(session.tryNutAction("nut_a")).toBe(true); // remove (wrongDirection tip)
    expect(session.getState("nut_a")).toBe("removed");

    expect(session.completeAllCleans()).toBe(true);
    expect(session.tryToggleClip("clip_a")).toBe(true); // close
    expect(session.getState("clip_a")).toBe("clip_closed");
    expect(session.tryInstall("panel")).toBe(true);
    expect(session.tryNutAction("nut_a")).toBe(true); // install
    expect(session.getPassed()).toBe(true);
  });

  it("tryToggleClip pry when opening locked", () => {
    const lockedClip: typeof clipNutDef = {
      ...clipNutDef,
      parts: clipNutDef.parts.map((p) =>
        p.partId === "clip_a" ? { ...p, removePrereqs: ["remove_panel"] } : p,
      ),
    };
    const session = new TrainingSession(lockedClip);
    expect(session.tryToggleClip("clip_a")).toBe(false);
    expect(session.getFaultLog().some((f) => f.key.startsWith("pry:"))).toBe(true);
  });

  it("tip() emits without deduct", () => {
    const session = new TrainingSession(miniDef);
    session.tip("manual tip");
    expect(session.getScore()).toBe(100);
  });

  it("set/getTrainingSession singleton", () => {
    const session = new TrainingSession(miniDef);
    setTrainingSession(session);
    expect(getTrainingSession()).toBe(session);
    setTrainingSession(null);
    expect(getTrainingSession()).toBeNull();
  });

  it("isApplianceWashReady false when no clean spots", () => {
    const noClean = { ...miniDef, cleanSpots: [] };
    const session = new TrainingSession(noClean);
    expect(session.isApplianceWashReady()).toBe(false);
    expect(session.isApplianceWashDone()).toBe(true);
    expect(session.buildChromeSteps().some((s) => s.stepId === "appliance_wash")).toBe(false);
  });

  it("isStepComplete and getCompletedSteps track progress", () => {
    const session = new TrainingSession(miniDef);
    expect(session.isStepComplete("remove_oil_box")).toBe(false);
    session.notifyRemoved("oil_box");
    expect(session.isStepComplete("remove_oil_box")).toBe(true);
    expect(session.getCompletedSteps()).toContain("remove_oil_box");
    expect(session.getSessionId().startsWith("ts_")).toBe(true);
  });
});
