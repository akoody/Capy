import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { AnalysisRequest, AnalysisRequestSchema } from './schemas/analysis-request.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AchievementsModule } from '../achievements/achievements.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { GoalsModule } from '../goals/goals.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AnalysisRequest.name, schema: AnalysisRequestSchema },
    ]),
    AchievementsModule,
    forwardRef(() => TransactionsModule),
    forwardRef(() => GoalsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export UsersService
})
export class UsersModule {}
