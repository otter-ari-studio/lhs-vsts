import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";

function resolveCorsOrigin(): string | string[] | undefined {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (raw) {
    const origins = raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    return origins.length <= 1 ? origins[0] : origins;
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  return undefined;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = resolveCorsOrigin();
  if (corsOrigin !== undefined) {
    app.enableCors({ origin: corsOrigin });
  }
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
