import { BadRequestException, Injectable } from '@nestjs/common';
import { BudgetsService } from '../budgets/budgets.service';
import { GoalsService } from '../goals/goals.service';
import { JournalService } from '../journal/journal.service';
import { PiggyBankService } from '../piggy-bank/piggy-bank.service';
import { TasksService } from '../tasks/tasks.service';
import { TransactionCategoriesService } from '../transactions/transaction-categories.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import type {
  VoiceIntent,
  VoiceInterpretResult,
  VoiceTransactionDeleteMode,
} from './voice-intent.types';

export interface VoiceExecutionResult {
  message: string;
  transactionId?: string;
}

type IntentHandler = (
  p: VoiceInterpretResult,
  userId: string,
) => Promise<VoiceExecutionResult>;

const voiceDate = (p: VoiceInterpretResult) =>
  p.date || new Date().toISOString().split('T')[0];

function requirePositiveAmount(p: VoiceInterpretResult): number {
  if (p.amount == null || p.amount <= 0) {
    throw new BadRequestException('Сумма не указана');
  }
  return p.amount;
}

/** Выполняет разобранные голосовые команды через сервисы предметных модулей. */
@Injectable()
export class VoiceCommandExecutor {
  private readonly handlers: Partial<Record<VoiceIntent, IntentHandler>> = {
    wallet_balance: (p, userId) => this.handleWalletBalance(p, userId),
    journal_create: (p, userId) => this.handleJournalCreate(p, userId),
    budget_create: (p, userId) => this.handleBudgetCreate(p, userId),
    category_create: (p, userId) => this.handleCategoryCreate(p, userId),
    transaction_delete: (p, userId) => this.handleTransactionDelete(p, userId),
    goal_delete: (p, userId) => this.handleGoalDelete(p, userId),
    task_delete: (p, userId) => this.handleTaskDelete(p, userId),
    task_update: (p, userId) => this.handleTaskUpdate(p, userId),
    task_create: (p, userId) => this.handleTaskCreate(p, userId),
    task_complete: (p, userId) => this.handleTaskComplete(p, userId),
    task_cancel: (p, userId) => this.handleTaskCancel(p, userId),
    goal_create: (p, userId) => this.handleGoalCreate(p, userId),
    goal_deposit: (p, userId) => this.handleGoalDeposit(p, userId),
    goal_withdraw: (p, userId) => this.handleGoalWithdraw(p, userId),
    wallet_deposit: (p, userId) => this.handleWalletDeposit(p, userId),
    wallet_withdraw: (p, userId) => this.handleWalletWithdraw(p, userId),
    create_expense: (p, userId) => this.handleCreateExpense(p, userId),
    create_income: (p, userId) => this.handleCreateIncome(p, userId),
  };

  constructor(
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
    private readonly piggyBankService: PiggyBankService,
    private readonly goalsService: GoalsService,
    private readonly tasksService: TasksService,
    private readonly transactionCategoriesService: TransactionCategoriesService,
    private readonly journalService: JournalService,
    private readonly budgetsService: BudgetsService,
  ) {}

  async execute(
    p: VoiceInterpretResult,
    userId: string,
  ): Promise<VoiceExecutionResult> {
    const handler = this.handlers[p.intent];
    if (!handler) {
      throw new BadRequestException('Команда не выполнена');
    }
    return handler(p, userId);
  }

  private async handleWalletBalance(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const user = await this.usersService.findById(userMongoId);
    const cur = user?.currency || 'RUB';
    const pig = await this.piggyBankService.findOneByUser(userMongoId);
    const bal = pig?.amount ?? 0;
    return {
      message: p.reply_hint?.trim() || `На кошельке ${bal} ${cur}`,
    };
  }

