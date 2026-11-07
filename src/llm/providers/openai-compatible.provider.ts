import axios from 'axios';
import {
  ChatCompletionResponse,
  ChatPrompt,
  CompletionOptions,
  extractChatContent,
  LlmProvider,
  LlmProviderError,
} from '../llm.types';

export interface OpenAiCompatibleConfig {
  name: string;
  url: string;
  model: string;
  apiKey: string | undefined;
  timeoutMs: number;
  /** Дополнительные заголовки, например OpenAI-Organization. */
  headers?: Record<string, string>;
  /** Поддерживает `response_format: json_object` (OpenAI). */
  supportsJsonMode?: boolean;
  /** Параметры, которые зависят от модели (reasoning_effort для gpt-5 и т. п.). */
  extraBody?: Record<string, unknown>;
}

/** OpenAI, Groq и DeepSeek: один и тот же протокол chat completions с Bearer-ключом. */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.name = config.name;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async complete(
    prompt: ChatPrompt,
    options: CompletionOptions,
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new LlmProviderError(this.name, 'API key not configured');
    }
    const response = await axios.post<ChatCompletionResponse>(
      this.config.url,
      {
        model: this.config.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        ...(options.jsonObject && this.config.supportsJsonMode
          ? { response_format: { type: 'json_object' } }
          : {}),
        ...this.config.extraBody,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          ...this.config.headers,
        },
        timeout: this.config.timeoutMs,
        validateStatus: () => true,
      },
    );
    if (response.status !== 200) {
      throw new LlmProviderError(
        this.name,
        `HTTP ${response.status}`,
        response.status,
      );
    }
    return extractChatContent(this.name, response.data);
  }
}
