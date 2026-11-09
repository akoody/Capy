/** Эксплуатация: health-check, заголовки безопасности, лимиты, документация. */
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AchievementsService } from '../src/achievements/achievements.service';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { buildInitData } from '../src/auth/testing/sign-init-data';

describe('Operations (e2e)', () => {
  let app: INestApplication<App>;

  const http = () => request(app.getHttpServer());
  const auth = {
    Authorization: `tma ${buildInitData({
      botToken: process.env.TELEGRAM_BOT_TOKEN as string,
      user: { id: 3001, first_name: 'Ops' },
    })}`,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.get<Connection>(getConnectionToken()).dropDatabase();
    await app.close();
  });

  it('reports liveness and readiness without auth', async () => {
    await http().get('/health').expect(200, { status: 'ok' });
    await http().get('/ready').expect(200, { status: 'ready' });
  });

  it('sets security headers and a request id', async () => {
    const res = await http().get('/health').set('x-request-id', 'trace-1');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toBe('trace-1');

    const generated = await http().get('/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('applies the rate limit to authenticated requests', async () => {
    const res = await http().get('/users/me').set(auth).expect(200);
    expect(res.headers['x-ratelimit-limit']).toBe('100000');
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeLessThan(100000);
  });

  it('does not mistake missing auth for a rate limit', async () => {
    await http().get('/users/me').expect(401);
  });

  it('survives several processes seeding at once', async () => {
    const achievements = app.get(AchievementsService);
    await app
      .get<Connection>(getConnectionToken())
      .collection('achievements')
      .deleteMany({});

    await Promise.all(
      Array.from({ length: 8 }, () => achievements.onModuleInit()),
    );

    const stored = await achievements.findOneByKey('MARATHONER');
    expect(stored?.key).toBe('MARATHONER');
  });

  it('publishes an OpenAPI document when docs are enabled', async () => {
    const res = await http().get('/docs-json').expect(200);
    const spec = res.body as { paths: Record<string, unknown> };
    expect(spec.paths).toHaveProperty('/users/me');
    expect(spec.paths).toHaveProperty('/transactions');
  });
});
