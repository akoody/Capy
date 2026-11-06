import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  JournalEntry,
  JournalEntryDocument,
} from './schemas/journal-entry.schema';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import axios from 'axios';
import * as https from 'https';
import * as crypto from 'crypto';

@Injectable()
export class JournalService {
  constructor(
    @InjectModel(JournalEntry.name)
    private journalEntryModel: Model<JournalEntryDocument>,
  ) {}

  async create(
    createJournalEntryDto: CreateJournalEntryDto,
  ): Promise<JournalEntry> {
    try {
      const createdEntry = new this.journalEntryModel({
        ...createJournalEntryDto,
        user: createJournalEntryDto.userId,
      });
      return await createdEntry.save();
    } catch (error) {
      console.error('Error saving journal entry to database:', error);
      throw error;
    }
  }

  async findAllForUser(userId: string): Promise<JournalEntry[]> {
    return this.journalEntryModel
      .find({ user: userId })
      .sort({ date: -1, createdAt: -1 })
      .exec();
  }

  async findOne(id: string, userId: string): Promise<JournalEntry | null> {
    return this.journalEntryModel.findOne({ _id: id, user: userId }).exec();
  }

  async update(
    id: string,
    userId: string,
    updateJournalEntryDto: UpdateJournalEntryDto,
  ): Promise<JournalEntry | null> {
    const entry = await this.findOne(id, userId);
    if (!entry) {
      throw new BadRequestException('Journal entry not found.');
    }

    return this.journalEntryModel
      .findByIdAndUpdate(id, { $set: updateJournalEntryDto }, { new: true })
      .exec();
  }

  async remove(id: string, userId: string): Promise<any> {
    const entry = await this.findOne(id, userId);
    if (!entry) {
      throw new BadRequestException('Journal entry not found.');
    }

    return this.journalEntryModel.findByIdAndDelete(id).exec();
  }

  async analyzeEntries(userId: string): Promise<string> {
    const entries = await this.findAllForUser(userId);

    if (entries.length === 0) {
      throw new BadRequestException('No journal entries found for analysis.');
    }

    const entriesText = entries
      .map((entry, index) => {
        const date = new Date(entry.date || entry.createdAt).toLocaleDateString(
          'ru-RU',
        );
        return `Запись ${index + 1} (${date}):\n${entry.title ? `Заголовок: ${entry.title}\n` : ''}${entry.content}`;
      })
      .join('\n\n---\n\n');

    console.log(
      `Analyzing ${entries.length} journal entries for user ${userId}`,
    );

    const isRussian = entries.some(
      (entry) =>
        /[а-яё]/i.test(entry.content) ||
        (entry.title && /[а-яё]/i.test(entry.title)),
    );

    const systemMessage = isRussian
      ? `Ты помощник приложения Capy. Твоя задача - проанализировать ВСЕ дневниковые записи пользователя и дать конкретный, полезный анализ БЕЗ воды и общих фраз.

ВАЖНЫЕ ТРЕБОВАНИЯ:
1. Проанализируй ВСЕ записи (их ${entries.length}). Найди реальные паттерны, тенденции и конкретные факты.
2. Указывай конкретные номера записей, на которые ссылаешься (например: "В записях 2, 5 и 7 заметно...").
3. Избегай общих фраз типа "можно предположить", "возможно стоит", "если вы чувствуете". Говори конкретно о том, что ТОЧНО видно в записях.
4. Если записей мало или они не содержат достаточной информации - скажи об этом прямо.
5. Выдели конкретные действия, эмоции, проблемы, которые реально присутствуют в записях.
6. Финансовые советы давай только если они действительно связаны с тем, что написано в дневнике.
7. Будь кратким и по делу. Максимум 3-4 конкретных вывода и 2-3 реальных рекомендации, основанных на анализе.

Формат ответа: краткий анализ конкретных фактов из записей, затем 2-3 конкретные рекомендации.`
      : `You are Capy app assistant. Your task is to analyze ALL user's journal entries and provide specific, useful analysis WITHOUT filler words and generic phrases.

IMPORTANT REQUIREMENTS:
1. Analyze ALL entries (there are ${entries.length} of them). Find real patterns, trends, and specific facts.
2. Reference specific entry numbers (e.g., "In entries 2, 5, and 7, I notice...").
3. Avoid generic phrases like "you might consider", "perhaps you should", "if you feel". Speak specifically about what you ACTUALLY see in the entries.
4. If there are few entries or they don't contain enough information - say so directly.
5. Highlight specific actions, emotions, problems that are actually present in the entries.
6. Give financial advice only if it's really related to what's written in the journal.
7. Be brief and to the point. Maximum 3-4 specific insights and 2-3 real recommendations based on the analysis.

Response format: brief analysis of specific facts from the entries, then 2-3 specific recommendations.`;

    const userMessage = isRussian
      ? `Вот все дневниковые записи пользователя (всего ${entries.length} записей):\n\n${entriesText}\n\nПроанализируй их и дай конкретный, полезный анализ.`
      : `Here are all the user's journal entries (${entries.length} entries total):\n\n${entriesText}\n\nAnalyze them and provide specific, useful analysis.`;

    try {
      return await this.analyzeWithGigaChat(userMessage, systemMessage);
    } catch (gigaError: any) {
      if (
        gigaError?.response?.status === 401 ||
        gigaError?.response?.status === 403
      ) {
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
              ? 'Не удалось проанализировать заметки. Все AI сервисы недоступны. Пожалуйста, проверьте настройки API ключей или попробуйте позже.'
              : 'Failed to analyze journal entries. All AI services are unavailable. Please check API key settings or try again later.';

            throw new BadRequestException(errorMessage);
          }
        }
      }
    }
  }

  private async analyzeWithGroq(
    userMessage: string,
    systemMessage: string,
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
      },
    );

    if (response.status === 403 || response.status === 401) {
      const error = new Error(
        `Groq API authentication failed: ${response.status}`,
      );
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
    systemMessage: string,
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
        },
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
        throw new Error(
          'Gemini API authentication failed. Check your API key.',
        );
      }
      throw error;
    }
  }

  private prepareGigaChatMessages(
    message: string,
    systemPrompt?: string,
  ): Array<{ role: string; content: string }> {
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
        console.log('GigaChat API key contains colon, encoding to Base64...');
        encodedKey = Buffer.from(apiKey).toString('base64');
      }

      const response = await axios.post(
        'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
        'scope=GIGACHAT_API_PERS',
        {
          headers: {
            Authorization: `Basic ${encodedKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            RqUID: crypto.randomUUID(),
          },
          timeout: 30000,
          httpsAgent: agent,
        },
      );

      accessToken = response.data.access_token;
      tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000;

      (this as any)._gigachatToken = accessToken;
      (this as any)._gigachatTokenExpiry = tokenExpiry;

      return accessToken;
    } catch (error: any) {
      console.error('GigaChat auth error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      throw new Error(
        `Failed to get GigaChat access token: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  private async analyzeWithGigaChat(
    userMessage: string,
    systemMessage: string,
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
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 180000,
          httpsAgent: agent,
        },
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
    systemMessage: string,
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
      },
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
