import { Module, forwardRef } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { UsersModule } from '../users/users.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { PiggyBankModule } from '../piggy-bank/piggy-bank.module';
import { GoalsModule } from '../goals/goals.module';
import { TasksModule } from '../tasks/tasks.module';
import { JournalModule } from '../journal/journal.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    LlmModule,
    UsersModule,
    forwardRef(() => TransactionsModule),
    PiggyBankModule,
    GoalsModule,
    TasksModule,
    JournalModule,
    BudgetsModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
