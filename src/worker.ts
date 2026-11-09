import './load-env';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const worker = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  const logger = worker.get(Logger);
  worker.useLogger(logger);
  worker.enableShutdownHooks();
  logger.log('Background worker started', 'Worker');
}

void bootstrap();
