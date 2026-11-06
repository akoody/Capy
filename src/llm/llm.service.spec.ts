import { Logger } from '@nestjs/common';
import { LlmService } from './llm.service';
import {
  ChatPrompt,
  CompletionOptions,
  DEFAULT_COMPLETION,
  LlmProvider,
  LlmUnavailableError,
} from './llm.types';

const prompt = { system: 'sys', user: 'hi' };

function provider(
  name: string,
  behaviour: 'ok' | 'fail' | 'unconfigured',
): jest.Mocked<LlmProvider> {
  return {
    name,
    isConfigured: jest.fn(() => behaviour !== 'unconfigured'),
    complete: jest.fn((_prompt: ChatPrompt, _options: CompletionOptions) =>
      behaviour === 'ok'
        ? Promise.resolve(`answer from ${name}`)
        : Promise.reject(new Error(`${name} down`)),
    ),
  };
}

describe('LlmService', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation());
  afterAll(() => jest.restoreAllMocks());

  it('returns the first successful answer and stops there', async () => {
    const first = provider('A', 'ok');
    const second = provider('B', 'ok');
    const llm = new LlmService([first, second]);

    await expect(llm.complete(prompt)).resolves.toBe('answer from A');
    expect(first.complete).toHaveBeenCalledWith(prompt, DEFAULT_COMPLETION);
    expect(second.complete).not.toHaveBeenCalled();
  });

  it('falls back in order and skips providers without keys', async () => {
    const a = provider('A', 'fail');
    const b = provider('B', 'unconfigured');
    const c = provider('C', 'ok');
    const llm = new LlmService([a, b, c]);

    await expect(llm.complete(prompt)).resolves.toBe('answer from C');
    expect(b.complete).not.toHaveBeenCalled();
  });

  it('reports every failure when nobody answers', async () => {
    const llm = new LlmService([provider('A', 'fail'), provider('B', 'fail')]);
    const error = await llm.complete(prompt).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect((error as LlmUnavailableError).failures).toEqual([
      { provider: 'A', reason: 'A down' },
      { provider: 'B', reason: 'B down' },
    ]);
  });

  it('says so when no provider is configured', async () => {
    const llm = new LlmService([provider('A', 'unconfigured')]);
    await expect(llm.complete(prompt)).rejects.toThrow(
      'No LLM provider is configured',
    );
  });
});
