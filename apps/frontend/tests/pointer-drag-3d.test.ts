import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@rstest/core";
import { Vector3 } from "three";
import {
  parseMachineDef,
  setTrainingSession,
  TrainingSession,
  type MachineDef,
  type PartDef,
} from "@lhs-vsts/machine";
import { aimTargetHub } from "../src/interaction/aimTargetHub";
import { createGrabbableDragApi } from "../src/interaction/grabbableDragApi";
import { setOrbitLocked } from "../src/interaction/orbitLockHub";
import { INVENTORY_PARK, partInventory } from "../src/interaction/partInventory";
import { PROP_OFFER_POS } from "../src/interaction/partOffer";
import { createPointerDragSession } from "../src/interaction/pointerDragSession";
import { clearInteractables, registerInteractable } from "../src/interaction/registry";
import { selectionHub } from "../src/interaction/selectionHub";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.resolve(__dirname, "../../backend/data/seed/range_hood_generic.json");

function loadSeed(): MachineDef {
  return parseMachineDef(JSON.parse(readFileSync(SEED, "utf8")) as unknown);
}

function miniMachine(): MachineDef {
  return parseMachineDef({
    machineId: "drag_fixture",
    displayName: "拖拽夹具",
    unit: "meter",
    scoring: {
      baseScore: 100,
      deductIllegalOrder: 5,
      deductClipPry: 10,
      deductNutWrongDirection: 5,
      deductToleranceFail: 5,
    },
    assemblyDefaults: {
      positionToleranceMeters: 0.015,
      angleToleranceDegrees: 5,
      snapRangeMeters: 0.08,
    },
    parts: [
      {
        partId: "shell_main",
        displayName: "壳",
        kind: "fixed_shell",
        anchor: { position: [0, 0.15, 0] },
        visual: { adapter: "kitbash", kitbashKey: "shell_main" },
        removePrereqs: [],
        installPrereqs: [],
        tips: {},
      },
      {
        partId: "widget",
        displayName: "可抓件",
        kind: "grabbable",
        anchor: { position: [0, 0.05, 0.22] },
        visual: { adapter: "kitbash", kitbashKey: "oil_box" },
        removePrereqs: [],
        installPrereqs: [],
        tips: {},
        snapRangeMeters: 0.08,
      },
    ],
    cleanSpots: [],
  });
}

function resetHubs() {
  clearInteractables();
  partInventory.clear();
  aimTargetHub.clear();
  selectionHub.clear();
  setOrbitLocked(false);
  setTrainingSession(null);
}

function mountGrabbable(part: PartDef, snapRange: number, isSop: () => boolean) {
  const worldPos = new Vector3(...part.anchor.position);
  const api = createGrabbableDragApi({
    part,
    snapRange,
    worldPos,
    isSopTarget: isSop,
  });
  registerInteractable(api);
  return { api, worldPos };
}

test("automated 3D drag: range-hood oil_box press-drag-release into inventory", () => {
  resetHubs();
  const def = loadSeed();
  const session = new TrainingSession(def);
  setTrainingSession(session);

  const oil = def.parts.find((p) => p.partId === "oil_box");
  expect(oil).toBeTruthy();
  const { worldPos } = mountGrabbable(oil!, def.assemblyDefaults.snapRangeMeters, () => true);

  const ptr = createPointerDragSession();
  const start: [number, number, number] = [worldPos.x, worldPos.y, worldPos.z];
  ptr.moveTo(start);
  expect(ptr.pointerDown()).toBe(true);
  expect(ptr.getEngaged()?.id).toBe("oil_box");
  expect(session.getState("oil_box")).toBe("removed");

  for (let i = 1; i <= 8; i++) {
    ptr.moveTo([start[0] - i * 0.04, start[1], start[2]]);
    ptr.holdTick(1 / 60);
  }
  ptr.moveTo([INVENTORY_PARK[0], INVENTORY_PARK[1], start[2]]);
  ptr.pointerUp();

  expect(ptr.getEngaged()).toBeNull();
  expect(session.getCompletedSteps()).toContain("remove_oil_box");
  expect(partInventory.list()).toContain("oil_box");
  resetHubs();
});

