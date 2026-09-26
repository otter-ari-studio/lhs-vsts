import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppModule } from "./app.module.js";
import { defaultDataRoot } from "./machines/machines.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_SRC = path.resolve(__dirname, "../data/seed/range_hood_generic.json");

describe("Machines and Scores API", () => {
  let app: INestApplication;
  let dataDir: string;
  let prevDataDir: string | undefined;

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "lhs-vsts-data-"));
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

  it("GET /api/machines/current returns seed machine", async () => {
    const res = await request(app.getHttpServer()).get("/api/machines/current").expect(200);
    expect(res.body.machineId).toBe("range_hood_generic");
    expect(res.body.displayName).toContain("油烟机");
  });

  it("GET copies seed into runtime when missing", async () => {
    await request(app.getHttpServer()).get("/api/machines/current").expect(200);
    const runtime = path.join(dataDir, "runtime", "machine.json");
    const raw = await fs.readFile(runtime, "utf8");
    expect(JSON.parse(raw).machineId).toBe("range_hood_generic");
  });

  it("rejects invalid machine JSON on PUT", async () => {
    const res = await request(app.getHttpServer())
      .put("/api/machines/current")
      .send({ machineId: "x" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/MachineDef|parts/i);
  }, 10_000);

  it("PUT then GET returns updated machine", async () => {
    const current = await request(app.getHttpServer()).get("/api/machines/current").expect(200);
    const updated = {
      ...current.body,
      displayName: "改名油烟机",
      scoring: {
        ...current.body.scoring,
        deductIllegalOrder: 9,
      },
    };
    await request(app.getHttpServer()).put("/api/machines/current").send(updated).expect(200);

    const again = await request(app.getHttpServer()).get("/api/machines/current").expect(200);
    expect(again.body.displayName).toBe("改名油烟机");
    expect(again.body.scoring.deductIllegalOrder).toBe(9);
  });

  it("POST score then GET lists it without student fields", async () => {
    const payload = {
      machineId: "range_hood_generic",
      score: 85,
      passed: false,
      faults: [{ key: "illegal", reason: "顺序错误", amount: 5 }],
    };
    const created = await request(app.getHttpServer())
      .post("/api/scores")
      .send(payload)
      .expect(201);

    expect(created.body.id).toBeTruthy();
    expect(created.body.machineId).toBe("range_hood_generic");
    expect(created.body.score).toBe(85);
    expect(created.body.passed).toBe(false);
    expect(created.body.faults).toEqual(payload.faults);
    expect(created.body.finishedAt).toBeTruthy();
    expect(created.body).not.toHaveProperty("student");
    expect(created.body).not.toHaveProperty("name");
    expect(created.body).not.toHaveProperty("studentName");

    const list = await request(app.getHttpServer()).get("/api/scores").expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
    expect(list.body[0]).not.toHaveProperty("student");
    expect(list.body[0]).not.toHaveProperty("name");
  });

  it("GET /api/scores returns [] for missing, corrupt, or non-array files", async () => {
    const empty = await request(app.getHttpServer()).get("/api/scores").expect(200);
    expect(empty.body).toEqual([]);

    const scoresPath = path.join(dataDir, "runtime", "scores.json");
    await fs.writeFile(scoresPath, "{not-json", "utf8");
    const corrupt = await request(app.getHttpServer()).get("/api/scores").expect(200);
    expect(corrupt.body).toEqual([]);

    await fs.writeFile(scoresPath, '{"not":"array"}\n', "utf8");
    const nonArray = await request(app.getHttpServer()).get("/api/scores").expect(200);
    expect(nonArray.body).toEqual([]);
  });

  it("rejects invalid score bodies", async () => {
    const cases: { body: unknown; match: RegExp }[] = [
      { body: {}, match: /machineId/i },
      { body: { machineId: "" }, match: /machineId/i },
      { body: { machineId: "m", score: "1" }, match: /score/i },
      { body: { machineId: "m", score: Number.NaN }, match: /score/i },
      { body: { machineId: "m", score: 1, passed: "yes" }, match: /passed/i },
      { body: { machineId: "m", score: 1, passed: true }, match: /faults/i },
      {
        body: { machineId: "m", score: 1, passed: true, faults: [null] },
        match: /faults\[0\] must be an object/i,
      },
      {
        body: {
          machineId: "m",
          score: 1,
          passed: true,
          faults: [{ reason: "r", amount: 1 }],
        },
        match: /faults\[0\]\.key/i,
      },
      {
        body: {
          machineId: "m",
          score: 1,
          passed: true,
          faults: [{ key: "k", amount: 1 }],
        },
        match: /faults\[0\]\.reason/i,
      },
      {
        body: {
          machineId: "m",
          score: 1,
          passed: true,
          faults: [{ key: "k", reason: "r", amount: "x" }],
        },
        match: /faults\[0\]\.amount/i,
      },
    ];

    for (const { body, match } of cases) {
      const res = await request(app.getHttpServer()).post("/api/scores").send(body);
      expect(res.status).toBe(400);
      expect(String(res.body.message)).toMatch(match);
    }
  });
});

describe("defaultDataRoot", () => {
  it("resolves under apps/backend/data", () => {
    const root = defaultDataRoot();
    expect(root.replace(/\\/g, "/")).toMatch(/\/data$/);
  });
});

describe("ScoresService.parseBody edge", () => {
  it("rejects non-object body via service", async () => {
    const { ScoresService } = await import("./scores/scores.service.js");
    const prev = process.env.DATA_DIR;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lhs-score-"));
    process.env.DATA_DIR = dir;
    try {
      const svc = new ScoresService();
      await expect(svc.append(null)).rejects.toThrow(/object/i);
      await expect(svc.append("x")).rejects.toThrow(/object/i);
    } finally {
      if (prev === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = prev;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
