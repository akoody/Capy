import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  JournalEntry,
  JournalEntryDocument,
} from './schemas/journal-entry.schema';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { LlmService } from '../llm/llm.service';
import { LlmUnavailableError } from '../llm/llm.types';
import { orNotFound, ownedBy } from '../common/owned-by';

@Injectable()
export class JournalService {
  constructor(
    @InjectModel(JournalEntry.name)
    private journalEntryModel: Model<JournalEntryDocument>,
    private readonly llm: LlmService,
  ) {}

  async create(
    userId: string,
    dto: CreateJournalEntryDto,
  ): Promise<JournalEntry> {
    return new this.journalEntryModel({
      ...dto,
      ...(dto.date ? { date: new Date(dto.date) } : {}),
      user: userId,
    }).save();
  }

  async findAllForUser(userId: string): Promise<JournalEntry[]> {
    return this.journalEntryModel
      .find({ user: userId })
      .sort({ date: -1, createdAt: -1 })
      .exec();
  }

  async findOne(userId: string, id: string): Promise<JournalEntry> {
    return orNotFound(
      await this.journalEntryModel.findOne(ownedBy(userId, id)).exec(),
      'Journal entry',
    );
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateJournalEntryDto,
  ): Promise<JournalEntry> {
    const update = {
      ...dto,
      ...(dto.date ? { date: new Date(dto.date) } : {}),
    };
    return orNotFound(
      await this.journalEntryModel
        .findOneAndUpdate(ownedBy(userId, id), { $set: update }, { new: true })
        .exec(),
      'Journal entry',
    );
  }

  async remove(userId: string, id: string): Promise<JournalEntry> {
    return orNotFound(
      await this.journalEntryModel.findOneAndDelete(ownedBy(userId, id)).exec(),
      'Journal entry',
    );
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
      return await this.llm.complete({
        system: systemMessage,
        user: userMessage,
      });
    } catch (error) {
      if (error instanceof LlmUnavailableError) {
        throw new BadRequestException(
          isRussian
            ? 'Не удалось проанализировать заметки. Все AI сервисы недоступны. Пожалуйста, проверьте настройки API ключей или попробуйте позже.'
            : 'Failed to analyze journal entries. All AI services are unavailable. Please check API key settings or try again later.',
        );
      }
      throw error;
    }
  }
}
