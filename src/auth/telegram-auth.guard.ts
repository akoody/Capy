import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AppEnv } from '../config/env.schema';
import {
  TelegramUserPayload,
  verifyTelegramInitData,
} from './telegram-init-data';

export const IS_PUBLIC_KEY = 'capy:isPublic';
/** Маршрут без авторизации (health-check и т. п.). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export interface AuthenticatedRequest extends Request {
  telegramUser: TelegramUserPayload;
}

const SCHEME = 'tma ';

/**
 * Глобальный guard: каждый запрос должен нести `Authorization: tma <initData>`
 * с подписью бота из TELEGRAM_BOT_TOKEN.
 */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');
    if (!header?.startsWith(SCHEME) || header.length === SCHEME.length) {
      throw new UnauthorizedException('Missing Telegram init data');
    }

    const result = verifyTelegramInitData(header.slice(SCHEME.length), {
      botToken: this.config.get('TELEGRAM_BOT_TOKEN', { infer: true }),
      maxAgeSeconds: this.config.get('TELEGRAM_AUTH_MAX_AGE_SECONDS', {
        infer: true,
      }),
    });

    if (!result.ok) {
      this.logger.warn(
        `Rejected init data: ${result.reason} (${request.method} ${request.originalUrl})`,
      );
      if (result.reason === 'expired') {
        throw new UnauthorizedException('Telegram init data expired');
      }
      throw new ForbiddenException('Invalid Telegram init data');
    }

    request.telegramUser = result.user;
    return true;
  }
}
