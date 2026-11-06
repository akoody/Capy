import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { normalizeEnvSecret } from './env-secrets';

@Injectable()
export class TelegramAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TelegramAuthMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('tma ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const initData = authHeader.split(' ')[1];
    const botToken = normalizeEnvSecret(process.env.TELEGRAM_BOT_TOKEN);

    if (!botToken) {
      console.error(
        '[auth] TELEGRAM_BOT_TOKEN is not set — set it in .env on the server and pm2 restart capy-api',
      );
      return res.status(503).json({
        statusCode: 503,
        message:
          'На сервере не задан TELEGRAM_BOT_TOKEN в .env. Добавьте токен бота и перезапустите pm2 (capy-api).',
      });
    }

    const isValid = this.validate(initData, botToken);

    if (!isValid) {
      this.logger.warn(
        'initData HMAC не совпал — проверьте TELEGRAM_BOT_TOKEN (тот же бот, что в BotFather для Mini App) и что в .env нет лишних кавычек/пробелов',
      );
      return res.status(403).json({ message: 'Forbidden: Invalid Telegram data' });
    }

    const params = new URLSearchParams(initData);
    const userParam = params.get('user');
    if (!userParam) {
      return res.status(403).json({ message: 'Forbidden: User data not found in initData' });
    }
    const user = JSON.parse(userParam);
    (req as any).user = user;

    next();
  }

  private validate(initData: string, botToken: string): boolean {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const keys: string[] = [];
    for (const key of params.keys()) {
      keys.push(key);
    }
    keys.sort();

    const dataCheckString = keys.map(key => `${key}=${params.get(key)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return hmac === hash;
  }
}
