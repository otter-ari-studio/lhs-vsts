import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { BadRequestException, Injectable } from "@nestjs/common";

import { defaultDataRoot } from "../machines/machines.service.js";
import type { ScoreRecord, SubmitScoreBody } from "./score.types.js";

@Injectable()
export class ScoresService {
  private readonly scoresPath: string;

  constructor() {
    const root = process.env.DATA_DIR ?? defaultDataRoot();
    this.scoresPath = path.join(root, "runtime", "scores.json");
  }

  async list(): Promise<ScoreRecord[]> {
    return this.readAll();
  }

  async append(body: unknown): Promise<ScoreRecord> {
    const input = this.parseBody(body);
    const record: ScoreRecord = {
      id: randomUUID(),
      machineId: input.machineId,
      score: input.score,
      passed: input.passed,
      faults: input.faults,
      finishedAt: new Date().toISOString(),
    };
    const all = await this.readAll();
    all.push(record);
    await fs.mkdir(path.dirname(this.scoresPath), { recursive: true });
    await fs.writeFile(this.scoresPath, `${JSON.stringify(all, null, 2)}\n`, "utf8");
    return record;
  }

  private async readAll(): Promise<ScoreRecord[]> {
    try {
      const raw = await fs.readFile(this.scoresPath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as ScoreRecord[];
    } catch {
      return [];
    }
  }

  private parseBody(body: unknown): SubmitScoreBody {
    if (!body || typeof body !== "object") {
      throw new BadRequestException("Score body must be an object");
    }
    const o = body as Record<string, unknown>;
    if (typeof o.machineId !== "string" || !o.machineId) {
      throw new BadRequestException("machineId is required");
    }
    if (typeof o.score !== "number" || !Number.isFinite(o.score)) {
      throw new BadRequestException("score must be a number");
    }
    if (typeof o.passed !== "boolean") {
      throw new BadRequestException("passed must be a boolean");
    }
    if (!Array.isArray(o.faults)) {
      throw new BadRequestException("faults must be an array");
    }
    const faults = o.faults.map((f, i) => {
      if (!f || typeof f !== "object") {
        throw new BadRequestException(`faults[${i}] must be an object`);
      }
      const fault = f as Record<string, unknown>;
      if (typeof fault.key !== "string") {
        throw new BadRequestException(`faults[${i}].key must be a string`);
      }
      if (typeof fault.reason !== "string") {
        throw new BadRequestException(`faults[${i}].reason must be a string`);
      }
      if (typeof fault.amount !== "number" || !Number.isFinite(fault.amount)) {
        throw new BadRequestException(`faults[${i}].amount must be a number`);
      }
      return {
        key: fault.key,
        reason: fault.reason,
        amount: fault.amount,
      };
    });
    return {
      machineId: o.machineId,
      score: o.score,
      passed: o.passed,
      faults,
    };
  }
}
