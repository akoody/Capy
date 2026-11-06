import './load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SeederModule } from './seeder.module';
import { AcademySeeder } from './academy/seeder';
import { AllExceptionsFilter } from './all-exceptions.filter';
import type { NextFunction, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from './config/env.schema';

async function bootstrap() {
  if (process.argv.includes('seed')) {
    const appContext = await NestFactory.createApplicationContext(SeederModule);
    const seeder = appContext.get(AcademySeeder);
    await seeder.seed();
    await appContext.close();
    return;
  }

  const app = await NestFactory.create(AppModule);

  const httpLogger = new Logger('HTTP');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    res.on('finish', () => {
      httpLogger.log(
        `${req.method} ${req.originalUrl} → ${res.statusCode} (+${Date.now() - started}ms)`,
      );
    });
    next();
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  const config = app.get<ConfigService<AppEnv, true>>(ConfigService);
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  console.log(`NestJS backend (MongoDB) is running on http://localhost:${port}`);
}
void bootstrap();
