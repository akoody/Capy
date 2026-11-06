import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import {
  TransactionCategory,
  TransactionCategorySchema,
} from './schemas/transaction-category.schema';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionCategoriesService } from './transaction-categories.service';
import { TransactionCategoriesController } from './transaction-categories.controller';

import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: TransactionCategory.name, schema: TransactionCategorySchema },
    ]),
    forwardRef(() => UsersModule),
  ],
  controllers: [TransactionsController, TransactionCategoriesController],
  providers: [TransactionsService, TransactionCategoriesService],
  exports: [TransactionsService, TransactionCategoriesService],
})
export class TransactionsModule {}
