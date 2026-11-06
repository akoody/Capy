import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import type { AppEnv } from '../config/env.schema';
import { LLM_PROVIDERS, LlmService } from './llm.service';
import type { LlmProvider } from './llm.types';
import { GeminiProvider } from './providers/gemini.provider';
import { GigaChatProvider } from './providers/gigachat.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

/** Порядок важен: GigaChat лучше всех пишет по-русски, Groq — последний резерв. */
function createProviders(config: ConfigService<AppEnv, true>): LlmProvider[] {
  const caPath = config.get('GIGACHAT_CA_CERT_PATH', { infer: true });
  const gigachat = new GigaChatProvider({
    apiKey: config.get('GIGACHAT_API_KEY', { infer: true }),
    caCert: caPath ? readFileSync(caPath, 'utf8') : undefined,
  });
  if (gigachat.isConfigured() && !gigachat.verifiesTls) {
    new Logger('LlmModule').warn(
      'GIGACHAT_CA_CERT_PATH is not set: TLS verification for GigaChat is disabled',
    );
  }

  return [
    gigachat,
    new GeminiProvider(config.get('GEMINI_API_KEY', { infer: true })),
    new OpenAiCompatibleProvider({
      name: 'DeepSeek',
      url: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      apiKey: config.get('DEEPSEEK_API_KEY', { infer: true }),
      timeoutMs: 30_000,
    }),
    new OpenAiCompatibleProvider({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'llama-3.1-8b-instant',
      apiKey: config.get('GROQ_API_KEY', { infer: true }),
      timeoutMs: 30_000,
    }),
  ];
}

@Module({
  providers: [
    {
      provide: LLM_PROVIDERS,
      inject: [ConfigService],
      useFactory: createProviders,
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
