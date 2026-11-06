import { verifyTelegramInitData } from './telegram-init-data';
import {
  buildInitData,
  TEST_BOT_TOKEN,
  TEST_USER,
} from './testing/sign-init-data';

const now = new Date('2026-11-07T12:00:00Z');
const options = { botToken: TEST_BOT_TOKEN, maxAgeSeconds: 3600, now };
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe('verifyTelegramInitData', () => {
  it('accepts data signed by the bot and returns the user', () => {
    const initData = buildInitData({
      botToken: TEST_BOT_TOKEN,
      authDate: minutesAgo(5),
    });
    const result = verifyTelegramInitData(initData, options);
    expect(result).toEqual({
      ok: true,
      user: TEST_USER,
      authDate: new Date(Math.floor(minutesAgo(5).getTime() / 1000) * 1000),
    });
  });

  it('rejects data signed by another bot', () => {
    const initData = buildInitData({
      botToken: '999:another-bot',
      authDate: minutesAgo(1),
    });
    expect(verifyTelegramInitData(initData, options)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects tampered user data', () => {
    const initData = buildInitData({
      botToken: TEST_BOT_TOKEN,
      authDate: minutesAgo(1),
    });
    const tampered = new URLSearchParams(initData);
    tampered.set('user', JSON.stringify({ ...TEST_USER, id: 1 }));
    expect(verifyTelegramInitData(tampered.toString(), options)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects data older than maxAgeSeconds (replay)', () => {
    const initData = buildInitData({
      botToken: TEST_BOT_TOKEN,
      authDate: minutesAgo(61),
    });
    expect(verifyTelegramInitData(initData, options)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('rejects auth_date far in the future', () => {
    const initData = buildInitData({
      botToken: TEST_BOT_TOKEN,
      authDate: minutesAgo(-10),
    });
    expect(verifyTelegramInitData(initData, options)).toMatchObject({
      reason: 'expired',
    });
  });

  it('tolerates small clock skew', () => {
    const initData = buildInitData({
      botToken: TEST_BOT_TOKEN,
      authDate: new Date(now.getTime() + 30_000),
    });
    expect(verifyTelegramInitData(initData, options).ok).toBe(true);
  });

  it.each(['', 'hash=', 'auth_date=1&hash=zz', 'hash=' + 'a'.repeat(63)])(
    'treats %p as malformed',
    (initData) => {
      expect(verifyTelegramInitData(initData, options)).toEqual({
        ok: false,
        reason: 'malformed',
      });
    },
  );

  it('rejects signed data without a valid user', () => {
    for (const user of [null, '{not json', { first_name: 'No id' }]) {
      const initData = buildInitData({
        botToken: TEST_BOT_TOKEN,
        authDate: minutesAgo(1),
        user,
      });
      expect(verifyTelegramInitData(initData, options)).toEqual({
        ok: false,
        reason: 'missing_user',
      });
    }
  });

  it('signs keys in key order, not in "key=value" string order', () => {
    // "a" < "a1" по ключу, но "a1=…" < "a=…" как строки: проверяем, что порядок по ключу.
    const initData = buildInitData({
      botToken: TEST_BOT_TOKEN,
      authDate: minutesAgo(1),
      extra: { a: 'x', a1: 'y' },
    });
    expect(verifyTelegramInitData(initData, options).ok).toBe(true);
  });
});
