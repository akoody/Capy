export interface ChatPrompt {
  system: string;
  user: string;
}

export interface CompletionOptions {
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_COMPLETION: CompletionOptions = {
  temperature: 0.7,
  maxTokens: 1000,
};

/** Адаптер одного провайдера. Бросает ошибку, если ответ не получен. */
export interface LlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  complete(prompt: ChatPrompt, options: CompletionOptions): Promise<string>;
}

/** Ответ OpenAI-совместимого chat completions API (Groq, DeepSeek, GigaChat). */
export interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export class LlmUnavailableError extends Error {
  constructor(readonly failures: Array<{ provider: string; reason: string }>) {
    super(
      failures.length
        ? `All LLM providers failed: ${failures.map((f) => `${f.provider} (${f.reason})`).join(', ')}`
        : 'No LLM provider is configured',
    );
    this.name = 'LlmUnavailableError';
  }
}

export class LlmProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = 'LlmProviderError';
  }
}

/** Достаёт текст из OpenAI-совместимого ответа или бросает понятную ошибку. */
export function extractChatContent(
  provider: string,
  data: ChatCompletionResponse,
): string {
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new LlmProviderError(provider, 'empty response');
  }
  return content;
}
