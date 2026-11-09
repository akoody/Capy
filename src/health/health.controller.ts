import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { Public } from '../auth/telegram-auth.guard';

@Public()
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /** Процесс жив: не зависит от внешних сервисов. */
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /** Процесс готов принимать запросы: база отвечает. */
  @Get('ready')
  async ready() {
    try {
      const { db } = this.connection;
      if (!db) {
        throw new Error('not connected');
      }
      await db.admin().ping();
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
    return { status: 'ready' };
  }
}
