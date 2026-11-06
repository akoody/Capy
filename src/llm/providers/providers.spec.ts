import axios, { AxiosResponse } from 'axios';
import { DEFAULT_COMPLETION, LlmProviderError } from '../llm.types';
import { GeminiProvider } from './gemini.provider';
import { GigaChatProvider } from './gigachat.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

const prompt = { system: 'Be brief', user: 'Analyze' };
const reply = (status: number, data: unknown) =>
  Promise.resolve({ status, data } as AxiosResponse);
const chat = (content: string) => ({ choices: [{ message: { content } }] });

describe('LLM providers', () => {
  let post: jest.SpyInstance;

  beforeEach(() => {
    post = jest.spyOn(axios, 'post');
  });
  afterEach(() => post.mockRestore());

  describe('OpenAiCompatibleProvider', () => {
    const groq = new OpenAiCompatibleProvider({
      name: 'Groq',
      url: 'https://groq.test/chat',
      model: 'llama',
      apiKey: 'gsk-test',
      timeoutMs: 1000,
    });

    it('sends system and user messages and trims the answer', async () => {
      post.mockReturnValue(reply(200, chat('  hello \n')));

      await expect(groq.complete(prompt, DEFAULT_COMPLETION)).resolves.toBe(
        'hello',
      );
      const [url, body, config] = post.mock.calls[0] as [
        string,
        Record<string, unknown>,
        { headers: Record<string, string> },
      ];
      expect(url).toBe('https://groq.test/chat');
      expect(body).toMatchObject({
        model: 'llama',
        messages: [
          { role: 'system', content: 'Be brief' },
          { role: 'user', content: 'Analyze' },
        ],
        max_tokens: 1000,
      });
      expect(config.headers.Authorization).toBe('Bearer gsk-test');
    });

    it.each([
      [402, {}],
      [200, { choices: [] }],
      [200, chat('   ')],
    ])('rejects HTTP %i / unusable body', async (status, data) => {
      post.mockReturnValue(reply(status, data));
      await expect(groq.complete(prompt, DEFAULT_COMPLETION)).rejects.toThrow(
        LlmProviderError,
      );
    });

    it('is not configured without a key', () => {
      const keyless = new OpenAiCompatibleProvider({
        name: 'DeepSeek',
        url: 'x',
        model: 'm',
        apiKey: undefined,
        timeoutMs: 1,
      });
      expect(keyless.isConfigured()).toBe(false);
    });
  });

  describe('GeminiProvider', () => {
    it('sends the key in a header, not in the URL', async () => {
      post.mockReturnValue(
        reply(200, { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
      );
      await new GeminiProvider('AIza-test').complete(
        prompt,
        DEFAULT_COMPLETION,
      );

      const [url, , config] = post.mock.calls[0] as [
        string,
        unknown,
        { headers: Record<string, string> },
      ];
      expect(url).not.toContain('AIza-test');
      expect(config.headers['x-goog-api-key']).toBe('AIza-test');
    });

    it('surfaces the API error message', async () => {
      post.mockReturnValue(reply(400, { error: { message: 'bad model' } }));
      await expect(
        new GeminiProvider('k').complete(prompt, DEFAULT_COMPLETION),
      ).rejects.toThrow('Gemini: HTTP 400: bad model');
    });
  });

  describe('GigaChatProvider', () => {
    const tokenUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
    let now = 1_000_000;
    const gigachat = () =>
      new GigaChatProvider({
        apiKey: 'client:secret',
        caCert: undefined,
        now: () => now,
      });

    function route(chatStatus = 200) {
      post.mockImplementation((url: string) =>
        url === tokenUrl
          ? reply(200, { access_token: 'tok', expires_at: now + 30 * 60_000 })
          : reply(chatStatus, chat('giga')),
      );
    }
    const tokenRequests = () =>
      post.mock.calls.filter(([url]) => url === tokenUrl).length;

    it('encodes client credentials as Basic auth', async () => {
      route();
      await gigachat().complete(prompt, DEFAULT_COMPLETION);
      const [, , config] = post.mock.calls[0] as [
        string,
        string,
        { headers: Record<string, string> },
      ];
      expect(config.headers.Authorization).toBe(
        `Basic ${Buffer.from('client:secret').toString('base64')}`,
      );
    });

    it('reuses the token until shortly before it expires', async () => {
      route();
      const provider = gigachat();
      await provider.complete(prompt, DEFAULT_COMPLETION);
      await provider.complete(prompt, DEFAULT_COMPLETION);
      expect(tokenRequests()).toBe(1);

      now += 29.5 * 60_000; // меньше минуты до истечения
      await provider.complete(prompt, DEFAULT_COMPLETION);
      expect(tokenRequests()).toBe(2);
    });

    it('drops the token after 401 so the next call re-authenticates', async () => {
      route(401);
      const provider = gigachat();
      await expect(
        provider.complete(prompt, DEFAULT_COMPLETION),
      ).rejects.toThrow('GigaChat: HTTP 401');
      route();
      await provider.complete(prompt, DEFAULT_COMPLETION);
      expect(tokenRequests()).toBe(2);
    });

    it('verifies TLS only when a CA certificate is provided', () => {
      expect(gigachat().verifiesTls).toBe(false);
      expect(
        new GigaChatProvider({ apiKey: 'k', caCert: 'PEM' }).verifiesTls,
      ).toBe(true);
    });
  });
});
