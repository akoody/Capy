import './load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const worker = await NestFactory.createApplicationContext(WorkerModule);
  worker.enableShutdownHooks();
  new Logger('Worker').log('Background worker started');
}

void bootstrap();
