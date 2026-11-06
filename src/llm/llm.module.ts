import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import type { AppEnv } from '../config/env.schema';
import { LLM_PROVIDERS, type LlmChains, LlmService } from './llm.service';
import { GeminiProvider } from './providers/gemini.provider';
import { GigaChatProvider } from './providers/gigachat.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

/**
 * Порядок важен: GigaChat лучше всех пишет по-русски, Groq — последний резерв.
 * Для разбора голосовых команд первым идёт OpenAI: он умеет строгий JSON-режим.
 */
function createChains(config: ConfigService<AppEnv, true>): LlmChains {
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

  const openAiModel =
    config.get('OPENAI_INTERPRET_MODEL', { infer: true }) ?? 'gpt-4o-mini';
  const openAiOrg = config.get('OPENAI_ORGANIZATION', { infer: true });
  const openai = new OpenAiCompatibleProvider({
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    model: openAiModel,
    apiKey: config.get('OPENAI_API_KEY', { infer: true }),
    timeoutMs: 60_000,
    headers: openAiOrg ? { 'OpenAI-Organization': openAiOrg } : undefined,
    supportsJsonMode: true,
    extraBody: openAiModel.startsWith('gpt-5')
      ? { reasoning_effort: 'none', verbosity: 'low' }
      : undefined,
  });
  const gemini = new GeminiProvider(
    config.get('GEMINI_API_KEY', { infer: true }),
  );
  const deepseek = new OpenAiCompatibleProvider({
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    apiKey: config.get('DEEPSEEK_API_KEY', { infer: true }),
    timeoutMs: 30_000,
  });
  const groq = new OpenAiCompatibleProvider({
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.1-8b-instant',
    apiKey: config.get('GROQ_API_KEY', { infer: true }),
    timeoutMs: 30_000,
  });

  return {
    analysis: [gigachat, gemini, deepseek, groq],
    interpret: [openai, gigachat, gemini, deepseek, groq],
  };
}

@Module({
  providers: [
    {
      provide: LLM_PROVIDERS,
      inject: [ConfigService],
      useFactory: createChains,
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
