import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Public, TelegramAuthGuard } from './telegram-auth.guard';
import { TelegramUser } from './telegram-user.decorator';
import { ACCOUNT_RESOLVER, CurrentUserId } from './current-account';
import type { TelegramUserPayload } from './telegram-init-data';
import {
  buildInitData,
  TEST_BOT_TOKEN,
  TEST_USER,
} from './testing/sign-init-data';

@Controller()
class ProbeController {
  @Get('me')
  me(@TelegramUser() user: TelegramUserPayload) {
    return user;
  }

  @Get('account')
  account(@CurrentUserId() userId: string) {
    return { userId };
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

describe('TelegramAuthGuard (HTTP)', () => {
  let app: INestApplication<App>;
  const resolveAccountId = jest.fn((user: TelegramUserPayload) =>
    Promise.resolve(`account-${user.id}`),
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [
            () => ({
              TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
              TELEGRAM_AUTH_MAX_AGE_SECONDS: 3600,
            }),
          ],
        }),
      ],
      controllers: [ProbeController],
      providers: [
        { provide: ACCOUNT_RESOLVER, useValue: { resolveAccountId } },
        { provide: APP_GUARD, useClass: TelegramAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => resolveAccountId.mockClear());

  const auth = (initData: string) => ({ Authorization: `tma ${initData}` });

  it('passes the verified Telegram user to the handler', async () => {
    const initData = buildInitData({ botToken: TEST_BOT_TOKEN });
    await request(app.getHttpServer())
      .get('/me')
      .set(auth(initData))
      .expect(200, TEST_USER);
  });

  it('resolves the Capy account for the verified user', async () => {
    const initData = buildInitData({ botToken: TEST_BOT_TOKEN });
    await request(app.getHttpServer())
      .get('/account')
      .set(auth(initData))
      .expect(200, { userId: `account-${TEST_USER.id}` });
    expect(resolveAccountId).toHaveBeenCalledWith(TEST_USER);
  });

  it('does not touch accounts when the signature is invalid', async () => {
    const forged = buildInitData({ botToken: '1:other' });
    await request(app.getHttpServer())
      .get('/account')
      .set(auth(forged))
      .expect(403);
    expect(resolveAccountId).not.toHaveBeenCalled();
  });

  it('returns 401 without the tma header', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
    await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', 'Bearer x')
      .expect(401);
  });

  it('returns 403 for a forged signature', async () => {
    const forged = buildInitData({ botToken: '1:other' });
    await request(app.getHttpServer()).get('/me').set(auth(forged)).expect(403);
  });

  it('returns 401 for expired init data so the client can reopen the app', async () => {
    const old = buildInitData({
      botToken: TEST_BOT_TOKEN,
      authDate: new Date(Date.now() - 2 * 3600 * 1000),
    });
    await request(app.getHttpServer()).get('/me').set(auth(old)).expect(401);
  });

  it('skips authentication for @Public() routes', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
