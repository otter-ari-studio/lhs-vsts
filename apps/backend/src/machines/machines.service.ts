import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMachineDef, type MachineDef } from '@lhs-vsts/machine';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolve default data root: apps/backend/data */
export function defaultDataRoot(): string {
  // dist/machines/machines.service.js → ../../data
  return path.resolve(__dirname, '../../data');
}

@Injectable()
export class MachinesService {
  private readonly seedPath: string;
  private readonly runtimePath: string;

  constructor() {
    const root = process.env.DATA_DIR ?? defaultDataRoot();
    this.seedPath = path.join(root, 'seed', 'range_hood_generic.json');
    this.runtimePath = path.join(root, 'runtime', 'machine.json');
  }

  async getCurrent(): Promise<MachineDef> {
    await this.ensureRuntimeFromSeed();
    const raw = JSON.parse(await fs.readFile(this.runtimePath, 'utf8')) as unknown;
    return parseMachineDef(raw);
  }

  async putCurrent(body: unknown): Promise<MachineDef> {
    let def: MachineDef;
    try {
      def = parseMachineDef(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(message);
    }
    await fs.mkdir(path.dirname(this.runtimePath), { recursive: true });
    await fs.writeFile(
      this.runtimePath,
      `${JSON.stringify(def, null, 2)}\n`,
      'utf8',
    );
    return def;
  }

  private async ensureRuntimeFromSeed(): Promise<void> {
    try {
      await fs.access(this.runtimePath);
    } catch {
      await fs.mkdir(path.dirname(this.runtimePath), { recursive: true });
      const seed = await fs.readFile(this.seedPath, 'utf8');
      // Validate seed before copying
      parseMachineDef(JSON.parse(seed) as unknown);
      await fs.writeFile(this.runtimePath, seed, 'utf8');
    }
  }
}
