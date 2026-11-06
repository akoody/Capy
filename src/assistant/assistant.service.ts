import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import * as https from 'https';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionCategoriesService } from '../transactions/transaction-categories.service';
import { PiggyBankService } from '../piggy-bank/piggy-bank.service';
import { GoalsService } from '../goals/goals.service';
import { TasksService } from '../tasks/tasks.service';
import { JournalService } from '../journal/journal.service';
import { BudgetsService } from '../budgets/budgets.service';
import {
  VoiceCommandResponseDto,
  VoiceIntent,
  VoiceInterpretBatch,
  VoiceInterpretResult,
  VoiceTransactionDeleteMode,
} from './voice-intent.types';
import type { UploadedAudioFile } from './uploaded-audio-file';
import { normalizeAudioForWhisper } from './normalize-audio-for-whisper';
import { normalizeEnvSecret } from '../env-secrets';
import 'dotenv/config';

@Injectable()
export class AssistantService {
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

  async processVoiceCommand(
    file: UploadedAudioFile,
    userId: string,
  ): Promise<VoiceCommandResponseDto> {
    await this.usersService.checkVoiceCommandLimit(userId);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Пустой аудиофайл');
    }
    if (!file.mimetype?.startsWith('audio/')) {
      throw new BadRequestException('Нужен аудиофайл');
    }

    const transcript = await this.transcribeAudio(file);
    if (!transcript.trim()) {
      return {
        transcript: '',
        intent: 'unknown',
        confidence: 0,
        message: 'Не удалось распознать речь. Попробуйте ещё раз.',
        executed: false,
      };
    }

    const context = await this.buildUserContext(userId);
    let batch: VoiceInterpretBatch;
    try {
      batch = await this.interpretTranscript(transcript, context);
      batch = this.applyStructuralConfidenceFloorBatch(batch, transcript);
    } catch {
      return {
        transcript,
        intent: 'unknown',
        confidence: 0,
        message:
          'Не удалось разобрать команду: все AI-сервисы недоступны. Проверьте ключи в .env',
        executed: false,
      };
    }

    await this.usersService.recordVoiceCommandRequest(userId);

    const items = batch.items.length > 0 ? batch.items : [];

    const previewHint =
      items.map((i) => i.reply_hint?.trim()).find(Boolean) || '';
    const first = items[0];

    if (items.length === 0 || items.every((i) => i.intent === 'unknown')) {
      return {
        transcript,
        intent: 'unknown',
        confidence: first?.confidence ?? 0,
        message:
          previewHint ||
          batch.batch_reply_hint?.trim() ||
          'Не понял команду. Примеры: трата/доход, кошелёк, цель, задача, дневник, бюджет, категория, «удали последнюю трату», «сколько на кошельке».',
        executed: false,
      };
    }

    const ready = items.filter((i) => this.isVoiceItemExecutable(i));

    if (ready.length === 0) {
      const lowConf = items.find(
        (i) => i.intent !== 'unknown' && i.confidence < 0.45,
      );
      if (lowConf) {
        return {
          transcript,
          intent: lowConf.intent,
          confidence: lowConf.confidence,
          message:
            'Фраза распознана неуверенно. Повторите чётче или назовите сумму отдельно.',
          executed: false,
        };
      }
      const noAmt = items.find(
        (i) =>
          i.intent !== 'unknown' &&
          this.voiceItemNeedsPositiveAmount(i) &&
          (!i.amount || i.amount <= 0),
      );
      if (noAmt) {
        return {
          transcript,
          intent: noAmt.intent,
          confidence: noAmt.confidence,
          message: 'Не удалось определить сумму. Повторите с числом.',
          executed: false,
        };
      }
      return {
        transcript,
        intent: 'unknown',
        confidence: first?.confidence ?? 0,
        message:
          previewHint ||
          'Не понял команду. Пример: несколько трат — «1000 на еду и 500 на кофе».',
        executed: false,
      };
    }

    const minConfidence = Math.min(...ready.map((i) => i.confidence));
    const primaryIntent = ready[0].intent;

    const parts: string[] = [];
    const transactionIds: string[] = [];
    let walletTouched = false;
    let lastError: string | undefined;

    for (const op of ready) {
      try {
        const execResult = await this.executeIntent(op, userId);
        parts.push(execResult.message);
        if (execResult.transactionId) {
          transactionIds.push(execResult.transactionId);
        }
        if (
          op.intent === 'wallet_deposit' ||
          op.intent === 'wallet_withdraw' ||
          (op.affect_wallet &&
            (op.intent === 'create_expense' || op.intent === 'create_income'))
        ) {
          walletTouched = true;
        }
      } catch (err: unknown) {
        const e = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const errMsg =
          e?.response?.data?.message ||
          e?.message ||
          'Не удалось выполнить команду';
        const short = typeof errMsg === 'string' ? errMsg : 'Ошибка выполнения';
        parts.push(`Не записано (${this.opShortLabel(op)}): ${short}`);
        lastError = short;
      }
    }

    const successCount = parts.filter(
      (p) => !p.startsWith('Не записано'),
    ).length;
    const allOk = successCount === ready.length;

    let message: string;
    if (ready.length === 1 && allOk) {
      message =
        ready[0].reply_hint?.trim() ||
        batch.batch_reply_hint?.trim() ||
        parts[0];
    } else if (allOk && batch.batch_reply_hint?.trim()) {
      message = batch.batch_reply_hint.trim();
    } else {
      message = parts.join(' · ');
    }

