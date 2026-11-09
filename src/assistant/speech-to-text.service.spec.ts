import { BadRequestException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { AppEnv } from '../config/env.schema';
import { SpeechToTextService } from './speech-to-text.service';
import type { UploadedAudioFile } from './uploaded-audio-file';

jest.mock('./normalize-audio-for-whisper', () => ({
  normalizeAudioForWhisper: (file: unknown) => Promise.resolve(file),
}));

const audio = {
  buffer: Buffer.from('voice'),
  mimetype: 'audio/webm',
  originalname: 'a.webm',
} as UploadedAudioFile;

const service = (env: Record<string, string>) =>
  new SpeechToTextService({
    get: (key: string) => env[key],
  } as unknown as ConfigService<AppEnv, true>);

describe('SpeechToTextService', () => {
  let post: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    post = jest.spyOn(axios, 'post');
    warn = jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  const urls = () => post.mock.calls.map(([url]) => url as string);

  it('uses OpenAI when it is configured', async () => {
    post.mockResolvedValue({ status: 200, data: { text: ' привет ' } });
    await expect(
      service({ OPENAI_API_KEY: 'k' }).transcribe(audio),
    ).resolves.toBe('привет');
    expect(urls()[0]).toContain('api.openai.com');
  });

  it('falls back to Groq when OpenAI fails', async () => {
    post
      .mockResolvedValueOnce({ status: 401, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { text: 'запасной' } });

    await expect(
      service({ OPENAI_API_KEY: 'k', GROQ_API_KEY: 'g' }).transcribe(audio),
    ).resolves.toBe('запасной');
    expect(urls()[1]).toContain('api.groq.com');
    expect(warn).toHaveBeenCalled();
  });

  it('uses Groq alone when only its key is set', async () => {
    post.mockResolvedValue({ status: 200, data: { text: 'ok' } });
    await service({ GROQ_API_KEY: 'g' }).transcribe(audio);
    expect(urls()).toHaveLength(1);
    expect(urls()[0]).toContain('api.groq.com');
  });

  it('explains what to configure when no provider is available', async () => {
    await expect(service({}).transcribe(audio)).rejects.toThrow(
      BadRequestException,
    );
    expect(post).not.toHaveBeenCalled();
  });
});
