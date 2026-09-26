import { expect, test } from "@rstest/core";
import {
  layerForPartZ,
  projectToSurface,
  surfaceDistance,
  surfaceZFromPartAnchors,
  SURFACE_LAYER_Z,
} from "../src/interaction/operationSurface";

test("layerForPartZ maps anchors to front/mid/deep", () => {
  expect(layerForPartZ(0.22)).toBe("front");
  expect(layerForPartZ(0.18)).toBe("mid");
  expect(layerForPartZ(0.1)).toBe("deep");
});

test("projectToSurface locks Z onto the face", () => {
  const p = projectToSurface([0.1, 0.2, 0.5], SURFACE_LAYER_Z.front);
  expect(p[0]).toBeCloseTo(0.1);
  expect(p[1]).toBeCloseTo(0.2);
  expect(p[2]).toBeCloseTo(0.22);
});

test("surfaceDistance ignores most of Z error", () => {
  const a: [number, number, number] = [0, 0, 0.22];
  const b: [number, number, number] = [0.1, 0, 0.5];
  const d = surfaceDistance(a, b);
  // XY = 0.1; heavy Z would dominate without weighting
  expect(d).toBeLessThan(0.15);
  expect(d).toBeGreaterThan(0.09);
});

test("surfaceZFromPartAnchors averages layer Z of SOP parts", () => {
  expect(surfaceZFromPartAnchors([0.22, 0.22])).toBeCloseTo(0.22);
  expect(surfaceZFromPartAnchors([0.1])).toBeCloseTo(SURFACE_LAYER_Z.deep);
});
