import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseMachineDef, TrainingSession, type MachineDef } from "@lhs-vsts/machine";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { AppModule } from "../src/app.module.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_SRC = path.resolve(__dirname, "../data/seed/range_hood_generic.json");

/**
 * AC8 E2E (no 3D mouse): PUT machine → TrainingSession finishes → POST score → GET list.
 */
describe("Training flow E2E (API + session)", () => {
  let app: INestApplication;
  let dataDir: string;
  let prevDataDir: string | undefined;

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "lhs-vsts-e2e-"));
    await fs.mkdir(path.join(dataDir, "seed"), { recursive: true });
    await fs.mkdir(path.join(dataDir, "runtime"), { recursive: true });
    await fs.copyFile(SEED_SRC, path.join(dataDir, "seed", "range_hood_generic.json"));

    prevDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = dataDir;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (prevDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = prevDataDir;
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("PUT machine change → session pass → POST score → GET list", async () => {
    const server = app.getHttpServer();

    const currentRes = await request(server).get("/api/machines/current").expect(200);
    const current = parseMachineDef(currentRes.body);
    const updated: MachineDef = {
      ...current,
      displayName: "E2E改名油烟机",
      scoring: {
        ...current.scoring,
        deductIllegalOrder: 11,
      },
    };

    await request(server).put("/api/machines/current").send(updated).expect(200);

    const loadedRes = await request(server).get("/api/machines/current").expect(200);
    const def = parseMachineDef(loadedRes.body);
    expect(def.displayName).toBe("E2E改名油烟机");
    expect(def.scoring.deductIllegalOrder).toBe(11);

    const session = new TrainingSession(def);
    // intentional illegal order (uses saved deductIllegalOrder)
    expect(session.tryBeginRemove("filter_top")).toBe(false);
    expect(session.getScore()).toBe(100 - 11);

    const teardown = ["oil_box", "filter_top", "filter_bottom"] as const;
    for (const id of teardown) {
      expect(session.tryBeginRemove(id)).toBe(true);
      session.notifyRemoved(id);
    }
    expect(session.tryToggleClip("clip_left")).toBe(true);
    expect(session.tryToggleClip("clip_right")).toBe(true);
    expect(session.tryBeginRemove("panel_glass")).toBe(true);
    session.notifyRemoved("panel_glass");
    expect(session.tryBeginRemove("wind_cover")).toBe(true);
    session.notifyRemoved("wind_cover");
    expect(session.tryNutAction("nut_wind")).toBe(true);
    expect(session.tryBeginRemove("wind_wheel")).toBe(true);
    session.notifyRemoved("wind_wheel");

    expect(session.completeAllCleans()).toBe(true);

    expect(session.tryInstall("wind_wheel")).toBe(true);
    expect(session.tryNutAction("nut_wind")).toBe(true);
    expect(session.tryInstall("wind_cover")).toBe(true);
    expect(session.tryInstall("panel_glass")).toBe(true);
    expect(session.tryToggleClip("clip_left")).toBe(true);
    expect(session.tryToggleClip("clip_right")).toBe(true);
    expect(session.tryInstall("filter_bottom")).toBe(true);
    expect(session.tryInstall("filter_top")).toBe(true);
    expect(session.tryInstall("oil_box")).toBe(true);

    expect(session.getPassed()).toBe(true);
    const snap = session.snapshot();
    expect(snap.finished || snap.passed).toBe(true);

    const scoreBody = {
      machineId: def.machineId,
      score: snap.score,
      passed: snap.passed,
      faults: snap.faultLog.map((f) => ({
        key: f.key,
        reason: f.reason,
        amount: f.amount,
      })),
    };

    const created = await request(server).post("/api/scores").send(scoreBody).expect(201);

    expect(created.body.machineId).toBe(def.machineId);
    expect(created.body.score).toBe(snap.score);
    expect(created.body.passed).toBe(true);
    expect(created.body.faults.length).toBeGreaterThan(0);
    expect(created.body).not.toHaveProperty("student");
    expect(created.body).not.toHaveProperty("name");
    expect(created.body).not.toHaveProperty("studentName");

    const list = await request(server).get("/api/scores").expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
    expect(list.body[0].score).toBe(snap.score);
    expect(list.body[0]).not.toHaveProperty("student");
  }, 30_000);
});
