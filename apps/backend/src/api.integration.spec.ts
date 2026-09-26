import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_SRC = path.resolve(
  __dirname,
  '../data/seed/range_hood_generic.json',
);

describe('Machines and Scores API', () => {
  let app: INestApplication;
  let dataDir: string;
  let prevDataDir: string | undefined;

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lhs-vsts-data-'));
    await fs.mkdir(path.join(dataDir, 'seed'), { recursive: true });
    await fs.mkdir(path.join(dataDir, 'runtime'), { recursive: true });
    await fs.copyFile(
      SEED_SRC,
      path.join(dataDir, 'seed', 'range_hood_generic.json'),
    );

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

  it('GET /api/machines/current returns seed machine', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/machines/current')
      .expect(200);
    expect(res.body.machineId).toBe('range_hood_generic');
    expect(res.body.displayName).toContain('油烟机');
  });

  it(
    'rejects invalid machine JSON on PUT',
    async () => {
      const res = await request(app.getHttpServer())
        .put('/api/machines/current')
        .send({ machineId: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/MachineDef|parts/i);
    },
    10_000,
  );

  it('PUT then GET returns updated machine', async () => {
    const current = await request(app.getHttpServer())
      .get('/api/machines/current')
      .expect(200);
    const updated = {
      ...current.body,
      displayName: '改名油烟机',
      scoring: {
        ...current.body.scoring,
        deductIllegalOrder: 9,
      },
    };
    await request(app.getHttpServer())
      .put('/api/machines/current')
      .send(updated)
      .expect(200);

    const again = await request(app.getHttpServer())
      .get('/api/machines/current')
      .expect(200);
    expect(again.body.displayName).toBe('改名油烟机');
    expect(again.body.scoring.deductIllegalOrder).toBe(9);
  });

  it('POST score then GET lists it without student fields', async () => {
    const payload = {
      machineId: 'range_hood_generic',
      score: 85,
      passed: false,
      faults: [{ key: 'illegal', reason: '顺序错误', amount: 5 }],
    };
    const created = await request(app.getHttpServer())
      .post('/api/scores')
      .send(payload)
      .expect(201);

    expect(created.body.id).toBeTruthy();
    expect(created.body.machineId).toBe('range_hood_generic');
    expect(created.body.score).toBe(85);
    expect(created.body.passed).toBe(false);
    expect(created.body.faults).toEqual(payload.faults);
    expect(created.body.finishedAt).toBeTruthy();
    expect(created.body).not.toHaveProperty('student');
    expect(created.body).not.toHaveProperty('name');
    expect(created.body).not.toHaveProperty('studentName');

    const list = await request(app.getHttpServer())
      .get('/api/scores')
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
    expect(list.body[0]).not.toHaveProperty('student');
    expect(list.body[0]).not.toHaveProperty('name');
  });
});
