import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './all-exceptions.filter';
import type { AppEnv } from './config/env.schema';

/** Настройка HTTP-приложения: общая для запуска и тестов. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<AppEnv, true>>(ConfigService);

  app.useLogger(app.get(Logger));
  // nginx стоит перед API: адрес клиента берётся из X-Forwarded-For.
  (app as NestExpressApplication).set('trust proxy', 1);
  app.use(helmet());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins });
  }

  if (config.get('DOCS_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Capy API')
        .setDescription('API Telegram Mini App для личных финансов')
        .setVersion('1.0')
        .addApiKey(
          {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'tma <initData>',
          },
          'telegram',
        )
        .addSecurityRequirements('telegram')
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}
