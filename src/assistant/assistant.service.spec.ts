import { BadRequestException } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { LlmUnavailableError } from '../llm/llm.types';
import type { LlmService } from '../llm/llm.service';
import type { SpeechToTextService } from './speech-to-text.service';
import type { UsersService } from '../users/users.service';
import type { VoiceCommandExecutor } from './voice-command-executor.service';
import type { VoiceContextService } from './voice-context.service';
import type { UploadedAudioFile } from './uploaded-audio-file';

const audio = {
  buffer: Buffer.from('voice'),
  mimetype: 'audio/webm',
} as UploadedAudioFile;

const op = (amount: number) => ({
  intent: 'create_expense',
  confidence: 0.95,
  amount,
  category: 'Еда',
});

function setup({
  transcript = 'еда 100',
  answer = JSON.stringify({ operations: [op(100)] }),
}: { transcript?: string; answer?: string | Error } = {}) {
  const users = {
    checkVoiceCommandLimit: jest.fn().mockResolvedValue(undefined),
    recordVoiceCommandRequest: jest.fn().mockResolvedValue(undefined),
  };
  const executor = {
    execute: jest
      .fn()
      .mockResolvedValue({ message: 'ok', transactionId: 'tx1' }),
  };
  const llm = {
    complete:
      answer instanceof Error
        ? jest.fn().mockRejectedValue(answer)
        : jest.fn().mockResolvedValue(answer),
  };
  const service = new AssistantService(
    users as unknown as UsersService,
    {
      transcribe: jest.fn().mockResolvedValue(transcript),
    } as unknown as SpeechToTextService,
    {
      build: jest.fn().mockResolvedValue({
        currency: 'RUB',
        categoriesSample: [],
        today: '2026-11-09',
        yesterday: '2026-11-08',
        dayBeforeYesterday: '2026-11-07',
        openTaskTitles: [],
        goalTitles: [],
        categoryCatalog: [],
      }),
    } as unknown as VoiceContextService,
    executor as unknown as VoiceCommandExecutor,
    llm as unknown as LlmService,
  );
  return { service, users, executor, llm };
}

describe('AssistantService pipeline', () => {
  it('rejects non-audio files before calling paid services', async () => {
    const { service, llm } = setup();
    await expect(
      service.processVoiceCommand({ ...audio, mimetype: 'image/png' }, 'u1'),
    ).rejects.toThrow(BadRequestException);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('stops at the voice limit', async () => {
    const { service, users, llm } = setup();
    users.checkVoiceCommandLimit.mockRejectedValue(
      new BadRequestException('limit'),
    );
    await expect(service.processVoiceCommand(audio, 'u1')).rejects.toThrow(
      'limit',
    );
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('does not interpret empty speech', async () => {
    const { service, llm } = setup({ transcript: '  ' });
    const result = await service.processVoiceCommand(audio, 'u1');
    expect(result.executed).toBe(false);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('asks the interpret chain for JSON and executes the operation', async () => {
    const { service, llm, executor, users } = setup();

    const result = await service.processVoiceCommand(audio, 'u1');

    expect(llm.complete).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.stringContaining('еда 100') }),
      { temperature: 0.2, maxTokens: 2000, jsonObject: true },
      'interpret',
    );
    expect(executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'create_expense', amount: 100 }),
      'u1',
    );
    expect(users.recordVoiceCommandRequest).toHaveBeenCalledWith('u1');
    expect(result).toMatchObject({
      executed: true,
      transactionId: 'tx1',
      successCount: 1,
    });
  });

  it('reports each failed operation and keeps the successful ones', async () => {
    const { service, executor } = setup({
      answer: JSON.stringify({ operations: [op(100), op(200)] }),
    });
    executor.execute
      .mockResolvedValueOnce({ message: 'первая' })
      .mockRejectedValueOnce(new BadRequestException('Недостаточно средств'));

    const result = await service.processVoiceCommand(audio, 'u1');

    expect(result.successCount).toBe(1);
    expect(result.operationsAttempted).toBe(2);
    expect(result.message).toContain('первая');
    expect(result.message).toContain('Недостаточно средств');
  });

  it('answers without executing when the model is unavailable', async () => {
    const { service, executor } = setup({
      answer: new LlmUnavailableError([]),
    });
    const result = await service.processVoiceCommand(audio, 'u1');
    expect(result.executed).toBe(false);
    expect(result.message).toContain('AI-сервисы недоступны');
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('does not execute an unclear command', async () => {
    const { service, executor } = setup({
      answer: JSON.stringify({
        operations: [{ intent: 'unknown', confidence: 0.2 }],
      }),
    });
    const result = await service.processVoiceCommand(audio, 'u1');
    expect(result.executed).toBe(false);
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
