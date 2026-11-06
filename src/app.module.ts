import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { TelegramAuthMiddleware } from './telegram-auth.middleware';
import { AuthModule } from './auth/auth.module';
import { JournalModule } from './journal/journal.module';
import { AssistantModule } from './assistant/assistant.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
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
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TelegramAuthMiddleware).forRoutes('*');
  }
}
