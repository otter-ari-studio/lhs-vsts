import { existsSync } from "node:fs";
import { join } from "node:path";

import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { MachinesModule } from "./machines/machines.module.js";
import { ScoresModule } from "./scores/scores.module.js";

function resolveStaticRoot(): string {
  if (process.env.STATIC_ROOT) {
    return process.env.STATIC_ROOT;
  }
  // start:docker / Docker: cwd is monorepo root; nest start:dev: cwd is apps/backend
  const fromRepoRoot = join(process.cwd(), "apps/backend/public");
  const fromPackage = join(process.cwd(), "public");
  if (existsSync(fromRepoRoot)) {
    return fromRepoRoot;
  }
  if (existsSync(fromPackage)) {
    return fromPackage;
  }
  return fromRepoRoot;
}

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: resolveStaticRoot(),
      exclude: ["/api*"],
    }),
    MachinesModule,
    ScoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
