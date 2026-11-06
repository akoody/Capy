import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { normalizeEnvSecret } from '../env-secrets';

@Injectable()
export class TelegramNotifyService {
  private readonly logger = new Logger(TelegramNotifyService.name);

  /** Отправка сообщения в личку пользователю по telegramId. */
  async sendMessage(telegramId: number, text: string): Promise<boolean> {
    const token = normalizeEnvSecret(process.env.TELEGRAM_BOT_TOKEN);
    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN не задан — напоминание не отправлено',
      );
      return false;
    }
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
      const res = await axios.post<{
        ok?: boolean;
        description?: string;
      }>(
        url,
        {
          chat_id: telegramId,
          text: String(text).slice(0, 4090),
          disable_web_page_preview: true,
        },
        { timeout: 15000, validateStatus: () => true },
      );
      if (res.status !== 200 || res.data?.ok === false) {
        this.logger.warn(
          `Telegram API: ${res.status} ${res.data?.description || res.data || ''}`,
        );
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(
        `Telegram sendMessage failed: ${e instanceof Error ? e.message : e}`,
      );
      return false;
    }
  }
}
