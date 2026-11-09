import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { AppEnv } from '../config/env.schema';

/** JSON-логи с request id; секреты из заголовков в них не попадают. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const incoming = req.headers['x-request-id'];
            const id = typeof incoming === 'string' ? incoming : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.query',
          ],
          autoLogging: {
            ignore: (req: IncomingMessage) =>
              req.url === '/health' || req.url === '/ready',
          },
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
})
export class LoggingModule {}
