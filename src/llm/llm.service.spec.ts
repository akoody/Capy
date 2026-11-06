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
    const llm = new LlmService({ analysis: [first, second], interpret: [] });

    await expect(llm.complete(prompt)).resolves.toBe('answer from A');
    expect(first.complete).toHaveBeenCalledWith(prompt, DEFAULT_COMPLETION);
    expect(second.complete).not.toHaveBeenCalled();
  });

  it('falls back in order and skips providers without keys', async () => {
    const a = provider('A', 'fail');
    const b = provider('B', 'unconfigured');
    const c = provider('C', 'ok');
    const llm = new LlmService({ analysis: [a, b, c], interpret: [] });

    await expect(llm.complete(prompt)).resolves.toBe('answer from C');
    expect(b.complete).not.toHaveBeenCalled();
  });

  it('reports every failure when nobody answers', async () => {
    const llm = new LlmService({
      analysis: [provider('A', 'fail'), provider('B', 'fail')],
      interpret: [],
    });
    const error = await llm.complete(prompt).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect((error as LlmUnavailableError).failures).toEqual([
      { provider: 'A', reason: 'A down' },
      { provider: 'B', reason: 'B down' },
    ]);
  });

  it('uses the chain for the requested purpose', async () => {
    const analysis = provider('Analysis', 'ok');
    const interpret = provider('Interpret', 'ok');
    const llm = new LlmService({
      analysis: [analysis],
      interpret: [interpret],
    });

    await expect(
      llm.complete(prompt, { temperature: 0.2, maxTokens: 10 }, 'interpret'),
    ).resolves.toBe('answer from Interpret');
    expect(analysis.complete).not.toHaveBeenCalled();
  });

  it('says so when no provider is configured', async () => {
    const llm = new LlmService({
      analysis: [provider('A', 'unconfigured')],
      interpret: [],
    });
    await expect(llm.complete(prompt)).rejects.toThrow(
      'No LLM provider is configured',
    );
  });
});
