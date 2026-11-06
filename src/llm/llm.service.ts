import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ChatPrompt,
  CompletionOptions,
  DEFAULT_COMPLETION,
  LlmProvider,
  LlmUnavailableError,
} from './llm.types';

export const LLM_PROVIDERS = Symbol('LLM_PROVIDERS');

/**
 * Текстовые ответы LLM с fallback: провайдеры пробуются по порядку,
 * ненастроенные пропускаются. Если не ответил ни один — LlmUnavailableError.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(LLM_PROVIDERS) private readonly providers: LlmProvider[],
  ) {}

  async complete(
    prompt: ChatPrompt,
    options: CompletionOptions = DEFAULT_COMPLETION,
  ): Promise<string> {
    const failures: Array<{ provider: string; reason: string }> = [];
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      try {
        return await provider.complete(prompt, options);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({ provider: provider.name, reason });
        this.logger.warn(`${provider.name} failed, trying next: ${reason}`);
      }
    }
    throw new LlmUnavailableError(failures);
  }
}