  private async handleJournalCreate(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const content = (p.journal_content || p.description || '').trim();
    if (!content) {
      throw new BadRequestException('Пустой текст записи');
    }
    await this.journalService.create(userMongoId, {
      content,
      title: p.journal_title?.trim() || undefined,
      tags: p.journal_tags?.length ? p.journal_tags : undefined,
      date: p.date?.trim() ? `${p.date.trim()}T12:00:00.000Z` : undefined,
    });
    return {
      message: p.reply_hint || 'Запись в дневнике сохранена',
    };
  }

  private async handleBudgetCreate(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const name =
      (p.budget_name || p.description || 'Бюджет').trim() || 'Бюджет';
    const amount = p.amount!;
    const category = p.category!.trim();
    await this.budgetsService.create(userMongoId, {
      name,
      amount,
      category,
      period: p.budget_period!,
    });
    return {
      message:
        p.reply_hint ||
        `Бюджет «${name}»: ${amount} на ${category} (${p.budget_period})`,
    };
  }

  private async handleCategoryCreate(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const name = p.category!.trim();
    await this.transactionCategoriesService.create(userMongoId, {
      name,
      kind: p.category_kind!,
      description: p.description?.trim() || undefined,
    });
    return {
      message: p.reply_hint || `Категория «${name}» добавлена`,
    };
  }

  private async handleTransactionDelete(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const mode = p.delete_mode!;
    const tx = await this.findTransactionForVoiceDelete(userMongoId, mode, {
      amount: p.amount ?? undefined,
      category: p.category ?? undefined,
      description: p.description ?? undefined,
    });
    if (!tx) {
      throw new BadRequestException('Подходящая транзакция не найдена');
    }
    await this.transactionsService.remove(userMongoId, String(tx._id));
    return {
      message:
        p.reply_hint ||
        `Удалено: ${tx.type === 'expense' ? 'расход' : 'доход'} ${tx.amount} (${tx.category})`,
    };
  }

  private async handleGoalDelete(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const hint = (p.goal_name || p.description || '').trim();
    const goal = await this.findGoalByHint(userMongoId, hint);
    if (!goal) {
      throw new BadRequestException('Цель не найдена');
    }
    await this.goalsService.remove(userMongoId, String(goal._id));
    return {
      message: p.reply_hint || `Цель «${goal.name}» удалена`,
    };
  }

  private async handleTaskDelete(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const hint = (p.task_title || p.description || '').trim();
    const task = await this.tasksService.findOpenByTitleHint(userMongoId, hint);
    if (!task) {
      throw new BadRequestException('Активная задача не найдена');
    }
    await this.tasksService.remove(userMongoId, String(task._id));
    return {
      message: p.reply_hint || `Задача «${task.title}» удалена`,
    };
  }

  private async handleTaskUpdate(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const hint = (p.task_title || p.description || '').trim();
    const task = await this.tasksService.findOpenByTitleHint(userMongoId, hint);
    if (!task) {
      throw new BadRequestException('Активная задача не найдена');
    }
    const fires: string[] = [];
    if (p.reminder_at?.trim()) fires.push(p.reminder_at.trim());
    if (p.reminder_times?.length) {
      for (const x of p.reminder_times) {
        const s = String(x).trim();
        if (s && !fires.includes(s)) fires.push(s);
      }
    }
    await this.tasksService.update(userMongoId, String(task._id), {
      title: p.new_task_title?.trim() || undefined,
      priority: p.priority ?? undefined,
      dueAt: p.date?.trim() ? `${p.date.trim()}T12:00:00.000Z` : undefined,
      reminderFireTimes: fires.length > 0 ? fires : undefined,
    });
    return {
      message: p.reply_hint || `Задача «${task.title}» обновлена`,
    };
  }

