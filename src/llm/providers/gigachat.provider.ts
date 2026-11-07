import axios from 'axios';
import { randomUUID } from 'crypto';
import { Agent } from 'https';
import {
  ChatCompletionResponse,
  ChatPrompt,
  CompletionOptions,
  extractChatContent,
  LlmProvider,
  LlmProviderError,
} from '../llm.types';

interface GigaChatTokenResponse {
  access_token?: string;
  /** Unix-время истечения в миллисекундах (так отвечает GigaChat). */
  expires_at?: number;
  /** Время жизни в секундах (на случай другого формата ответа). */
  expires_in?: number;
}

const TOKEN_REFRESH_MARGIN_MS = 60_000;
/** Токен GigaChat живёт 30 минут; берём с запасом, если срок не пришёл. */
const DEFAULT_TOKEN_TTL_MS = 25 * 60_000;

export interface GigaChatConfig {
  /** `client_id:client_secret` или готовая Base64-строка. */
  apiKey: string | undefined;
  /**
   * PEM с корневым сертификатом Минцифры, которым подписан GigaChat.
   * Без него проверка TLS отключается, о чём пишется предупреждение.
   */
  caCert: string | undefined;
  now?: () => number;
}

export class GigaChatProvider implements LlmProvider {
  readonly name = 'GigaChat';
  private readonly agent: Agent;
  private token: { value: string; expiresAt: number } | null = null;
  private readonly now: () => number;

  constructor(private readonly config: GigaChatConfig) {
    this.agent = config.caCert
      ? new Agent({ ca: config.caCert })
      : new Agent({ rejectUnauthorized: false });
    this.now = config.now ?? Date.now;
  }

  get verifiesTls(): boolean {
    return Boolean(this.config.caCert);
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async complete(
    prompt: ChatPrompt,
    options: CompletionOptions,
  ): Promise<string> {
    const accessToken = await this.getAccessToken();
    const response = await axios.post<ChatCompletionResponse>(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat:latest',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 180_000,
        httpsAgent: this.agent,
        validateStatus: () => true,
      },
    );
    if (response.status === 401 || response.status === 403) {
      this.token = null;
    }
    if (response.status !== 200) {
      throw new LlmProviderError(
        this.name,
        `HTTP ${response.status}`,
        response.status,
      );
    }
    return extractChatContent(this.name, response.data);
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.now() < this.token.expiresAt) {
      return this.token.value;
    }
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new LlmProviderError(this.name, 'API key not configured');
    }
    const basic = apiKey.includes(':')
      ? Buffer.from(apiKey).toString('base64')
      : apiKey.replace(/^Basic\s+/i, '');

    const response = await axios.post<GigaChatTokenResponse>(
      'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      'scope=GIGACHAT_API_PERS',
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          RqUID: randomUUID(),
        },
        timeout: 30_000,
        httpsAgent: this.agent,
        validateStatus: () => true,
      },
    );
    if (response.status !== 200 || !response.data?.access_token) {
      throw new LlmProviderError(
        this.name,
        `token request failed: HTTP ${response.status}`,
        response.status,
      );
    }
    this.token = {
      value: response.data.access_token,
      expiresAt: this.tokenExpiry(response.data) - TOKEN_REFRESH_MARGIN_MS,
    };
    return this.token.value;
  }

  private tokenExpiry({ expires_at, expires_in }: GigaChatTokenResponse) {
    if (typeof expires_at === 'number') return expires_at;
    if (typeof expires_in === 'number') return this.now() + expires_in * 1000;
    return this.now() + DEFAULT_TOKEN_TTL_MS;
  }
}
