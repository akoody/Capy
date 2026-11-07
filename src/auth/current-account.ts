import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { TelegramUserPayload } from './telegram-init-data';

/** Аккаунт Capy, к которому привязан проверенный пользователь Telegram. */
export interface CurrentAccount {
  /** Mongo _id пользователя: единственный источник владельца данных. */
  userId: string;
  telegramId: number;
}

export interface AuthenticatedRequest extends Request {
  telegramUser: TelegramUserPayload;
  account: CurrentAccount;
}

/** Порт, через который guard находит или создаёт аккаунт. Реализует UsersService. */
export interface AccountResolver {
  resolveAccountId(telegramUser: TelegramUserPayload): Promise<string>;
}

export const ACCOUNT_RESOLVER = Symbol('ACCOUNT_RESOLVER');

/**
 * Id владельца для запроса. Контроллеры берут пользователя только отсюда,
 * id из query, body или params для этого не используется.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().account.userId,
);
