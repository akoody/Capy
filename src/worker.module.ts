import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { appEnvSchema, createEnvValidator } from './config/env.schema';
import { LoggingModule } from './observability/logging.module';
import { TasksReminderScheduler } from './tasks/tasks-reminder.scheduler';
import { TasksModule } from './tasks/tasks.module';
import { TelegramModule } from './telegram/telegram.module';

/** Фоновые задачи. Запускается отдельно от API, см. src/worker.ts. */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: createEnvValidator(appEnvSchema),
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    LoggingModule,
    TasksModule,
    TelegramModule,
  ],
  providers: [TasksReminderScheduler],
})
export class WorkerModule {}