  private async handleTaskCreate(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const title = (p.task_title || p.description || '').trim();
    if (!title) {
      throw new BadRequestException('Не указано название задачи');
    }
    const desc =
      p.task_title?.trim() &&
      p.description?.trim() &&
      p.description.trim() !== p.task_title.trim()
        ? p.description.trim()
        : undefined;
    const fires: string[] = [];
    if (p.reminder_at?.trim()) {
      fires.push(p.reminder_at.trim());
    }
    if (p.reminder_times?.length) {
      for (const x of p.reminder_times) {
        const s = String(x).trim();
        if (s && !fires.includes(s)) fires.push(s);
      }
    }
    await this.tasksService.create(userMongoId, {
      title,
      description: desc,
      priority: p.priority ?? undefined,
      dueAt: p.date?.trim() ? `${p.date.trim()}T12:00:00.000Z` : undefined,
      reminderFireTimes: fires.length > 0 ? fires : undefined,
    });
    return {
      message: p.reply_hint || `Задача «${title}» создана`,
    };
  }

  private async handleTaskComplete(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const hint = (p.task_title || p.description || '').trim();
    const task = await this.tasksService.findOpenByTitleHint(userMongoId, hint);
    if (!task) {
      throw new BadRequestException('Активная задача не найдена');
    }
    await this.tasksService.complete(userMongoId, String(task._id));
    return {
      message: p.reply_hint || `Задача «${task.title}» выполнена`,
    };
  }

  private async handleTaskCancel(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const hint = (p.task_title || p.description || '').trim();
    const task = await this.tasksService.findOpenByTitleHint(userMongoId, hint);
    if (!task) {
      throw new BadRequestException('Активная задача не найдена');
    }
    await this.tasksService.update(userMongoId, String(task._id), {
      status: 'cancelled',
    });
    return {
      message: p.reply_hint || `Задача «${task.title}» отменена`,
    };
  }

  private async handleGoalCreate(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const name = (p.goal_name || p.description || '').trim();
    const target = p.amount;
    if (!name || target == null || target <= 0) {
      throw new BadRequestException('Укажите название и целевую сумму цели');
    }
    const goalDto: {
      name: string;
      targetAmount: number;
      targetDate?: Date;
    } = {
      name,
      targetAmount: target,
    };
    if (p.date?.trim()) {
      goalDto.targetDate = new Date(p.date.trim());
    }
    await this.goalsService.create(userMongoId, goalDto);
    return {
      message: p.reply_hint || `Цель «${name}» на ${target}`,
    };
  }

  private async handleGoalDeposit(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const hint = (p.goal_name || p.category || p.description || '').trim();
    const amount = p.amount!;
    const goal = await this.findGoalByHint(userMongoId, hint);
    if (!goal) {
      throw new BadRequestException('Цель не найдена');
    }
    await this.goalsService.deposit(userMongoId, String(goal._id), {
      amount,
    });
    return {
      message: p.reply_hint || `Положил ${amount} в «${goal.name}»`,
    };
  }

  private async handleGoalWithdraw(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const hint = (p.goal_name || p.category || p.description || '').trim();
    const amount = p.amount!;
    const goal = await this.findGoalByHint(userMongoId, hint);
    if (!goal) {
      throw new BadRequestException('Цель не найдена');
    }
    await this.goalsService.withdraw(userMongoId, String(goal._id), {
      amount,
    });
    return {
      message: p.reply_hint || `Снял ${amount} с «${goal.name}»`,
    };
  }

  private async handleWalletDeposit(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const amount = requirePositiveAmount(p);
    await this.piggyBankService.deposit(userMongoId, amount);
    return {
      message: p.reply_hint || `Пополнил кошелёк на ${amount}`,
    };
  }

  private async handleWalletWithdraw(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const amount = requirePositiveAmount(p);
    await this.piggyBankService.withdraw(userMongoId, amount);
    return {
      message: p.reply_hint || `Снял с кошелька ${amount}`,
    };
  }

