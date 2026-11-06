import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { Goal, GoalDocument } from '../goals/schemas/goal.schema';
import { orNotFound, ownedBy } from '../common/owned-by';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { UsersService } from '../users/users.service';
import { TransactionCategoriesService } from './transaction-categories.service';
import { LlmService } from '../llm/llm.service';
import { LlmUnavailableError } from '../llm/llm.types';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly transactionCategoriesService: TransactionCategoriesService,
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
    private readonly llm: LlmService,
  ) {}

  async create(
    userId: string,
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    await this.assertGoalOwned(userId, createTransactionDto.goal);
    let category = createTransactionDto.category?.trim();
    if (createTransactionDto.categoryId) {
      const catDoc = await this.transactionCategoriesService.findOneForUser(
        userId,
        createTransactionDto.categoryId,
      );
      category = catDoc.name;
    }
    if (!category) {
      throw new BadRequestException(
        'Укажите категорию или выберите categoryId',
      );
    }

    const transaction = new this.transactionModel({
      user: userId,
      amount: createTransactionDto.amount,
      type: createTransactionDto.type,
      category,
      description: createTransactionDto.description,
      date: createTransactionDto.date,
      ...(createTransactionDto.goal ? { goal: createTransactionDto.goal } : {}),
    });
    const saved = await transaction.save();

    if (saved.type === 'expense' || saved.type === 'income') {
      await this.transactionCategoriesService.ensureFromTransaction(
        userId,
        category,
        saved.type,
      );
    }

    return saved;
  }

  async findAllForUser(userId: string): Promise<TransactionDocument[]> {
    return this.transactionModel
      .find({ user: userId })
      .sort({ date: -1 })
      .exec();
  }

  async update(
    userId: string,
    id: string,
    updateTransactionDto: UpdateTransactionDto,
  ): Promise<Transaction> {
    await this.assertGoalOwned(userId, updateTransactionDto.goal);
    return orNotFound(
      await this.transactionModel
        .findOneAndUpdate(
          ownedBy(userId, id),
          { $set: updateTransactionDto },
          { new: true },
        )
        .exec(),
      'Transaction',
    );
  }

  async remove(userId: string, id: string): Promise<Transaction> {
    return orNotFound(
      await this.transactionModel.findOneAndDelete(ownedBy(userId, id)).exec(),
      'Transaction',
    );
  }

  /** Транзакцию нельзя привязать к чужой цели. */
  private async assertGoalOwned(
    userId: string,
    goalId?: string,
  ): Promise<void> {
    if (!goalId) return;
    const owned = await this.goalModel.exists(ownedBy(userId, goalId));
    if (!owned) {
      throw new BadRequestException('Goal not found');
    }
  }

  async analyzeTransactions(userId: string): Promise<string> {
    await this.usersService.checkAnalysisLimit(userId, 'transactions');

    let user;
    if (userId.match(/^[0-9a-fA-F]{24}$/)) {
      user = await this.usersService.findById(userId);
    } else {
      user = await this.usersService.findOneByTelegramId(parseInt(userId, 10));
    }
    const currency = user?.currency || 'USD';

    const allTransactions = await this.findAllForUser(userId);

    const transactions = allTransactions.filter(
      (tx) => (tx.type === 'income' || tx.type === 'expense') && !tx.goal,
    );

    if (transactions.length === 0) {
      throw new BadRequestException(
        'Недостаточно данных для анализа транзакций. Добавьте транзакции доходов или расходов.',
      );
    }

    await this.usersService.recordAnalysisRequest(userId, 'transactions');

    const transactionsText = transactions
      .map((tx, index) => {
        const date = new Date(tx.date).toLocaleDateString('ru-RU');
        const typeText = tx.type === 'income' ? 'Доход' : 'Расход';
        return `Транзакция ${index + 1} (${date}):\nТип: ${typeText}\nСумма: ${tx.amount}\nКатегория: ${tx.category}\n${tx.description ? `Описание: ${tx.description}` : ''}`;
      })
      .join('\n\n---\n\n');

    const totalIncome = transactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const balance = totalIncome - totalExpense;

    const categoryStats = transactions.reduce(
      (acc, tx) => {
        if (!acc[tx.category]) {
          acc[tx.category] = { income: 0, expense: 0 };
        }
        if (tx.type === 'income') {
          acc[tx.category].income += tx.amount;
        } else {
          acc[tx.category].expense += tx.amount;
        }
        return acc;
      },
      {} as Record<string, { income: number; expense: number }>,
    );

    const categoryStatsText = Object.entries(categoryStats)
      .map(
        ([category, stats]) =>
          `Категория "${category}": доходы ${stats.income}, расходы ${stats.expense}`,
      )
      .join('\n');

    const isRussian = true;

    const systemMessage = isRussian
      ? `Ты помощник приложения Capy. Твоя задача - проанализировать ВСЕ транзакции пользователя и дать конкретный, полезный анализ БЕЗ воды и общих фраз.

ВАЖНЫЕ ТРЕБОВАНИЯ:
1. Проанализируй ВСЕ транзакции (всего ${transactions.length} транзакций). Найди реальные паттерны, тенденции и конкретные факты.
2. Указывай конкретные даты, суммы и категории, на которые ссылаешься.
3. Избегай общих фраз типа "можно предположить", "возможно стоит". Говори конкретно о том, что ТОЧНО видно в данных.
4. Проанализируй структуру доходов и расходов: какие категории преобладают, динамика по времени, крупные транзакции.
5. Дай конкретные рекомендации по улучшению финансового управления на основе реальных данных.
6. Будь кратким и по делу. Максимум 3-4 конкретных вывода и 2-3 реальных рекомендации.

КРИТИЧЕСКИ ВАЖНО - ФОРМАТ ОТВЕТА:
- НЕ используй markdown разметку (**, *, #, и т.д.)
- НЕ используй звездочки, жирный текст, заголовки
- Используй простой текст с переносами строк
- Формат: краткий анализ (2-3 абзаца), затем пустая строка, затем "РЕКОМЕНДАЦИИ:" и нумерованный список (1., 2., 3.)
- Пример:
  "За период зафиксировано 45 транзакций...

  РЕКОМЕНДАЦИИ:
  1. Первая рекомендация
  2. Вторая рекомендация
  3. Третья рекомендация"`
      : `You are Capy app assistant. Your task is to analyze ALL user's transactions and provide specific, useful analysis WITHOUT filler words and generic phrases.

IMPORTANT REQUIREMENTS:
1. Analyze ALL transactions (${transactions.length} transactions total). Find real patterns, trends, and specific facts.
2. Reference specific dates, amounts, and categories.
3. Avoid generic phrases. Speak specifically about what you ACTUALLY see in the data.
4. Analyze income and expense structure: which categories dominate, time dynamics, large transactions.
5. Give specific recommendations for improving financial management based on real data.
6. Be brief and to the point. Maximum 3-4 specific insights and 2-3 real recommendations.

CRITICAL - RESPONSE FORMAT:
- DO NOT use markdown formatting (**, *, #, etc.)
- DO NOT use asterisks, bold text, headings
- Use plain text with line breaks
- Format: brief analysis (2-3 paragraphs), then empty line, then "RECOMMENDATIONS:" and numbered list (1., 2., 3.)`;

    const currencyNames: Record<string, string> = {
      USD: 'долларов США',
      EUR: 'евро',
      RUB: 'рублей',
      GBP: 'фунтов стерлингов',
    };
    const currencyName = currencyNames[currency] || currency;

    const userMessage = isRussian
      ? `Вот все транзакции пользователя:

ВАЖНО: Все суммы указаны в валюте ${currencyName} (${currency}). В ответе обязательно указывай валюту при упоминании сумм.

Всего транзакций: ${transactions.length}
Общий доход: ${totalIncome} ${currency}
Общий расход: ${totalExpense} ${currency}
Баланс: ${balance} ${currency}

Статистика по категориям:
${categoryStatsText}

Все транзакции:
${transactionsText}

Проанализируй эти данные и дай конкретный, полезный анализ. Обязательно указывай валюту ${currencyName} при упоминании сумм.`
      : `Here are all user's transactions:

IMPORTANT: All amounts are in ${currency} currency. Always specify the currency when mentioning amounts in your response.

Total transactions: ${transactions.length}
Total income: ${totalIncome} ${currency}
Total expense: ${totalExpense} ${currency}
Balance: ${balance} ${currency}

Category statistics:
${categoryStatsText}

All transactions:
${transactionsText}

Analyze this data and provide specific, useful analysis. Always specify ${currency} currency when mentioning amounts.`;

    try {
      return await this.llm.complete({
        system: systemMessage,
        user: userMessage,
      });
    } catch (error) {
      if (error instanceof LlmUnavailableError) {
        throw new BadRequestException(
          isRussian
            ? 'Не удалось проанализировать транзакции. Все AI сервисы недоступны. Пожалуйста, проверьте настройки API ключей или попробуйте позже.'
            : 'Failed to analyze transactions. All AI services are unavailable. Please check API key settings or try again later.',
        );
      }
      throw error;
    }
  }
}
