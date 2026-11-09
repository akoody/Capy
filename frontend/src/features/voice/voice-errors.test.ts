import { AxiosError, type AxiosResponse } from 'axios';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { voiceErrorText } from './voice-errors';

const t = ((key: string) => key) as unknown as TFunction;

const withResponse = (status: number, data: unknown) =>
  new AxiosError('failed', undefined, undefined, undefined, {
    status,
    data,
  } as AxiosResponse);

describe('voiceErrorText', () => {
  it('shows validation messages from the API', () => {
    expect(voiceErrorText(withResponse(400, { message: 'Пустая запись' }), t)).toBe('Пустая запись');
    expect(voiceErrorText(withResponse(400, { message: ['a', 'b'] }), t)).toBe('a; b');
  });

  it('never exposes server internals', () => {
    expect(voiceErrorText(withResponse(500, { message: 'pm2 is down' }), t)).toBe('voice_request_failed');
    expect(voiceErrorText(withResponse(502, '<html>nginx</html>'), t)).toBe('voice_request_failed');
    expect(voiceErrorText(withResponse(401, { message: 'bad token' }), t)).toBe('voice_request_failed');
  });

  it('maps connection and size problems', () => {
    expect(voiceErrorText(new AxiosError('Network Error'), t)).toBe('voice_no_connection');
    expect(voiceErrorText(withResponse(413, ''), t)).toBe('voice_too_large');
    expect(voiceErrorText(new Error('boom'), t)).toBe('voice_request_failed');
  });
});