  private async handleCreateExpense(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const amount = requirePositiveAmount(p);
    const date = voiceDate(p);
    const category = await this.transactionCategoriesService.resolveForVoice(
      userMongoId,
      'expense',
      p.category,
    );
    const desc = p.description || '';
    const tx = await this.transactionsService.create(userMongoId, {
      type: 'expense',
      amount,
      category,
      description: desc || undefined,
      date: `${date}T12:00:00.000Z`,
      affectWallet: Boolean(p.affect_wallet),
    });
    return {
      message:
        p.reply_hint ||
        `Записал расход ${amount} ${category}${p.affect_wallet ? ', списано с кошелька' : ''}`,
      transactionId: String(tx._id),
    };
  }

  private async handleCreateIncome(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<VoiceExecutionResult> {
    const amount = requirePositiveAmount(p);
    const date = voiceDate(p);
    const category = await this.transactionCategoriesService.resolveForVoice(
      userMongoId,
      'income',
      p.category,
    );
    const desc = p.description || '';
    const tx = await this.transactionsService.create(userMongoId, {
      type: 'income',
      amount,
      category,
      description: desc || undefined,
      date: `${date}T12:00:00.000Z`,
      affectWallet: Boolean(p.affect_wallet),
    });
    return {
      message:
        p.reply_hint ||
        `Записал доход ${amount}${p.affect_wallet ? ', пополнен кошелёк' : ''}`,
      transactionId: String(tx._id),
    };
  }

  private async findGoalByHint(
    userId: string,
    hint: string,
  ): Promise<{ _id: { toString: () => string }; name: string } | null> {
    const goals = await this.goalsService.findAllForUser(userId);
    const q = hint.trim().toLowerCase();
    if (!q) return null;
    const exact = goals.find((g) => g.name.toLowerCase() === q);
    type G = { _id: { toString: () => string }; name: string };
    if (exact) {
      return exact as unknown as G;
    }
    const partial = goals.find(
      (g) =>
        g.name.toLowerCase().includes(q) || q.includes(g.name.toLowerCase()),
    );
    return partial ? (partial as unknown as G) : null;
  }

  /** Удаление только пользовательских расходов/доходов (не служебные deposit/withdraw). */
  private async findTransactionForVoiceDelete(
    userId: string,
    mode: VoiceTransactionDeleteMode,
    match: {
      amount?: number;
      category?: string;
      description?: string;
    },
  ): Promise<{
    _id: { toString: () => string };
    amount: number;
    type: string;
    category: string;
    description?: string;
  } | null> {
    const all = await this.transactionsService.findAllForUser(userId);
    const lines = all.filter(
      (tx) => tx.type === 'expense' || tx.type === 'income',
    );
    if (mode === 'last_expense') {
      const row = lines.find((t) => t.type === 'expense');
      return row
        ? (row as unknown as {
            _id: { toString: () => string };
            amount: number;
            type: string;
            category: string;
            description?: string;
          })
        : null;
    }
    if (mode === 'last_income') {
      const row = lines.find((t) => t.type === 'income');
      return row
        ? (row as unknown as {
            _id: { toString: () => string };
            amount: number;
            type: string;
            category: string;
            description?: string;
          })
        : null;
    }
    if (mode === 'last_any') {
      const row = lines[0];
      return row
        ? (row as unknown as {
            _id: { toString: () => string };
            amount: number;
            type: string;
            category: string;
            description?: string;
          })
        : null;
    }
    const cat = match.category?.trim().toLowerCase();
    const desc = match.description?.trim().toLowerCase();
    const amt = match.amount;
    for (const tx of lines) {
      if (amt != null && amt > 0 && Math.abs(tx.amount - amt) > 0.015) {
        continue;
      }
      if (cat) {
        const tc = tx.category.toLowerCase();
        if (!tc.includes(cat) && !cat.includes(tc)) continue;
      }
      if (desc) {
        const td = (tx.description || '').toLowerCase();
        if (!td.includes(desc)) continue;
      }
      return tx as unknown as {
        _id: { toString: () => string };
        amount: number;
        type: string;
        category: string;
        description?: string;
      };
    }
    return null;
  }
}
