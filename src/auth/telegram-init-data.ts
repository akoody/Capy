import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';

/**
 * Проверка initData Telegram Mini App.
 * Алгоритм: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Функция чистая (время передаётся снаружи), поэтому тестируется без моков.
 */

export const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  photo_url: z.string().optional(),
});

export type TelegramUserPayload = z.infer<typeof telegramUserSchema>;

export type InitDataFailure =
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'missing_user';

export type InitDataResult =
  | { ok: true; user: TelegramUserPayload; authDate: Date }
  | { ok: false; reason: InitDataFailure };

export interface VerifyInitDataOptions {
  botToken: string;
  /** Сколько секунд initData считается действительной после auth_date. */
  maxAgeSeconds: number;
  now?: Date;
}

/** Допуск на расхождение часов клиента Telegram и сервера. */
const CLOCK_SKEW_SECONDS = 60;
const HASH_HEX_LENGTH = 64;

export function verifyTelegramInitData(
  initData: string,
  { botToken, maxAgeSeconds, now = new Date() }: VerifyInitDataOptions,
): InitDataResult {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]+$/i.test(hash) || hash.length !== HASH_HEX_LENGTH) {
    return { ok: false, reason: 'malformed' };
  }
  params.delete('hash');

  const expected = signInitData(params, botToken);
  if (!timingSafeEqual(Buffer.from(hash.toLowerCase(), 'hex'), expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  // Подпись верна — дальше проверяем только содержимое.
  const authDateSeconds = Number(params.get('auth_date'));
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0) {
    return { ok: false, reason: 'malformed' };
  }
  const ageSeconds = now.getTime() / 1000 - authDateSeconds;
  if (ageSeconds > maxAgeSeconds || ageSeconds < -CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: 'expired' };
  }

  const user = parseUser(params.get('user'));
  if (!user) {
    return { ok: false, reason: 'missing_user' };
  }

  return { ok: true, user, authDate: new Date(authDateSeconds * 1000) };
}

/** HMAC-SHA256 от data-check-string; экспортируется для тестов и локальной отладки. */
export function signInitData(
  params: URLSearchParams,
  botToken: string,
): Buffer {
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  return createHmac('sha256', secretKey).update(dataCheckString).digest();
}

function parseUser(raw: string | null): TelegramUserPayload | null {
  if (!raw) return null;
  try {
    const parsed = telegramUserSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
