import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PiggyBank, PiggyBankDocument } from './schemas/piggy-bank.schema';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { LlmService } from '../llm/llm.service';
import { LlmUnavailableError } from '../llm/llm.types';

@Injectable()
export class PiggyBankService {
  constructor(
    @InjectModel(PiggyBank.name)
    private piggyBankModel: Model<PiggyBankDocument>,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => TransactionsService))
    private readonly transactionsService: TransactionsService,
    private readonly llm: LlmService,
  ) {}

  async findOneByUser(userId: string): Promise<PiggyBankDocument | null> {
    return this.piggyBankModel.findOne({ user: userId }).exec();
  }

  /** Атомарное пополнение: без read-modify-write, параллельные запросы не теряются. */
  async deposit(userId: string, amount: number): Promise<PiggyBank> {
    return this.piggyBankModel
      .findOneAndUpdate(
        { user: userId },
        { $inc: { amount } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .orFail()
      .exec();
  }

  /** Атомарное списание: баланс проверяется в том же запросе, в минус не уйти. */
  async withdraw(userId: string, amount: number): Promise<PiggyBank | null> {
    return this.piggyBankModel
      .findOneAndUpdate(
        { user: userId, amount: { $gte: amount } },
        { $inc: { amount: -amount } },
        { new: true },
      )
      .exec();
  }

  async analyzeSavings(userId: string): Promise<string> {
    await this.usersService.checkAnalysisLimit(userId, 'savings');

    let user;
    if (userId.match(/^[0-9a-fA-F]{24}$/)) {
      user = await this.usersService.findById(userId);
    } else {
      user = await this.usersService.findOneByTelegramId(parseInt(userId, 10));
    }
    const currency = user?.currency || 'USD';

    const piggyBank = await this.findOneByUser(userId);
    const allTransactions =
      await this.transactionsService.findAllForUser(userId);

    const savingsTransactions = allTransactions.filter((tx) => {
      if ((tx.type === 'deposit' || tx.type === 'withdraw') && !tx.goal) {
        return true;
      }
      if (tx.type === 'expense' && !tx.goal) {
        const desc = (tx.description || '').toLowerCase();
        return (
          desc.includes('кошел') ||
          desc.includes('wallet') ||
          desc.includes('списано с кошелька')
        );
      }
      if (tx.type === 'income' && !tx.goal) {
        const desc = (tx.description || '').toLowerCase();
        return (
          desc.includes('пополнено в кошелек') ||
          desc.includes('deposited to wallet')
        );
      }
      return false;
    });

    if (
      savingsTransactions.length === 0 &&
      (!piggyBank || piggyBank.amount === 0)
    ) {
      throw new BadRequestException(
        'Недостаточно данных для анализа накоплений. Добавьте транзакции или пополнения.',
      );
    }

    await this.usersService.recordAnalysisRequest(userId, 'savings');

    const transactionsText = savingsTransactions
      .map((tx, index) => {
        const date = new Date(tx.date).toLocaleDateString('ru-RU');
        const typeText =
          tx.type === 'deposit'
            ? 'Пополнение'
            : tx.type === 'withdraw'
              ? 'Снятие'
              : tx.type === 'income'
                ? 'Доход'
                : 'Расход';
        return `Транзакция ${index + 1} (${date}):\nТип: ${typeText}\nСумма: ${tx.amount}\nКатегория: ${tx.category}\n${tx.description ? `Описание: ${tx.description}` : ''}`;
      })
      .join('\n\n---\n\n');

    const currentBalance = piggyBank?.amount || 0;
    const totalDeposits = savingsTransactions
      .filter(
        (tx) => tx.type === 'deposit' || (tx.type === 'income' && !tx.goal),
      )
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalWithdrawals = savingsTransactions
      .filter(
        (tx) => tx.type === 'withdraw' || (tx.type === 'expense' && !tx.goal),
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const isRussian = true;

    const systemMessage = isRussian
      ? `Ты помощник приложения Capy. Твоя задача - проанализировать ВСЕ данные о накоплениях пользователя и дать конкретный, полезный анализ БЕЗ воды и общих фраз.

ВАЖНЫЕ ТРЕБОВАНИЯ:
1. Проанализируй ВСЕ транзакции накоплений (всего ${savingsTransactions.length} транзакций). Найди реальные паттерны, тенденции и конкретные факты.
2. Указывай конкретные даты и суммы, на которые ссылаешься.
3. Избегай общих фраз типа "можно предположить", "возможно стоит". Говори конкретно о том, что ТОЧНО видно в данных.
4. Проанализируй динамику накоплений: частота пополнений, размеры пополнений, частота снятий, паттерны трат.
5. Дай конкретные рекомендации по улучшению накоплений на основе реальных данных.
6. Будь кратким и по делу. Максимум 3-4 конкретных вывода и 2-3 реальных рекомендации.

КРИТИЧЕСКИ ВАЖНО - ФОРМАТ ОТВЕТА:
- НЕ используй markdown разметку (**, *, #, и т.д.)
- НЕ используй звездочки, жирный текст, заголовки
- Используй простой текст с переносами строк
- Формат: краткий анализ (2-3 абзаца), затем пустая строка, затем "РЕКОМЕНДАЦИИ:" и нумерованный список (1., 2., 3.)
- Пример:
  "За период зафиксировано 12 операций...

  РЕКОМЕНДАЦИИ:
  1. Первая рекомендация
  2. Вторая рекомендация
  3. Третья рекомендация"`
      : `You are Capy app assistant. Your task is to analyze ALL user's savings data and provide specific, useful analysis WITHOUT filler words and generic phrases.

IMPORTANT REQUIREMENTS:
1. Analyze ALL savings transactions (${savingsTransactions.length} transactions total). Find real patterns, trends, and specific facts.
2. Reference specific dates and amounts.
3. Avoid generic phrases. Speak specifically about what you ACTUALLY see in the data.
4. Analyze savings dynamics: deposit frequency, deposit amounts, withdrawal frequency, spending patterns.
5. Give specific recommendations for improving savings based on real data.
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
      ? `Вот все данные о накоплениях пользователя:

ВАЖНО: Все суммы указаны в валюте ${currencyName} (${currency}). В ответе обязательно указывай валюту при упоминании сумм.

Текущий баланс: ${currentBalance} ${currency}
Всего пополнений: ${totalDeposits} ${currency}
Всего снятий: ${totalWithdrawals} ${currency}

Транзакции накоплений (всего ${savingsTransactions.length} транзакций):
${transactionsText}

Проанализируй эти данные и дай конкретный, полезный анализ. Обязательно указывай валюту ${currencyName} при упоминании сумм.`
      : `Here is all user's savings data:

IMPORTANT: All amounts are in ${currency} currency. Always specify the currency when mentioning amounts in your response.

Current balance: ${currentBalance} ${currency}
Total deposits: ${totalDeposits} ${currency}
Total withdrawals: ${totalWithdrawals} ${currency}

Savings transactions (${savingsTransactions.length} transactions total):
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
            ? 'Не удалось проанализировать накопления. Все AI сервисы недоступны. Пожалуйста, проверьте настройки API ключей или попробуйте позже.'
            : 'Failed to analyze savings. All AI services are unavailable. Please check API key settings or try again later.',
        );
      }
      throw error;
    }
  }
}
