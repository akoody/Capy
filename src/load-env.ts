import { config } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';

/** .env рядом с корнем проекта (на уровень выше dist/), чтобы PM2 видел ключи при любом cwd */
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  // По умолчанию dotenv НЕ перезаписывает уже заданные переменные (в т.ч. пустые из окружения/PM2).
  // Иначе рабочий ключ в .env игнорируется, если OPENAI_API_KEY="" где-то «висит» в env.
  config({ path: envPath, override: true });
}
