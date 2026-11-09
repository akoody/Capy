import { Injectable } from '@nestjs/common';
import { GoalsService } from '../goals/goals.service';
import { TasksService } from '../tasks/tasks.service';
import { TransactionCategoriesService } from '../transactions/transaction-categories.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';

export type VoiceUserContext = {
  currency: string;
  categoriesSample: string[];
  today: string;
  yesterday: string;
  dayBeforeYesterday: string;
  openTaskTitles: string[];
  goalTitles: string[];
  categoryCatalog: {
    name: string;
    kind: string;
    description: string | null;
  }[];
};

/** Данные пользователя, которые модель получает для разбора команды. */
@Injectable()
export class VoiceContextService {
  constructor(
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
    private readonly goalsService: GoalsService,
    private readonly tasksService: TasksService,
    private readonly transactionCategoriesService: TransactionCategoriesService,
  ) {}

  async build(userId: string): Promise<VoiceUserContext> {
    let currency = 'RUB';
    const u = await this.usersService.findById(userId);
    if (u?.currency) {
      currency = u.currency;
    }

    const txs = await this.transactionsService.findAllForUser(userId);
    const cats = new Set<string>();
    for (const tx of txs.slice(0, 80)) {
      if (
        (tx.type === 'expense' || tx.type === 'income') &&
        tx.category?.trim()
      ) {
        cats.add(tx.category.trim());
      }
    }
    const categoriesSample = Array.from(cats).slice(0, 25);

    const today = new Date().toISOString().split('T')[0];
    const y = new Date();
    y.setUTCDate(y.getUTCDate() - 1);
    const y2 = new Date();
    y2.setUTCDate(y2.getUTCDate() - 2);
    const yesterday = y.toISOString().split('T')[0];
    const dayBeforeYesterday = y2.toISOString().split('T')[0];

    const openTaskTitles = await this.tasksService.findOpenTitles(userId, 25);
    const goals = await this.goalsService.findAllForUser(userId);
    const goalTitles = goals
      .map((g) => g.name)
      .filter(Boolean)
      .slice(0, 40);
    const categoryCatalog =
      await this.transactionCategoriesService.listForVoiceContext(userId, 60);
    return {
      currency,
      categoriesSample,
      today,
      yesterday,
      dayBeforeYesterday,
      openTaskTitles,
      goalTitles,
      categoryCatalog,
    };
  }
}
