import { describe, expect, it } from "vitest";
import { findPart, listPartIds, parseMachineDef } from "../src/parseMachineDef.js";
import { cleanStep, closeStep, installStep, openStep, removeStep } from "../src/types.js";
import { miniDef } from "./fixtures.js";

const baseRaw = structuredClone(miniDef) as Record<string, unknown>;

describe("parseMachineDef", () => {
  it("accepts a valid MachineDef", () => {
    const def = parseMachineDef(baseRaw);
    expect(def.machineId).toBe("test");
    expect(listPartIds(def)).toEqual(["oil_box", "filter_top"]);
    expect(findPart(def, "oil_box")?.displayName).toBe("集油盒");
    expect(findPart(def, "missing")).toBeUndefined();
  });

  it("rejects non-object root", () => {
    expect(() => parseMachineDef(null)).toThrow(/root must be an object/);
    expect(() => parseMachineDef([])).toThrow(/root must be an object/);
  });

  it("rejects non-meter unit", () => {
    expect(() => parseMachineDef({ ...baseRaw, unit: "cm" })).toThrow(/unit must be "meter"/);
  });

  it("rejects empty parts", () => {
    expect(() => parseMachineDef({ ...baseRaw, parts: [] })).toThrow(/non-empty/);
  });

  it("rejects duplicate partId", () => {
    const parts = [miniDef.parts[0], { ...miniDef.parts[0] }];
    expect(() => parseMachineDef({ ...baseRaw, parts })).toThrow(/duplicate partId/);
  });

  it("rejects Unity prefabPath", () => {
    const parts = [{ ...miniDef.parts[0], prefabPath: "Assets/x.prefab" }];
    expect(() => parseMachineDef({ ...baseRaw, parts })).toThrow(/prefabPath/);
  });

  it("rejects unknown kind / adapter / thread / space", () => {
    expect(() =>
      parseMachineDef({
        ...baseRaw,
        parts: [{ ...miniDef.parts[0], kind: "hinge" }],
      }),
    ).toThrow(/unknown part kind/);

    expect(() =>
      parseMachineDef({
        ...baseRaw,
        parts: [{ ...miniDef.parts[0], visual: { adapter: "fbx" } }],
      }),
    ).toThrow(/unknown visual adapter/);

    expect(() =>
      parseMachineDef({
        ...baseRaw,
        parts: [
          {
            ...miniDef.parts[0],
            kind: "rotate_nut",
            thread: "lefty",
          },
        ],
      }),
    ).toThrow(/unknown thread/);

    expect(() =>
      parseMachineDef({
        ...baseRaw,
        cleanSpots: [{ ...miniDef.cleanSpots[0], space: "local" }],
      }),
    ).toThrow(/unknown clean space/);
  });

  it("rejects kitbash without kitbashKey", () => {
    expect(() =>
      parseMachineDef({
        ...baseRaw,
        parts: [{ ...miniDef.parts[0], visual: { adapter: "kitbash" } }],
      }),
    ).toThrow(/kitbashKey/);
  });

  it("rejects cleanSpot unknown partId and non-array cleanSpots", () => {
    expect(() =>
      parseMachineDef({
        ...baseRaw,
        cleanSpots: [{ ...miniDef.cleanSpots[0], partId: "nope" }],
      }),
    ).toThrow(/unknown partId/);

    expect(() => parseMachineDef({ ...baseRaw, cleanSpots: {} })).toThrow(
      /cleanSpots must be an array/,
    );
  });

  it("rejects bad scoring / assemblyDefaults / vectors", () => {
    expect(() => parseMachineDef({ ...baseRaw, scoring: null })).toThrow(/scoring/);
    expect(() =>
      parseMachineDef({
        ...baseRaw,
        scoring: { ...miniDef.scoring, baseScore: "x" },
      }),
    ).toThrow(/baseScore/);
    expect(() => parseMachineDef({ ...baseRaw, assemblyDefaults: 1 })).toThrow(/assemblyDefaults/);
    expect(() =>
      parseMachineDef({
        ...baseRaw,
        parts: [
          {
            ...miniDef.parts[0],
            anchor: { position: [1, 2] },
          },
        ],
      }),
    ).toThrow(/\[x,y,z\]/);
  });

  it("parses optional tip fields and rotation / snapRange / gltf", () => {
    const def = parseMachineDef({
      ...baseRaw,
      parts: [
        {
          ...miniDef.parts[0],
          snapRangeMeters: 0.05,
          tips: {
            removeLocked: "r",
            installLocked: "i",
            pry: "p",
            wrongDirection: "w",
          },
          visual: {
            adapter: "gltf",
            gltfUrl: "/a.glb",
            nodeName: "n",
          },
          anchor: { position: [0, 0, 0], rotation: [1, 0, 0] },
        },
        miniDef.parts[1],
      ],
    });
    expect(def.parts[0]?.tips.pry).toBe("p");
    expect(def.parts[0]?.snapRangeMeters).toBe(0.05);
    expect(def.parts[0]?.anchor.rotation).toEqual([1, 0, 0]);
    expect(def.parts[0]?.visual.gltfUrl).toBe("/a.glb");
  });

  it("rejects wrong-typed optional strings and tips", () => {
    expect(() =>
      parseMachineDef({
        ...baseRaw,
        parts: [
          {
            ...miniDef.parts[0],
            visual: { adapter: "kitbash", kitbashKey: 1 },
          },
        ],
      }),
    ).toThrow(/optional string/);

    expect(() =>
      parseMachineDef({
        ...baseRaw,
        parts: [{ ...miniDef.parts[0], tips: "x" }],
      }),
    ).toThrow(/tips must be an object/);
  });
});

describe("step id helpers", () => {
  it("builds remove/install/open/close/clean ids", () => {
    expect(removeStep("a")).toBe("remove_a");
    expect(installStep("a")).toBe("install_a");
    expect(openStep("a")).toBe("open_a");
    expect(closeStep("a")).toBe("close_a");
    expect(cleanStep("a")).toBe("clean_a");
  });
});