    return {
      transcript,
      intent: primaryIntent,
      confidence: minConfidence,
      message,
      executed: successCount > 0,
      transactionId: transactionIds[0],
      transactionIds: transactionIds.length > 0 ? transactionIds : undefined,
      walletTouched,
      error: successCount === 0 ? lastError : undefined,
      successCount,
      operationsAttempted: ready.length,
    };
  }

  private opShortLabel(op: VoiceInterpretResult): string {
    const a = op.amount ?? 0;
    switch (op.intent) {
      case 'create_expense':
        return `расход ${a}`;
      case 'create_income':
        return `доход ${a}`;
      case 'wallet_deposit':
        return `кошелёк +${a}`;
      case 'wallet_withdraw':
        return `кошелёк −${a}`;
      case 'goal_create':
        return `цель ${a}`;
      case 'goal_deposit':
        return `в цель ${a}`;
      case 'goal_withdraw':
        return `из цели ${a}`;
      case 'task_create':
        return `задача`;
      case 'task_complete':
        return `задача ✓`;
      case 'task_cancel':
        return `задача ✕`;
      case 'task_delete':
        return `задача удал.`;
      case 'task_update':
        return `задача правка`;
      case 'journal_create':
        return `дневник`;
      case 'budget_create':
        return `бюджет`;
      case 'category_create':
        return `категория`;
      case 'transaction_delete':
        return `удал. транз.`;
      case 'goal_delete':
        return `цель ✕`;
      case 'wallet_balance':
        return `баланс`;
      default:
        return op.intent;
    }
  }

  private voiceItemNeedsPositiveAmount(i: VoiceInterpretResult): boolean {
    if (i.intent === 'unknown') return false;
    if (
      i.intent === 'task_create' ||
      i.intent === 'task_complete' ||
      i.intent === 'task_cancel' ||
      i.intent === 'task_delete' ||
      i.intent === 'task_update' ||
      i.intent === 'wallet_balance' ||
      i.intent === 'journal_create' ||
      i.intent === 'category_create' ||
      i.intent === 'transaction_delete' ||
      i.intent === 'goal_delete'
    ) {
      return false;
    }
    return true;
  }

  private isVoiceItemExecutable(i: VoiceInterpretResult): boolean {
    if (i.intent === 'unknown' || i.confidence < 0.45) return false;
    if (this.voiceItemNeedsPositiveAmount(i)) {
      if (i.amount == null || i.amount <= 0) return false;
    }
    switch (i.intent) {
      case 'task_create':
        return Boolean(i.task_title?.trim() || i.description?.trim());
      case 'task_complete':
      case 'task_cancel':
      case 'task_delete':
        return Boolean(i.task_title?.trim() || i.description?.trim());
      case 'task_update': {
        const hint = (i.task_title || i.description || '').trim();
        if (!hint) return false;
        return Boolean(
          i.new_task_title?.trim() ||
            i.date?.trim() ||
            i.priority ||
            i.reminder_at?.trim() ||
            (i.reminder_times && i.reminder_times.length > 0),
        );
      }
      case 'goal_create':
        return Boolean(i.goal_name?.trim() || i.description?.trim());
      case 'goal_deposit':
      case 'goal_withdraw':
        return Boolean(
          i.goal_name?.trim() || i.category?.trim() || i.description?.trim(),
        );
      case 'goal_delete':
        return Boolean(i.goal_name?.trim() || i.description?.trim());
      case 'wallet_balance':
        return true;
      case 'journal_create':
        return Boolean(
          (i.journal_content || i.description || '').trim().length > 0,
        );
      case 'budget_create':
        return Boolean(
          i.amount != null &&
            i.amount > 0 &&
            i.category?.trim() &&
            (i.budget_name?.trim() || i.description?.trim()) &&
            (i.budget_period === 'weekly' || i.budget_period === 'monthly'),
        );
      case 'category_create':
        return Boolean(i.category?.trim() && i.category_kind);
      case 'transaction_delete':
        return Boolean(i.delete_mode);
      default:
        return i.amount != null && i.amount > 0;
    }
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

  private defaultReplyHint(
    intent: VoiceIntent,
    p: VoiceInterpretResult,
  ): string {
    const amt = p.amount ?? 0;
    const cat = p.category || 'Разное';
    switch (intent) {
      case 'create_expense':
        return `Расход ${amt} (${cat})`;
      case 'create_income':
        return `Доход ${amt}`;
      case 'wallet_deposit':
        return `Кошелёк пополнен на ${amt}`;
      case 'wallet_withdraw':
        return `С кошелька снято ${amt}`;
      case 'goal_create':
        return `Цель «${p.goal_name || p.description || '?'}» на ${amt}`;
      case 'goal_deposit':
        return `+${amt} к цели`;
      case 'goal_withdraw':
        return `−${amt} из цели`;
      case 'task_create':
        return `Задача: ${p.task_title || p.description || ''}`;
      case 'task_complete':
        return `Выполнено: ${p.task_title || p.description || ''}`;
      case 'task_cancel':
        return `Отменена: ${p.task_title || p.description || ''}`;
      case 'task_delete':
        return `Удалена задача: ${p.task_title || p.description || ''}`;
      case 'task_update':
        return `Обновлена задача: ${p.task_title || ''}`;
      case 'journal_create':
        return `Запись в дневнике`;
      case 'budget_create':
        return `Бюджет «${p.budget_name || p.description || '?'}»`;
      case 'category_create':
        return `Категория «${p.category || '?'}»`;
      case 'transaction_delete':
        return `Транзакция удалена`;
      case 'goal_delete':
        return `Цель удалена`;
      case 'wallet_balance':
        return `Баланс кошелька`;
      default:
        return '';
    }
  }

  private buildTranscriptionForm(file: UploadedAudioFile): FormData {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname || 'recording.webm',
      contentType: file.mimetype || 'audio/webm',
    });
    form.append('language', 'ru');
    return form;
  }

  private async transcribeAudio(file: UploadedAudioFile): Promise<string> {
    const ready = await normalizeAudioForWhisper(file);
    const openaiKey = normalizeEnvSecret(process.env.OPENAI_API_KEY);
    if (openaiKey) {
      try {
        return await this.transcribeWithOpenAI(ready, openaiKey);
      } catch (e: any) {
        const msg = e?.response?.data?.error?.message || e?.message;
        const groqKey = normalizeEnvSecret(process.env.GROQ_API_KEY);
        let failText = typeof msg === 'string' ? msg : '';
        if (e instanceof BadRequestException) {
          const body = e.getResponse();
          if (typeof body === 'string') {
            failText = body;
          } else if (body && typeof body === 'object' && 'message' in body) {
            const m = (body as { message: string | string[] }).message;
            failText = Array.isArray(m) ? m.join(' ') : String(m);
          }
        }
        if (groqKey) {
          const authFail = failText.includes('авторизации OpenAI');
          console.warn(
            authFail
              ? 'Voice STT: OpenAI отклонил ключ (401/403). Используется Groq. Проверьте OPENAI_API_KEY на platform.openai.com или удалите строку из .env, если достаточно Groq.'
              : `Voice STT: OpenAI недоступен (${failText || msg}). Пробуем Groq.`,
          );
        } else {
          console.warn('OpenAI transcription failed:', failText || msg);
        }
        if (groqKey) {
          try {
            return await this.transcribeWithGroq(ready, groqKey);
          } catch (gErr: any) {
            const gMsg =
              gErr?.response?.data?.error?.message ||
              gErr?.message ||
              'Groq Whisper';
            throw new BadRequestException(
              `OpenAI: ${typeof msg === 'string' ? msg : 'ошибка'}. Groq: ${String(gMsg).slice(0, 280)}`,
            );
          }
        }
        throw e instanceof BadRequestException
          ? e
          : new BadRequestException(
              typeof msg === 'string'
                ? msg
                : 'Не удалось распознать речь через OpenAI',
            );
      }
    }

    const groqKeyOnly = normalizeEnvSecret(process.env.GROQ_API_KEY);
    if (groqKeyOnly) {
      try {
        return await this.transcribeWithGroq(ready, groqKeyOnly);
      } catch (gErr: any) {
        const gMsg =
          gErr?.response?.data?.error?.message ||
          gErr?.message ||
          'ошибка Groq';
        throw new BadRequestException(String(gMsg).slice(0, 400));
      }
    }

    throw new BadRequestException(
      'Для голоса нужен OPENAI_API_KEY (транскрипция) или запасной GROQ_API_KEY. Добавьте в .env',
    );
  }

  private async transcribeWithOpenAI(
    file: UploadedAudioFile,
    apiKey: string,
  ): Promise<string> {
    const form = this.buildTranscriptionForm(file);
    const transcriptionModel =
      (process.env.OPENAI_TRANSCRIPTION_MODEL || '').trim() ||
      'gpt-4o-mini-transcribe';
    form.append('model', transcriptionModel);
    /** gpt-4o(-mini)-transcribe: только json или text; json → { text } как у whisper-1 */
    form.append('response_format', 'json');

    const headers: Record<string, string> = {
      ...form.getHeaders(),
      Authorization: `Bearer ${apiKey}`,
    };
    const openaiOrg = normalizeEnvSecret(process.env.OPENAI_ORGANIZATION);
    if (openaiOrg) {
      headers['OpenAI-Organization'] = openaiOrg;
    }

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers,
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (s) => s < 500,
      },
    );

    if (response.status === 401 || response.status === 403) {
      const apiMsg = response.data?.error?.message;
      throw new BadRequestException(
        typeof apiMsg === 'string' && apiMsg.trim().length > 0
          ? `OpenAI: ${apiMsg.trim()}`
          : 'Ошибка авторизации OpenAI (проверьте OPENAI_API_KEY и при командном аккаунте — OPENAI_ORGANIZATION в .env)',
      );
    }
    if (response.status !== 200) {
      const errMsg = response.data?.error?.message;
      throw new BadRequestException(
        typeof errMsg === 'string'
          ? errMsg
          : `OpenAI Speech-to-Text (${response.status})`,
      );
    }

    return String(response.data?.text || '').trim();
  }

  private async transcribeWithGroq(
    file: UploadedAudioFile,
    apiKey: string,
  ): Promise<string> {
    const form = this.buildTranscriptionForm(file);
    form.append('model', 'whisper-large-v3');

    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (s) => s < 500,
      },
    );

    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException(
        'Ошибка авторизации Groq (проверьте GROQ_API_KEY)',
      );
    }
    if (response.status !== 200) {
      throw new BadRequestException(
        `Распознавание речи недоступно (${response.status})`,
      );
    }

    return String(response.data?.text || '').trim();
  }

  private async buildUserContext(userId: string): Promise<{
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
  }> {
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

  private buildSystemPrompt(ctx: {
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
  }): string {
    const catalogBlock =
      ctx.categoryCatalog.length > 0
        ? ctx.categoryCatalog
            .map((c) => {
              const kindRu =
                c.kind === 'expense'
                  ? 'только расход'
                  : c.kind === 'income'
                    ? 'только доход'
                    : 'расход и доход';
              const hint = c.description
                ? ` | подсказка: ${c.description}`
                : '';
              return `«${c.name}» (${kindRu})${hint}`;
            })
            .join('\n')
        : '';
    const fallbackNames =
      ctx.categoriesSample.length > 0
        ? ctx.categoriesSample.join(', ')
        : 'ещё не было операций';
    const catLine = catalogBlock
      ? `Справочник категорий (сопоставляй траты/доходы по названию и подсказке):\n${catalogBlock}\n\nИмена из недавних операций (если нет в справочнике — можно добавить новое имя категории): ${fallbackNames}.`
      : `Категории из недавних операций: ${fallbackNames}. Пользователь может завести описания в приложении — пока справочник пуст, выбирай осмысленные короткие названия.`;
    const tasksLine =
      ctx.openTaskTitles.length > 0
        ? ctx.openTaskTitles.map((t) => `"${t}"`).join(', ')
        : '(активных задач нет)';
    const goalsLine =
      ctx.goalTitles.length > 0
        ? ctx.goalTitles.map((t) => `"${t}"`).join(', ')
        : '(целей нет)';
    return `Ты разбираешь голосовые команды для приложения Capy: финансы, кошелёк, цели, задачи, дневник, бюджеты, категории (одна или несколько операций за раз).
Валюта: ${ctx.currency}.
Календарь (для поля date транзакций и сроков, формат YYYY-MM-DD): сегодня ${ctx.today}, вчера ${ctx.yesterday}, позавчера ${ctx.dayBeforeYesterday}.
${catLine}
Активные задачи (task_complete / task_cancel / task_delete / task_update): ${tasksLine}.
Цели накопления (goal_deposit / goal_withdraw / goal_delete): ${goalsLine}.

Ответь ТОЛЬКО одним JSON-объектом без markdown.
Корень ВСЕГДА только два ключа: "operations" (массив) и "batch_reply_hint" (строка). Нельзя класть intent/amount/category на верхний уровень — даже одна операция это массив из одного элемента.

Форма:
{
  "operations": [
    {
      "intent": "create_expense" | "create_income" | "wallet_deposit" | "wallet_withdraw" | "wallet_balance" | "goal_create" | "goal_deposit" | "goal_withdraw" | "goal_delete" | "task_create" | "task_complete" | "task_cancel" | "task_delete" | "task_update" | "journal_create" | "budget_create" | "category_create" | "transaction_delete" | "unknown",
      "confidence": <0..1>,
      "amount": <число или null>,
      "category": <строка или null — для create_expense/create_income: категория; для budget_create: категория лимита (как в тратах); для category_create: имя НОВОЙ категории>,
      "description": <строка или null — детали транзакции; для journal_create можно дублировать смысл, если journal_content пуст>,
      "date": <YYYY-MM-DD или null>,
      "affect_wallet": <boolean>,
      "goal_name": <строка — цель для goal_* и goal_delete>,
      "task_title": <строка — для task_* (подсказка для поиска)>,
      "new_task_title": <строка или null — task_update: новое название>,
      "priority": "low" | "medium" | "high" | null,
      "reminder_at": <ISO datetime или null>,
      "reminder_times": <массив ISO или []>,
      "journal_content": <строка или null — journal_create: основной текст записи>,
      "journal_title": <строка или null>,
      "journal_tags": <массив строк или []>,
      "budget_name": <строка или null — название бюджета>,
      "budget_period": "weekly" | "monthly" | null,
      "category_kind": "expense" | "income" | "both" | null — только category_create,
      "delete_mode": "last_expense" | "last_income" | "last_any" | "match" | null — только transaction_delete,
      "reply_hint": <коротко по операции>
    }
  ],
  "batch_reply_hint": <коротко на всю фразу или "">
}

Пример (две траты в одной фразе — ДВА элемента в operations, не одна сумма):
{"operations":[{"intent":"create_expense","confidence":0.9,"amount":1000,"category":"Еда","description":"бургеры","date":"${ctx.today}","affect_wallet":false,"reply_hint":"−1000 еда"},{"intent":"create_expense","confidence":0.9,"amount":500,"category":"Еда","description":"кофе","date":"${ctx.today}","affect_wallet":false,"reply_hint":"−500 кофе"}],"batch_reply_hint":"Записал две траты"}

Правила:
- Несколько операций — столько же объектов в operations (траты, задачи, цели вперемешку). Не объединяй разные суммы в одну транзакцию.
- Для каждой явной траты/дохода в фразе — отдельный объект; confidence у каждого ≥0.55 если намерение ясное.
- goal_create: новая цель — amount = целевая сумма, goal_name, опционально date как дата цели.
- goal_deposit / goal_withdraw: amount — сумма, goal_name (или по смыслу из фразы).
- task_create: task_title обязателен (или вынь из фразы в description+task_title), priority, date = срок (день), reminder_at / reminder_times в ISO (например завтра 09:00 по локальному смыслу — оцени UTC+3 по умолчанию для РФ).
- task_complete / task_cancel: task_title — сопоставь с активными задачами.
- create_expense: поле category — выбери категорию по смыслу фразы и подсказкам справочника (еда/транспорт/жильё и т.д.). Если фраза явно про подкатегорию («кофе», «такси») — отнеси к родительской категории из справочника по подсказке description. description — конкретика («Starbucks», «Яндекс Такси»). date — день траты.
- create_income: то же: category по смыслу (зарплата, фриланс, подарок…), description — от кого/за что, date — день поступления.
- wallet_deposit / wallet_withdraw — без category/description или null.
- wallet_balance: запрос баланса кошелька («сколько на кошельке») — amount null, reply_hint с формулировкой ответа.
- goal_delete: goal_name по списку целей; amount null.
- task_delete: удали задачу — task_title; amount null.
- task_update: изменить задачу — task_title (какую найти), опционально new_task_title, date (новый срок), priority, reminder_at/reminder_times; хотя бы одно поле кроме task_title.
- journal_create: journal_content — основной текст; journal_title, journal_tags опционально; date — день записи (по умолчанию ${ctx.today}).
- budget_create: budget_name, amount — лимит, category — категория трат под лимит, budget_period weekly|monthly.
- category_create: category — имя; category_kind expense|income|both; опционально description как подсказка для справочника.
- transaction_delete: delete_mode: last_expense / last_income / last_any — «удали последнюю трату» и т.п.; match — уточни amount и/или category и/или description для поиска последней подходящей транзакции (только расход/доход, не внутренние deposit/withdraw кошелька). amount при match — сумма для сопоставления.
- Суммы: тысяча=1000, полторы тысячи=1500. Не выдумывай числа.
- Несколько разных операций в одной фразе — отдельные объекты в operations.`;
  }

  /**
   * LLM часто занижает confidence (и для коротких «еда 1000», и для длинных рассказов со суммами).
   * Если уже извлечены исполняемое намерение и положительная сумма — поднимаем пол до порога.
   */
  private applyStructuralConfidenceFloor(
    interpreted: VoiceInterpretResult,
    transcript: string,
  ): VoiceInterpretResult {
    if (interpreted.intent === 'unknown') {
      return interpreted;
    }

    const needsAmount: VoiceIntent[] = [
      'create_expense',
      'create_income',
      'wallet_deposit',
      'wallet_withdraw',
      'goal_create',
      'goal_deposit',
      'goal_withdraw',
    ];
    if (
      needsAmount.includes(interpreted.intent) &&
      (!interpreted.amount || interpreted.amount <= 0)
    ) {
      return interpreted;
    }

    const actionable: VoiceIntent[] = [
      'create_expense',
      'create_income',
      'wallet_deposit',
      'wallet_withdraw',
      'wallet_balance',
      'goal_create',
      'goal_deposit',
      'goal_withdraw',
      'goal_delete',
      'task_create',
      'task_complete',
      'task_cancel',
      'task_delete',
      'task_update',
      'journal_create',
      'budget_create',
      'category_create',
      'transaction_delete',
    ];
    if (!actionable.includes(interpreted.intent)) {
      return interpreted;
    }

    const t = transcript.trim();
    const hasDigit = /\d/.test(t);
    const hasCategoryOrDesc = Boolean(
      interpreted.category?.trim() ||
        interpreted.description?.trim() ||
        interpreted.journal_content?.trim(),
    );
    const hasTaskGoal = Boolean(
      interpreted.task_title?.trim() || interpreted.goal_name?.trim(),
    );
    const wordCount = t.split(/\s+/).filter(Boolean).length;

    const hasCue =
      hasDigit ||
      hasCategoryOrDesc ||
      hasTaskGoal ||
      interpreted.intent === 'wallet_balance' ||
      (interpreted.intent === 'transaction_delete' &&
        Boolean(interpreted.delete_mode));
    const withinNormalVoiceLength = wordCount <= 80 && t.length <= 1500;

    if (!hasCue || !withinNormalVoiceLength) {
      return interpreted;
    }

    const floor = 0.55;
    if (interpreted.confidence >= floor) {
      return interpreted;
    }
    return { ...interpreted, confidence: floor };
  }

  private applyStructuralConfidenceFloorBatch(
    batch: VoiceInterpretBatch,
    transcript: string,
  ): VoiceInterpretBatch {
    return {
      ...batch,
      items: batch.items.map((item) =>
        this.applyStructuralConfidenceFloor(item, transcript),
      ),
    };
  }

  private async interpretTranscript(
    transcript: string,
    ctx: Awaited<ReturnType<AssistantService['buildUserContext']>>,
  ): Promise<VoiceInterpretBatch> {
    const system = this.buildSystemPrompt(ctx);
    const userMsg = `Текст с микрофона:\n${transcript}`;

    let raw: string;
    try {
      raw = await this.completeInterpretOpenAI(userMsg, system);
    } catch {
      try {
        raw = await this.completeInterpretGigaChat(userMsg, system);
      } catch {
        try {
          raw = await this.completeInterpretGemini(userMsg, system);
        } catch {
          try {
            raw = await this.completeInterpretDeepSeek(userMsg, system);
          } catch {
            try {
              raw = await this.completeInterpretGroq(userMsg, system);
            } catch {
              throw new Error('ALL_AI_FAILED');
            }
          }
        }
      }
    }

    return this.safeParseInterpret(raw, ctx.today);
  }

  private parseOneVoiceOperation(
    data: Record<string, unknown>,
    today: string,
  ): VoiceInterpretResult {
    const intentRaw = String(data.intent || 'unknown');
    const allowed: VoiceIntent[] = [
      'create_expense',
      'create_income',
      'wallet_deposit',
      'wallet_withdraw',
      'wallet_balance',
      'goal_create',
      'goal_deposit',
      'goal_withdraw',
      'goal_delete',
      'task_create',
      'task_complete',
      'task_cancel',
      'task_delete',
      'task_update',
      'journal_create',
      'budget_create',
      'category_create',
      'transaction_delete',
      'unknown',
    ];
    const intent = allowed.includes(intentRaw as VoiceIntent)
      ? (intentRaw as VoiceIntent)
      : 'unknown';

    const confidence = Math.min(1, Math.max(0, Number(data.confidence) || 0));
    let amount: number | null =
      typeof data.amount === 'number' && !Number.isNaN(data.amount)
        ? data.amount
        : null;
    if (amount === null && data.amount != null) {
      const n = parseFloat(String(data.amount).replace(',', '.'));
      amount = !Number.isNaN(n) ? n : null;
    }
    if (amount !== null) {
      amount = Math.round(amount * 100) / 100;
    }

    const category =
      data.category != null && String(data.category).trim()
        ? String(data.category).trim()
        : null;
    const description =
      data.description != null && String(data.description).trim()
        ? String(data.description).trim()
        : null;

    let date =
      data.date != null && String(data.date).trim()
        ? String(data.date).trim().slice(0, 10)
        : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      date = today;
    }

    const affect_wallet = Boolean(data.affect_wallet);
    const reply_hint =
      data.reply_hint != null ? String(data.reply_hint).trim() : '';

    const goal_name =
      data.goal_name != null && String(data.goal_name).trim()
        ? String(data.goal_name).trim()
        : null;
    const task_title =
      data.task_title != null && String(data.task_title).trim()
        ? String(data.task_title).trim()
        : null;
    const pr = data.priority;
    let priority: 'low' | 'medium' | 'high' | null = null;
    if (pr === 'low' || pr === 'medium' || pr === 'high') {
      priority = pr;
    }
    const reminder_at =
      data.reminder_at != null && String(data.reminder_at).trim()
        ? String(data.reminder_at).trim()
        : null;
    let reminder_times: string[] | null = null;
    if (Array.isArray(data.reminder_times)) {
      const arr = data.reminder_times
        .map((x) => String(x).trim())
        .filter(Boolean);
      reminder_times = arr.length > 0 ? arr : null;
    }

    const journal_content =
      data.journal_content != null && String(data.journal_content).trim()
        ? String(data.journal_content).trim()
        : null;
    const journal_title =
      data.journal_title != null && String(data.journal_title).trim()
        ? String(data.journal_title).trim()
        : null;
    let journal_tags: string[] | null = null;
    if (Array.isArray(data.journal_tags)) {
      const arr = data.journal_tags
        .map((x) => String(x).trim())
        .filter(Boolean);
      journal_tags = arr.length > 0 ? arr : null;
    }

    const budget_name =
      data.budget_name != null && String(data.budget_name).trim()
        ? String(data.budget_name).trim()
        : null;
    const bp = data.budget_period;
    const budget_period = bp === 'weekly' || bp === 'monthly' ? bp : null;

    const ck = data.category_kind;
    const category_kind =
      ck === 'expense' || ck === 'income' || ck === 'both' ? ck : null;

    const dm = data.delete_mode;
    const delete_mode: VoiceTransactionDeleteMode | null =
      dm === 'last_expense' ||
      dm === 'last_income' ||
      dm === 'last_any' ||
      dm === 'match'
        ? dm
        : null;

    const new_task_title =
      data.new_task_title != null && String(data.new_task_title).trim()
        ? String(data.new_task_title).trim()
        : null;

    return {
      intent,
      confidence,
      amount,
      category,
      description,
      date,
      affect_wallet,
      reply_hint,
      goal_name,
      task_title,
      priority,
      reminder_at,
      reminder_times,
      journal_content,
      journal_title,
      journal_tags,
      budget_name,
      budget_period,
      category_kind,
      delete_mode,
      new_task_title,
    };
  }

  private safeParseInterpret(raw: string, today: string): VoiceInterpretBatch {
    const unknownBatch = (reply: string): VoiceInterpretBatch => ({
      items: [
        {
          intent: 'unknown',
          confidence: 0,
          amount: null,
          category: null,
          description: null,
          date: today,
          affect_wallet: false,
          reply_hint: reply,
        },
      ],
      batch_reply_hint: '',
    });

    let jsonStr: string;
    try {
      jsonStr = this.extractJsonObject(raw);
    } catch {
      return unknownBatch('Не удалось разобрать ответ ИИ (нет JSON)');
    }

    let data: unknown;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return unknownBatch('Не удалось разобрать ответ ИИ');
    }

    /** Модели иногда отдают массив операций без обёртки { operations: [...] } */
    if (Array.isArray(data)) {
      const items: VoiceInterpretResult[] = [];
      for (const el of data) {
        if (el && typeof el === 'object' && !Array.isArray(el)) {
          items.push(
            this.parseOneVoiceOperation(el as Record<string, unknown>, today),
          );
        }
      }
      if (items.length === 0) {
        return unknownBatch('Некорректный массив операций');
      }
      return { items, batch_reply_hint: '' };
    }

    if (data && typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      const batch_reply_hint =
        obj.batch_reply_hint != null ? String(obj.batch_reply_hint).trim() : '';

      const opsRaw = obj.operations ?? obj.items;
      if (Array.isArray(opsRaw)) {
        if (opsRaw.length === 0) {
          return unknownBatch('Пустой список operations');
        }
        const items: VoiceInterpretResult[] = [];
        for (const el of opsRaw) {
          if (el && typeof el === 'object' && !Array.isArray(el)) {
            items.push(
              this.parseOneVoiceOperation(el as Record<string, unknown>, today),
            );
          }
        }
        if (items.length === 0) {
          return unknownBatch('Некорректные элементы operations');
        }
        return { items, batch_reply_hint };
      }

      /** Одна операция ошибочно положена как объект вместо массива */
      if (
        opsRaw &&
        typeof opsRaw === 'object' &&
        !Array.isArray(opsRaw) &&
        typeof (opsRaw as Record<string, unknown>).intent === 'string'
      ) {
        return {
          items: [
            this.parseOneVoiceOperation(
              opsRaw as Record<string, unknown>,
              today,
            ),
          ],
          batch_reply_hint,
        };
      }

      return {
        items: [this.parseOneVoiceOperation(obj, today)],
        batch_reply_hint,
      };
    }

    return unknownBatch('Не удалось разобрать ответ ИИ');
  }

  private extractJsonObject(raw: string): string {
    const cleaned = raw.replace(/^\uFEFF/, '').trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1].trim() : cleaned;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new Error('No JSON object');
    }
    return candidate.slice(start, end + 1);
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

  private async executeIntent(
    p: VoiceInterpretResult,
    userMongoId: string,
  ): Promise<{ message: string; transactionId?: string }> {
    const date = p.date || new Date().toISOString().split('T')[0];

    if (p.intent === 'wallet_balance') {
      const user = await this.usersService.findById(userMongoId);
      const cur = user?.currency || 'RUB';
      const pig = await this.piggyBankService.findOneByUser(userMongoId);
      const bal = pig?.amount ?? 0;
      return {
        message: p.reply_hint?.trim() || `На кошельке ${bal} ${cur}`,
      };
    }

    if (p.intent === 'journal_create') {
      const content = (p.journal_content || p.description || '').trim();
      if (!content) {
        throw new BadRequestException('Пустой текст записи');
      }
      await this.journalService.create({
        userId: userMongoId,
        content,
        title: p.journal_title?.trim() || undefined,
        tags: p.journal_tags?.length ? p.journal_tags : undefined,
        date: p.date?.trim() ? `${p.date.trim()}T12:00:00.000Z` : undefined,
      });
      return {
        message: p.reply_hint || 'Запись в дневнике сохранена',
      };
    }

    if (p.intent === 'budget_create') {
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

    if (p.intent === 'category_create') {
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

    if (p.intent === 'transaction_delete') {
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

    if (p.intent === 'goal_delete') {
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

    if (p.intent === 'task_delete') {
      const hint = (p.task_title || p.description || '').trim();
      const task = await this.tasksService.findOpenByTitleHint(
        userMongoId,
        hint,
      );
      if (!task) {
        throw new BadRequestException('Активная задача не найдена');
      }
      await this.tasksService.remove(userMongoId, String(task._id));
      return {
        message: p.reply_hint || `Задача «${task.title}» удалена`,
      };
    }

    if (p.intent === 'task_update') {
      const hint = (p.task_title || p.description || '').trim();
      const task = await this.tasksService.findOpenByTitleHint(
        userMongoId,
        hint,
      );
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

    if (p.intent === 'task_create') {
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

    if (p.intent === 'task_complete') {
      const hint = (p.task_title || p.description || '').trim();
      const task = await this.tasksService.findOpenByTitleHint(
        userMongoId,
        hint,
      );
      if (!task) {
        throw new BadRequestException('Активная задача не найдена');
      }
      await this.tasksService.complete(userMongoId, String(task._id));
      return {
        message: p.reply_hint || `Задача «${task.title}» выполнена`,
      };
    }

    if (p.intent === 'task_cancel') {
      const hint = (p.task_title || p.description || '').trim();
      const task = await this.tasksService.findOpenByTitleHint(
        userMongoId,
        hint,
      );
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

    if (p.intent === 'goal_create') {
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

    if (p.intent === 'goal_deposit') {
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

    if (p.intent === 'goal_withdraw') {
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

    const amount = p.amount!;
    if (amount == null || amount <= 0) {
      throw new BadRequestException('Сумма не указана');
    }

    if (p.intent === 'wallet_deposit') {
      await this.piggyBankService.deposit(userMongoId, amount);
      return {
        message: p.reply_hint || `Пополнил кошелёк на ${amount}`,
      };
    }

    if (p.intent === 'wallet_withdraw') {
      const ok = await this.piggyBankService.withdraw(userMongoId, amount);
      if (!ok) {
        throw new BadRequestException(
          'Недостаточно средств на кошельке или кошелёк не найден',
        );
      }
      return {
        message: p.reply_hint || `Снял с кошелька ${amount}`,
      };
    }

    if (p.intent === 'create_expense') {
      const category = await this.transactionCategoriesService.resolveForVoice(
        userMongoId,
        'expense',
        p.category,
      );
      let desc = p.description || '';
      if (p.affect_wallet) {
        desc = `${desc ? desc + ' ' : ''}(списано с кошелька)`;
      }
      const tx = await this.transactionsService.create(userMongoId, {
        type: 'expense',
        amount,
        category,
        description: desc || undefined,
        date: `${date}T12:00:00.000Z`,
      });
      if (p.affect_wallet) {
        const w = await this.piggyBankService.withdraw(userMongoId, amount);
        if (!w) {
          throw new BadRequestException(
            'Транзакция создана, но не удалось списать с кошелька (недостаточно средств)',
          );
        }
      }
      return {
        message:
          p.reply_hint ||
          `Записал расход ${amount} ${category}${p.affect_wallet ? ', списано с кошелька' : ''}`,
        transactionId: String((tx as any)._id),
      };
    }

    if (p.intent === 'create_income') {
      const category = await this.transactionCategoriesService.resolveForVoice(
        userMongoId,
        'income',
        p.category,
      );
      let desc = p.description || '';
      if (p.affect_wallet) {
        desc = `${desc ? desc + ' ' : ''}(пополнено в кошелек)`;
      }
      const tx = await this.transactionsService.create(userMongoId, {
        type: 'income',
        amount,
        category,
        description: desc || undefined,
        date: `${date}T12:00:00.000Z`,
      });
      if (p.affect_wallet) {
        await this.piggyBankService.deposit(userMongoId, amount);
      }
      return {
        message:
          p.reply_hint ||
          `Записал доход ${amount}${p.affect_wallet ? ', пополнен кошелёк' : ''}`,
        transactionId: String((tx as any)._id),
      };
    }

    throw new BadRequestException('Команда не выполнена');
  }

  // --- LLM providers (compact, interpret-only) ---

  private async completeInterpretOpenAI(
    userMessage: string,
    systemMessage: string,
  ): Promise<string> {
    const openaiKey = normalizeEnvSecret(process.env.OPENAI_API_KEY);
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    };
    const openaiOrg = normalizeEnvSecret(process.env.OPENAI_ORGANIZATION);
    if (openaiOrg) {
      headers['OpenAI-Organization'] = openaiOrg;
    }
    /** Разбор текста в JSON: по умолчанию gpt-4o-mini (быстрее). gpt-5.*: reasoning_effort none. Иначе: OPENAI_INTERPRET_MODEL */
    const interpretModel =
      (process.env.OPENAI_INTERPRET_MODEL || '').trim() || 'gpt-4o-mini';
    const body: Record<string, unknown> = {
      model: interpretModel,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    };
    if (interpretModel.startsWith('gpt-5')) {
      body.reasoning_effort = 'none';
      body.verbosity = 'low';
    }
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      body,
      {
        headers,
        timeout: 60000,
        validateStatus: (status) => status < 500,
      },
    );
    if (response.status !== 200) {
      const msg = response.data?.error?.message;
      throw new Error(
        typeof msg === 'string' && msg.trim()
          ? `OpenAI: ${msg.trim()}`
          : `OpenAI ${response.status}`,
      );
    }
    const content = response.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('OpenAI empty response');
    }
    return content.trim();
  }

  private async completeInterpretGroq(
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
        temperature: 0.2,
        max_tokens: 2000,
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
    if (response.status !== 200) {
      throw new Error(`Groq ${response.status}`);
    }
    return response.data.choices[0].message.content.trim();
  }

  private async completeInterpretDeepSeek(
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
        temperature: 0.2,
        max_tokens: 2000,
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
    if (response.status !== 200) {
      throw new Error(`DeepSeek ${response.status}`);
    }
    return response.data.choices[0].message.content.trim();
  }

  private async completeInterpretGemini(
    userMessage: string,
    systemMessage: string,
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    const model = 'gemini-1.5-flash';
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [{ text: `${systemMessage}\n\n${userMessage}` }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      },
    );
    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini empty');
    }
    return text.trim();
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
    let accessToken = (this as any)._gigaInterpretToken;
    let tokenExpiry = (this as any)._gigaInterpretTokenExpiry;

    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    const agent = new https.Agent({ rejectUnauthorized: false });
    let encodedKey = apiKey;
    if (apiKey.includes(':') && !apiKey.startsWith('Basic ')) {
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
    (this as any)._gigaInterpretToken = accessToken;
    (this as any)._gigaInterpretTokenExpiry = tokenExpiry;
    return accessToken;
  }

  private async completeInterpretGigaChat(
    userMessage: string,
    systemMessage: string,
  ): Promise<string> {
    const apiKey = process.env.GIGACHAT_API_KEY;
    if (!apiKey) {
      throw new Error('GigaChat API key not configured');
    }
    const accessToken = await this.getGigaChatAccessToken(apiKey);
    const agent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat:latest',
        messages: this.prepareGigaChatMessages(userMessage, systemMessage),
        max_tokens: 2000,
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
        httpsAgent: agent,
      },
    );
    return response.data.choices[0].message.content.trim();
  }
}
