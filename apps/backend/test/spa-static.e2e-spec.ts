import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { AppModule } from "./../src/app.module.js";

/**
 * ServeStaticModule resolves its loader from HttpAdapterHost at provider
 * factory time. NestFactory (not TestingModule) is required so ExpressLoader
 * registers and static + exclude behavior can be asserted.
 */
describe("SPA static + API (e2e)", () => {
  let app: INestApplication;
  let staticRoot: string;
  let prevStaticRoot: string | undefined;

  beforeEach(async () => {
    staticRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lhs-vsts-static-"));
    await fs.writeFile(
      path.join(staticRoot, "index.html"),
      "<!doctype html><title>spa</title><body>spa-ok</body>",
      "utf8",
    );
    await fs.writeFile(path.join(staticRoot, "app.js"), "console.log('ok')", "utf8");

    prevStaticRoot = process.env.STATIC_ROOT;
    process.env.STATIC_ROOT = staticRoot;

    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (prevStaticRoot === undefined) {
      delete process.env.STATIC_ROOT;
    } else {
      process.env.STATIC_ROOT = prevStaticRoot;
    }
    await fs.rm(staticRoot, { recursive: true, force: true });
  });

  it("serves SPA at / and static assets", async () => {
    const index = await request(app.getHttpServer()).get("/").expect(200);
    expect(index.text).toContain("spa-ok");

    const asset = await request(app.getHttpServer()).get("/app.js").expect(200);
    expect(asset.text).toContain("console.log");
  });

  it("keeps /api/* on controllers (not SPA HTML)", async () => {
    await request(app.getHttpServer()).get("/api/health").expect(200).expect({ status: "ok" });

    const missingApi = await request(app.getHttpServer()).get("/api/does-not-exist");
    expect(missingApi.status).toBe(404);
    expect(missingApi.text).not.toContain("spa-ok");
  });

  it("falls back to index.html for unknown non-API paths", async () => {
    const res = await request(app.getHttpServer()).get("/unknown-client-route").expect(200);
    expect(res.text).toContain("spa-ok");
  });
});
