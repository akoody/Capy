import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccountThrottlerGuard } from './auth/account-throttler.guard';
import { HealthController } from './health/health.controller';
import { LoggingModule } from './observability/logging.module';
import type { AppEnv } from './config/env.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appEnvSchema, createEnvValidator } from './config/env.schema';
import { UsersModule } from './users/users.module';
import { GoalsModule } from './goals/goals.module';
import { TipsModule } from './tips/tips.module';
import { AchievementsModule } from './achievements/achievements.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AcademyModule } from './academy/academy.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GamificationModule } from './gamification/gamification.module';
import { FriendsModule } from './friends/friends.module';
import { PiggyBankModule } from './piggy-bank/piggy-bank.module';
import { TelegramAuthGuard } from './auth/telegram-auth.guard';
import { ACCOUNT_RESOLVER } from './auth/current-account';
import { UsersService } from './users/users.service';
import { AuthModule } from './auth/auth.module';
import { JournalModule } from './journal/journal.module';
import { AssistantModule } from './assistant/assistant.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: createEnvValidator(appEnvSchema),
    }),
    LoggingModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => [
        {
          ttl: config.get('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
      ],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    GoalsModule,
    TipsModule,
    AchievementsModule,
    TransactionsModule,
    AcademyModule,
    BudgetsModule,
    GamificationModule,
    FriendsModule,
    PiggyBankModule,
    AuthModule,
    JournalModule,
    AssistantModule,
    TasksModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: ACCOUNT_RESOLVER, useExisting: UsersService },
    // Порядок важен: лимит считается по аккаунту, который определяет guard подписи.
    { provide: APP_GUARD, useClass: TelegramAuthGuard },
    { provide: APP_GUARD, useClass: AccountThrottlerGuard },
  ],
})
export class AppModule {}
