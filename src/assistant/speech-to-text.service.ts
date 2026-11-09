import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import type { AppEnv } from '../config/env.schema';
import { normalizeAudioForWhisper } from './normalize-audio-for-whisper';
import type { UploadedAudioFile } from './uploaded-audio-file';

/** Сообщение об ошибке от axios/HTTP API или обычного Error. */
function errorMessage(error: unknown): string | undefined {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? error.message;
  }
  return error instanceof Error ? error.message : undefined;
}

interface TranscriptionResponse {
  text?: string;
  error?: { message?: string };
}

/** Распознавание речи: OpenAI, при сбое запасной Groq Whisper. */
@Injectable()
export class SpeechToTextService {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  private buildTranscriptionForm(file: UploadedAudioFile): FormData {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname || 'recording.webm',
      contentType: file.mimetype || 'audio/webm',
    });
    form.append('language', 'ru');
    return form;
  }

  async transcribe(file: UploadedAudioFile): Promise<string> {
    const ready = await normalizeAudioForWhisper(file);
    const openaiKey = this.config.get('OPENAI_API_KEY', { infer: true });
    if (openaiKey) {
      try {
        return await this.transcribeWithOpenAI(ready, openaiKey);
      } catch (e: unknown) {
        const msg = errorMessage(e);
        const groqKey = this.config.get('GROQ_API_KEY', { infer: true });
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
          } catch (gErr: unknown) {
            const gMsg = errorMessage(gErr) || 'Groq Whisper';
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

    const groqKeyOnly = this.config.get('GROQ_API_KEY', { infer: true });
    if (groqKeyOnly) {
      try {
        return await this.transcribeWithGroq(ready, groqKeyOnly);
      } catch (gErr: unknown) {
        const gMsg = errorMessage(gErr) || 'ошибка Groq';
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
      this.config.get('OPENAI_TRANSCRIPTION_MODEL', { infer: true }) ??
      'gpt-4o-mini-transcribe';
    form.append('model', transcriptionModel);
    /** gpt-4o(-mini)-transcribe: только json или text; json → { text } как у whisper-1 */
    form.append('response_format', 'json');

    const headers: Record<string, string> = {
      ...form.getHeaders(),
      Authorization: `Bearer ${apiKey}`,
    };
    const openaiOrg = this.config.get('OPENAI_ORGANIZATION', { infer: true });
    if (openaiOrg) {
      headers['OpenAI-Organization'] = openaiOrg;
    }

    const response = await axios.post<TranscriptionResponse>(
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

    const response = await axios.post<TranscriptionResponse>(
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
}