test("automated 3D drag: remove then drag-install back onto slot", () => {
  resetHubs();
  const def = miniMachine();
  const session = new TrainingSession(def);
  setTrainingSession(session);

  const widget = def.parts.find((p) => p.partId === "widget")!;
  const slot: [number, number, number] = [
    widget.anchor.position[0],
    widget.anchor.position[1],
    widget.anchor.position[2],
  ];
  const { worldPos } = mountGrabbable(
    widget,
    def.assemblyDefaults.snapRangeMeters,
    () => session.getState("widget") === "installed",
  );

  const ptr = createPointerDragSession();

  // Press-drag away from slot (release). With empty installPrereqs the part
  // becomes the install offer immediately, so it parks on the offer tray
  // instead of the inventory list — same as GrabPart.
  ptr.moveTo(slot);
  expect(ptr.pointerDown()).toBe(true);
  expect(session.getState("widget")).toBe("removed");
  ptr.moveTo([INVENTORY_PARK[0], worldPos.y, slot[2]]);
  ptr.pointerUp();

  expect(session.canInstall("widget")).toBe(true);
  expect(worldPos.x).toBeCloseTo(PROP_OFFER_POS[0], 5);
  expect(worldPos.y).toBeCloseTo(PROP_OFFER_POS[1], 5);

  // Grab from offer tray and drag onto the install slot
  ptr.moveTo([...PROP_OFFER_POS]);
  expect(ptr.pointerDown()).toBe(true);
  expect(ptr.getEngaged()?.id).toBe("widget");

  ptr.moveTo(slot);
  ptr.holdTick(1 / 30);
  ptr.pointerUp();

  expect(session.getState("widget")).toBe("installed");
  expect(partInventory.has("widget")).toBe(false);
  expect(session.getPassed()).toBe(true);
  resetHubs();
});

test("pointer session: miss, leave, clip click, and lockout", () => {
  resetHubs();
  const ptr = createPointerDragSession();
  ptr.moveTo([10, 10, 0.22]);
  expect(ptr.pointerDown()).toBe(false);
  ptr.pointerUp();

  let clipFired = 0;
  const clipPos = new Vector3(0.1, 0.1, 0.22);
  registerInteractable({
    id: "clip_a",
    kind: "clip",
    interactionRadius: 0.2,
    isInteractableNow: () => true,
    pickPriority: () => 10,
    distanceTo: (h) => clipPos.distanceTo(h),
    copyWorldPosition: (out) => {
      out.copy(clipPos);
      return true;
    },
    onPinchStart: () => {
      clipFired += 1;
      return true;
    },
    onPinchHold: () => {},
    onPinchEnd: () => {},
  });
  ptr.moveTo([0.1, 0.1, 0.22]);
  expect(ptr.pointerDown()).toBe(true);
  expect(clipFired).toBe(1);
  expect(ptr.getEngaged()).toBeNull();
  ptr.pointerUp();

  let starts = 0;
  const lockPos = new Vector3(0.5, 0.1, 0.22);
  registerInteractable({
    id: "locked_part",
    kind: "grabbable",
    interactionRadius: 0.2,
    isInteractableNow: () => true,
    pickPriority: () => 20,
    distanceTo: (h) => lockPos.distanceTo(h),
    copyWorldPosition: (out) => {
      out.copy(lockPos);
      return true;
    },
    onPinchStart: () => {
      starts += 1;
      return false;
    },
    onPinchHold: () => {},
    onPinchEnd: () => {},
  });
  ptr.moveTo([0.5, 0.1, 0.22]);
  expect(ptr.pointerDown()).toBe(true);
  expect(starts).toBe(1);
  // Lockout blocks immediate re-commit at same spot
  ptr.pointerUp();
  ptr.moveTo([0.5, 0.1, 0.22]);
  ptr.pointerDown();
  expect(starts).toBe(1);

  // Fresh registry for leave/release path
  clearInteractables();
  const def = miniMachine();
  const session = new TrainingSession(def);
  setTrainingSession(session);
  const widget = def.parts.find((p) => p.partId === "widget")!;
  mountGrabbable(widget, 0.08, () => true);
  const ptr2 = createPointerDragSession();
  ptr2.moveTo([0, 0.05, 0.22]);
  ptr2.pointerDown();
  expect(ptr2.getEngaged()?.id).toBe("widget");
  ptr2.pointerLeave();
  expect(ptr2.getEngaged()).toBeNull();
  expect(ptr2.isPointerDown()).toBe(false);
  resetHubs();
});

test("grabbable drag: lateral throw tip and tolerance fail", () => {
  resetHubs();
  // oil_box cannot reinstall yet after remove, so release parks in inventory.
  const seed = loadSeed();
  const session = new TrainingSession(seed);
  setTrainingSession(session);
  const oil = seed.parts.find((p) => p.partId === "oil_box")!;
  const { worldPos } = mountGrabbable(oil, 0.08, () => true);
  const ptr = createPointerDragSession();
  const start: [number, number, number] = [worldPos.x, worldPos.y, worldPos.z];
  ptr.moveTo(start);
  ptr.pointerDown();
  // Fast leftward samples for throw detect
  const t0 = performance.now();
  for (let i = 0; i < 6; i++) {
    Object.defineProperty(performance, "now", {
      value: () => t0 + i * 40,
      configurable: true,
    });
    ptr.moveTo([start[0] - 0.08 * (i + 1), start[1], start[2]]);
    ptr.holdTick(0.04);
  }
  ptr.pointerUp();
  expect(partInventory.has("oil_box")).toBe(true);
  resetHubs();
});
