import { signInitData } from '../telegram-init-data';

export interface InitDataFixture {
  botToken: string;
  authDate?: Date;
  user?: Record<string, unknown> | string | null;
  extra?: Record<string, string>;
}

export const TEST_BOT_TOKEN = '123456:TEST-bot-token';
export const TEST_USER = { id: 42, first_name: 'Ada', username: 'ada' };

/** Собирает initData так же, как это делает клиент Telegram. Только для тестов. */
export function buildInitData({
  botToken,
  authDate = new Date(),
  user = TEST_USER,
  extra = {},
}: InitDataFixture): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(authDate.getTime() / 1000)),
    query_id: 'AAH-test',
    ...extra,
  });
  if (user !== null) {
    params.set('user', typeof user === 'string' ? user : JSON.stringify(user));
  }
  params.set('hash', signInitData(params, botToken).toString('hex'));
  return params.toString();
}
