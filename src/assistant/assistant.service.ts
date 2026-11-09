import { BadRequestException, Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { LlmUnavailableError } from '../llm/llm.types';
import { UsersService } from '../users/users.service';
import { SpeechToTextService } from './speech-to-text.service';
import type { UploadedAudioFile } from './uploaded-audio-file';
import { VoiceCommandExecutor } from './voice-command-executor.service';
import {
  VoiceContextService,
  type VoiceUserContext,
} from './voice-context.service';
import {
  applyStructuralConfidenceFloorBatch,
  isVoiceItemExecutable,
  opShortLabel,
  safeParseInterpret,
  voiceItemNeedsPositiveAmount,
} from './voice-interpretation';
import type {
  VoiceCommandResponseDto,
  VoiceInterpretBatch,
} from './voice-intent.types';
import { buildSystemPrompt } from './voice-prompt';

/** Конвейер голосовой команды: распознать, разобрать, проверить, выполнить. */
@Injectable()
export class AssistantService {
  constructor(
    private readonly usersService: UsersService,
    private readonly speechToText: SpeechToTextService,
    private readonly context: VoiceContextService,
    private readonly executor: VoiceCommandExecutor,
    private readonly llm: LlmService,
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

    const transcript = await this.speechToText.transcribe(file);
    if (!transcript.trim()) {
      return {
        transcript: '',
        intent: 'unknown',
        confidence: 0,
        message: 'Не удалось распознать речь. Попробуйте ещё раз.',
        executed: false,
      };
    }

    const context = await this.context.build(userId);
    let batch: VoiceInterpretBatch;
    try {
      batch = await this.interpretTranscript(transcript, context);
      batch = applyStructuralConfidenceFloorBatch(batch, transcript);
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

    const ready = items.filter((i) => isVoiceItemExecutable(i));

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
          voiceItemNeedsPositiveAmount(i) &&
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
        const execResult = await this.executor.execute(op, userId);
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
        parts.push(`Не записано (${opShortLabel(op)}): ${short}`);
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

  private async interpretTranscript(
    transcript: string,
    ctx: VoiceUserContext,
  ): Promise<VoiceInterpretBatch> {
    const system = buildSystemPrompt(ctx);
    const userMsg = `Текст с микрофона:\n${transcript}`;

    let raw: string;
    try {
      raw = await this.llm.complete(
        { system, user: userMsg },
        { temperature: 0.2, maxTokens: 2000, jsonObject: true },
        'interpret',
      );
    } catch (error) {
      if (error instanceof LlmUnavailableError) {
        throw new Error('ALL_AI_FAILED');
      }
      throw error;
    }

    return safeParseInterpret(raw, ctx.today);
  }
}
