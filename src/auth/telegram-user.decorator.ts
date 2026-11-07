import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './current-account';
import type { TelegramUserPayload } from './telegram-init-data';

/** Пользователь Telegram, проверенный TelegramAuthGuard. */
export const TelegramUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TelegramUserPayload =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().telegramUser,
);
