import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PiggyBank, PiggyBankSchema } from './schemas/piggy-bank.schema';
import { PiggyBankController } from './piggy-bank.controller';
import { PiggyBankService } from './piggy-bank.service';
import { UsersModule } from '../users/users.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    LlmModule,
    MongooseModule.forFeature([
      { name: PiggyBank.name, schema: PiggyBankSchema },
    ]),
    UsersModule,
    forwardRef(() => TransactionsModule),
  ],
  controllers: [PiggyBankController],
  providers: [PiggyBankService],
  exports: [PiggyBankService],
})
export class PiggyBankModule {}
