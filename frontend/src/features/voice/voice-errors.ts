import axios from 'axios';
import type { TFunction } from 'i18next';

/**
 * Текст ошибки для пользователя. Причины 5xx остаются в логах сервера:
 * в интерфейсе не должно быть подсказок про инфраструктуру.
 */
export function voiceErrorText(error: unknown, t: TFunction): string {
  if (!axios.isAxiosError<{ message?: string | string[] }>(error)) {
    return t('voice_request_failed');
  }
  const status = error.response?.status;
  if (!error.response) return t('voice_no_connection');
  if (status === 413) return t('voice_too_large');
  if (status && status >= 400 && status < 500 && status !== 401 && status !== 403) {
    const message = error.response.data?.message;
    if (Array.isArray(message)) return message.join('; ');
    if (message) return message;
  }
  return t('voice_request_failed');
}
