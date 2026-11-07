import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TasksService } from './tasks.service';
import { TelegramNotifyService } from '../telegram/telegram-notify.service';

@Injectable()
export class TasksReminderScheduler {
  private readonly logger = new Logger(TasksReminderScheduler.name);

  constructor(
    private readonly tasksService: TasksService,
    private readonly telegramNotify: TelegramNotifyService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchReminders(): Promise<void> {
    try {
      await this.tasksService.processDueReminders((telegramId, text) =>
        this.telegramNotify.sendMessage(telegramId, text),
      );
    } catch (e) {
      this.logger.warn(
        `processDueReminders: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
