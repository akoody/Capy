import './load-env';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AcademySeeder } from './academy/seeder';
import { configureApp } from './app.setup';
import type { AppEnv } from './config/env.schema';
import { SeederModule } from './seeder.module';

async function bootstrap() {
  if (process.argv.includes('seed')) {
    const context = await NestFactory.createApplicationContext(SeederModule);
    await context.get(AcademySeeder).seed();
    await context.close();
    return;
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  app.enableShutdownHooks();

  const config = app.get<ConfigService<AppEnv, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
