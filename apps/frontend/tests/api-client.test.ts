import { afterEach, expect, rs, test } from "@rstest/core";
import {
  fetchCurrentMachine,
  fetchScores,
  saveCurrentMachine,
  submitScore,
} from "../src/api/client";
import { loadMachineDef } from "../src/api/loadMachineDef";
import { submitSessionScoreOnce } from "../src/api/submitSessionScore";

afterEach(() => {
  rs.restoreAllMocks();
});

test("fetchCurrentMachine / saveCurrentMachine happy path", async () => {
  const json = { machineId: "m" };
  const fetchMock = rs
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(json), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...json, displayName: "x" }), {
        status: 200,
      }),
    );

  await expect(fetchCurrentMachine()).resolves.toEqual(json);
  await expect(saveCurrentMachine(json)).resolves.toEqual({
    ...json,
    displayName: "x",
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("api client throws on non-OK responses", async () => {
  rs.spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(new Response("nope", { status: 500 })),
  );
  await expect(fetchCurrentMachine()).rejects.toThrow(/GET \/api\/machines\/current/);
  await expect(saveCurrentMachine({})).rejects.toThrow(/PUT \/api\/machines\/current/);
  await expect(fetchScores()).rejects.toThrow(/GET \/api\/scores/);
  await expect(
    submitScore({ machineId: "m", score: 1, passed: false, faults: [] }),
  ).rejects.toThrow(/POST \/api\/scores/);
});

test("fetchScores and submitScore parse JSON", async () => {
  const record = {
    id: "1",
    machineId: "m",
    score: 90,
    passed: true,
    faults: [],
    finishedAt: "2026-01-01T00:00:00.000Z",
  };
  rs.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify([record]), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(record), { status: 201 }));

  await expect(fetchScores()).resolves.toEqual([record]);
  await expect(
    submitScore({
      machineId: "m",
      score: 90,
      passed: true,
      faults: [],
    }),
  ).resolves.toEqual(record);
});

test("loadMachineDef parses backend payload", async () => {
  const fixture = {
    machineId: "range_hood_generic",
    displayName: "油烟机",
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
        partId: "oil_box",
        displayName: "集油盒",
        kind: "grabbable",
        anchor: { position: [0, 0, 0] },
        visual: { adapter: "kitbash", kitbashKey: "oil_box" },
        removePrereqs: [],
        installPrereqs: [],
        tips: {},
      },
    ],
    cleanSpots: [],
  };
  rs.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(fixture), { status: 200 }),
  );
  const def = await loadMachineDef();
  expect(def.machineId).toBe("range_hood_generic");
});

test("loadMachineDef throws on HTTP error", async () => {
  rs.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
  await expect(loadMachineDef("/api/machines/current")).rejects.toThrow(/404/);
});

test("submitSessionScoreOnce submits once and retries after failure", async () => {
  const submittedRef = { current: null as string | null };
  const submit = rs.fn(async () => ({
    id: "1",
    machineId: "m",
    score: 100,
    passed: true,
    faults: [],
    finishedAt: "t",
  }));

  await expect(
    submitSessionScoreOnce({
      sessionId: "s1",
      submittedRef,
      machineId: "m",
      score: 100,
      passed: true,
      faults: [],
      submit,
    }),
  ).resolves.toBe(true);
  await expect(
    submitSessionScoreOnce({
      sessionId: "s1",
      submittedRef,
      machineId: "m",
      score: 100,
      passed: true,
      faults: [],
      submit,
    }),
  ).resolves.toBe(false);
  expect(submit).toHaveBeenCalledTimes(1);

  const fail = rs.fn(async () => {
    throw new Error("network");
  });
  const ref2 = { current: null as string | null };
  await expect(
    submitSessionScoreOnce({
      sessionId: "s2",
      submittedRef: ref2,
      machineId: "m",
      score: 1,
      passed: false,
      faults: [{ key: "k", reason: "r", amount: 1 }],
      submit: fail,
    }),
  ).rejects.toThrow(/network/);
  expect(ref2.current).toBeNull();
});
