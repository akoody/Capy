import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PiggyBank, PiggyBankDocument } from './schemas/piggy-bank.schema';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import axios from 'axios';
import * as https from 'https';
import * as crypto from 'crypto';

@Injectable()
export class PiggyBankService {
  constructor(
    @InjectModel(PiggyBank.name) private piggyBankModel: Model<PiggyBankDocument>,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => TransactionsService))
    private readonly transactionsService: TransactionsService,
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
    const allTransactions = await this.transactionsService.findAllForUser(userId);
    
    const savingsTransactions = allTransactions.filter((tx) => {
      if ((tx.type === 'deposit' || tx.type === 'withdraw') && !tx.goal) {
        return true;
      }
      if (tx.type === 'expense' && !tx.goal) {
        const desc = (tx.description || '').toLowerCase();
        return desc.includes('кошел') || desc.includes('wallet') || desc.includes('списано с кошелька');
      }
      if (tx.type === 'income' && !tx.goal) {
        const desc = (tx.description || '').toLowerCase();
        return desc.includes('пополнено в кошелек') || desc.includes('deposited to wallet');
      }
      return false;
    });

    if (savingsTransactions.length === 0 && (!piggyBank || piggyBank.amount === 0)) {
      throw new BadRequestException('Недостаточно данных для анализа накоплений. Добавьте транзакции или пополнения.');
    }

    await this.usersService.recordAnalysisRequest(userId, 'savings');

    const transactionsText = savingsTransactions
      .map((tx, index) => {
        const date = new Date(tx.date).toLocaleDateString('ru-RU');
        const typeText = tx.type === 'deposit' ? 'Пополнение' : tx.type === 'withdraw' ? 'Снятие' : tx.type === 'income' ? 'Доход' : 'Расход';
        return `Транзакция ${index + 1} (${date}):\nТип: ${typeText}\nСумма: ${tx.amount}\nКатегория: ${tx.category}\n${tx.description ? `Описание: ${tx.description}` : ''}`;
      })
      .join('\n\n---\n\n');

    const currentBalance = piggyBank?.amount || 0;
    const totalDeposits = savingsTransactions
      .filter(tx => tx.type === 'deposit' || (tx.type === 'income' && !tx.goal))
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalWithdrawals = savingsTransactions
      .filter(tx => tx.type === 'withdraw' || (tx.type === 'expense' && !tx.goal))
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
      'USD': 'долларов США',
      'EUR': 'евро',
      'RUB': 'рублей',
      'GBP': 'фунтов стерлингов',
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
      return await this.analyzeWithGigaChat(userMessage, systemMessage);
    } catch (gigaError: any) {
      if (gigaError?.response?.status === 401 || gigaError?.response?.status === 403) {
        (this as any)._gigachatToken = null;
        (this as any)._gigachatTokenExpiry = null;
      }
      console.warn('GigaChat API error:', {
        status: gigaError?.response?.status,
        data: gigaError?.response?.data,
        message: gigaError?.message,
      });
      
      try {
        return await this.analyzeWithGemini(userMessage, systemMessage);
      } catch (geminiError: any) {
        console.warn('Gemini API error:', {
          status: geminiError?.response?.status,
          data: geminiError?.response?.data,
          message: geminiError?.message,
        });
        
        try {
          return await this.analyzeWithDeepSeek(userMessage, systemMessage);
        } catch (deepseekError: any) {
          console.warn('DeepSeek API error:', deepseekError?.response?.status);
          
          try {
            return await this.analyzeWithGroq(userMessage, systemMessage);
          } catch (groqError: any) {
            console.error('All AI APIs failed');
            
            const errorMessage = isRussian
              ? 'Не удалось проанализировать накопления. Все AI сервисы недоступны. Пожалуйста, проверьте настройки API ключей или попробуйте позже.'
              : 'Failed to analyze savings. All AI services are unavailable. Please check API key settings or try again later.';
            
            throw new BadRequestException(errorMessage);
          }
        }
      }
    }
  }

  private async analyzeWithGroq(
    userMessage: string,
    systemMessage: string
  ): Promise<string> {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error('Groq API key not configured');
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        timeout: 30000,
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status === 403 || response.status === 401) {
      const error = new Error(`Groq API authentication failed: ${response.status}`);
      (error as any).response = response;
      throw error;
    }

    if (response.status !== 200) {
      const error = new Error(`Groq API error: ${response.status}`);
      (error as any).response = response;
      throw error;
    }

    return response.data.choices[0].message.content.trim();
  }

  private async analyzeWithGemini(
    userMessage: string,
    systemMessage: string
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const model = 'gemini-1.5-flash';
    const temperature = 0.7;
    const maxOutputTokens = 1000;

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: `${systemMessage}\n\n${userMessage}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: maxOutputTokens,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned empty response');
      }

      return text.trim();
    } catch (error: any) {
      if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error?.message || 'Bad request';
        throw new Error(`Gemini API error: ${errorMsg}`);
      }
      if (error.response?.status === 403 || error.response?.status === 401) {
        throw new Error('Gemini API authentication failed. Check your API key.');
      }
      throw error;
    }
  }

  private prepareGigaChatMessages(message: string, systemPrompt?: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: message });
    return messages;
  }

  private async getGigaChatAccessToken(apiKey: string): Promise<string> {
    let accessToken = (this as any)._gigachatToken;
    let tokenExpiry = (this as any)._gigachatTokenExpiry;

    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    try {
      let encodedKey = apiKey;
      if (apiKey.includes(':') && !apiKey.startsWith('Basic ')) {
        encodedKey = Buffer.from(apiKey).toString('base64');
      }

      const response = await axios.post(
        'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
        'scope=GIGACHAT_API_PERS',
        {
          headers: {
            'Authorization': `Basic ${encodedKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'RqUID': crypto.randomUUID(),
          },
          timeout: 30000,
          httpsAgent: agent,
        }
      );

      accessToken = response.data.access_token;
      tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      (this as any)._gigachatToken = accessToken;
      (this as any)._gigachatTokenExpiry = tokenExpiry;

      return accessToken;
    } catch (error: any) {
      console.error('GigaChat auth error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      throw new Error(`Failed to get GigaChat access token: ${error.response?.data?.message || error.message}`);
    }
  }

  private async analyzeWithGigaChat(
    userMessage: string,
    systemMessage: string
  ): Promise<string> {
    const apiKey = process.env.GIGACHAT_API_KEY;
    if (!apiKey) {
      throw new Error('GigaChat API key not configured');
    }

    const accessToken = await this.getGigaChatAccessToken(apiKey);
    const model = 'GigaChat:latest';
    const temperature = 0.7;
    const maxTokens = 1000;
    const messages = this.prepareGigaChatMessages(userMessage, systemMessage);
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    try {
      const response = await axios.post(
        'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
        {
          model: model,
          messages: messages,
          max_tokens: maxTokens,
          temperature: temperature,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 180000,
          httpsAgent: agent,
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        (this as any)._gigachatToken = null;
        (this as any)._gigachatTokenExpiry = null;
      }
      throw error;
    }
  }

  private async analyzeWithDeepSeek(
    userMessage: string,
    systemMessage: string
  ): Promise<string> {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekApiKey}`,
        },
        timeout: 30000,
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status === 402) {
      const error = new Error('DeepSeek API requires payment');
      (error as any).response = response;
      throw error;
    }

    if (response.status !== 200) {
      const error = new Error(`DeepSeek API error: ${response.status}`);
      (error as any).response = response;
      throw error;
    }

    return response.data.choices[0].message.content.trim();
  }
}
