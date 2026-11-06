/**
 * Чистка значений из .env / process.env: пробелы, BOM, лишние кавычки.
 * Иначе Bearer-токен уходит с мусором → 401 у OpenAI.
 */
export function normalizeEnvSecret(value: string | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  let s = String(value).trim();
  if (!s) {
    return undefined;
  }
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1).trim();
  }
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s || undefined;
}
