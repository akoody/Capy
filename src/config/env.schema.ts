import { z } from 'zod';
import { normalizeEnvSecret } from '../env-secrets';

/** Пустая строка и значения в кавычках из .env приводятся к undefined / чистому виду. */
const secret = () =>
  z.preprocess(
    (v) => normalizeEnvSecret(v as string | undefined),
    z.string().min(1),
  );
const optionalSecret = () =>
  z.preprocess(
    (v) => normalizeEnvSecret(v as string | undefined),
    z.string().min(1).optional(),
  );

const mongoUri = z
  .string()
  .trim()
  .regex(
    /^mongodb(\+srv)?:\/\//,
    'must start with mongodb:// or mongodb+srv://',
  );

/** Минимум, без которого не стартует сидер. */
export const seederEnvSchema = z.object({
  MONGODB_URI: mongoUri,
});

/** Полная конфигурация API. */
export const appEnvSchema = seederEnvSchema.extend({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  TELEGRAM_BOT_TOKEN: secret(),
  OPENAI_API_KEY: optionalSecret(),
  OPENAI_ORGANIZATION: optionalSecret(),
  OPENAI_TRANSCRIPTION_MODEL: optionalSecret(),
  OPENAI_INTERPRET_MODEL: optionalSecret(),
  GIGACHAT_API_KEY: optionalSecret(),
  GEMINI_API_KEY: optionalSecret(),
  DEEPSEEK_API_KEY: optionalSecret(),
  GROQ_API_KEY: optionalSecret(),
});

export type AppEnv = z.infer<typeof appEnvSchema>;
export type SeederEnv = z.infer<typeof seederEnvSchema>;

/**
 * Фабрика для ConfigModule.forRoot({ validate }).
 * Падает при старте с перечнем всех неверных переменных, не раскрывая их значения.
 */
export function createEnvValidator<Out extends object>(
  schema: z.ZodType<Out, z.ZodTypeDef, unknown>,
) {
  return (raw: Record<string, unknown>): Out => {
    const result = schema.safeParse(raw);
    if (!result.success) {
      const details = result.error.issues
        .map(
          (issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`,
        )
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${details}`);
    }
    return { ...raw, ...result.data };
  };
}
