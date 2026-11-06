import axios from 'axios';
import {
  ChatPrompt,
  CompletionOptions,
  LlmProvider,
  LlmProviderError,
} from '../llm.types';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'Gemini';
  private readonly model = 'gemini-1.5-flash';

  constructor(private readonly apiKey: string | undefined) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(
    prompt: ChatPrompt,
    options: CompletionOptions,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new LlmProviderError(this.name, 'API key not configured');
    }
    const response = await axios.post<GeminiResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        contents: [{ parts: [{ text: `${prompt.system}\n\n${prompt.user}` }] }],
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
        },
      },
      {
        // Ключ в заголовке, а не в query: не попадает в логи прокси.
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        timeout: 60_000,
        validateStatus: () => true,
      },
    );
    if (response.status !== 200) {
      const detail = response.data?.error?.message;
      throw new LlmProviderError(
        this.name,
        `HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        response.status,
      );
    }
    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text?.trim()) {
      throw new LlmProviderError(this.name, 'empty response');
    }
    return text.trim();
  }
}
