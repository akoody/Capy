import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, type TaskReminder } from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UserDocument } from '../users/schemas/user.schema';

function parseReminderTimes(raw?: string[]): { fireAt: Date }[] {
  if (!raw?.length) return [];
  const out: { fireAt: Date }[] = [];
  for (const s of raw) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      out.push({ fireAt: d });
    }
  }
  return out;
}

const REMINDER_CLAIM_TTL_MS = 5 * 60_000;
const REMINDER_MAX_ATTEMPTS = 5;

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private taskModel: Model<TaskDocument>) {}

  async create(userId: string, dto: CreateTaskDto): Promise<Task> {
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException('Укажите название задачи');
    }
    const doc = new this.taskModel({
      user: new Types.ObjectId(userId),
      title,
      description: dto.description?.trim() || undefined,
      priority: dto.priority ?? 'medium',
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      reminders: parseReminderTimes(dto.reminderFireTimes),
      status: 'open',
    });
    return doc.save();
  }

  async findAllForUser(
    userId: string,
    status: 'open' | 'done' | 'cancelled' | 'all' = 'all',
  ): Promise<Task[]> {
    const q: Record<string, unknown> = { user: new Types.ObjectId(userId) };
    if (status !== 'all') {
      q.status = status;
    }
    return this.taskModel.find(q).sort({ dueAt: 1, createdAt: -1 }).exec();
  }

  async findOpenTitles(userId: string, limit = 30): Promise<string[]> {
    const rows = await this.taskModel
      .find({ user: new Types.ObjectId(userId), status: 'open' })
      .select('title')
      .limit(limit)
      .lean()
      .exec();
    return rows.map((r) => String(r.title));
  }

  async findOneForUser(userId: string, id: string): Promise<TaskDocument> {
    const task = await this.taskModel
      .findOne({ _id: id, user: new Types.ObjectId(userId) })
      .exec();
    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }
    return task;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOneForUser(userId, id);
    if (dto.title != null) task.title = dto.title.trim();
    if (dto.description !== undefined) {
      task.description = dto.description?.trim() || undefined;
    }
    if (dto.priority != null) task.priority = dto.priority;
    if (dto.dueAt !== undefined) {
      task.dueAt =
        dto.dueAt === null || dto.dueAt === ''
          ? undefined
          : new Date(dto.dueAt);
    }
    if (dto.reminderFireTimes !== undefined) {
      task.reminders = parseReminderTimes(dto.reminderFireTimes);
      task.markModified('reminders');
    }
    if (dto.status != null) {
      task.status = dto.status;
      if (dto.status === 'done') {
        task.completedAt = new Date();
      } else if (dto.status === 'open' || dto.status === 'cancelled') {
        task.completedAt = undefined;
      }
    }
    return task.save();
  }

  async complete(userId: string, id: string): Promise<Task> {
    return this.update(userId, id, { status: 'done' });
  }

  async remove(userId: string, id: string): Promise<void> {
    const r = await this.taskModel.deleteOne({
      _id: id,
      user: new Types.ObjectId(userId),
    });
    if (r.deletedCount === 0) {
      throw new NotFoundException('Задача не найдена');
    }
  }

  /**
   * Найти открытую задачу по неточному совпадению заголовка (голос / свободный ввод).
   */
  async findOpenByTitleHint(
    userId: string,
    hint: string,
  ): Promise<TaskDocument | null> {
    const q = hint.trim().toLowerCase();
    if (!q) return null;
    const open = await this.taskModel
      .find({ user: new Types.ObjectId(userId), status: 'open' })
      .exec();
    const exact = open.find((t) => t.title.toLowerCase() === q);
    if (exact) return exact;
    return (
      open.find(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          q.includes(t.title.toLowerCase()),
      ) ?? null
    );
  }

  /**
   * Отправляет наступившие напоминания. Перед отправкой напоминание атомарно
   * занимается, поэтому несколько воркеров не шлют его дважды. Занятое упавшим
   * воркером освобождается через REMINDER_CLAIM_TTL_MS, неудачная отправка
   * повторяется на следующих запусках, но не больше REMINDER_MAX_ATTEMPTS раз.
   */
  async processDueReminders(
    send: (telegramId: number, text: string) => Promise<boolean>,
    now: Date = new Date(),
  ): Promise<void> {
    const staleClaim = new Date(now.getTime() - REMINDER_CLAIM_TTL_MS);
    const available = {
      sentAt: { $exists: false },
      fireAt: { $lte: now },
      $or: [
        { claimedAt: { $exists: false } },
        { claimedAt: { $lte: staleClaim } },
      ],
    };

    const tasks = await this.taskModel
      .find({ status: 'open', reminders: { $elemMatch: available } })
      .populate<{ user: UserDocument }>('user')
      .exec();

    for (const task of tasks) {
      const telegramId = task.user?.telegramId;
      if (telegramId == null) continue;

      for (const reminder of task.reminders) {
        if (reminder.sentAt || reminder.fireAt > now) continue;

        const claimed = await this.taskModel.updateOne(
          {
            _id: task._id,
            reminders: { $elemMatch: { _id: reminder._id, ...available } },
          },
          { $set: { 'reminders.$.claimedAt': now } },
        );
        if (claimed.modifiedCount === 0) continue;

        await this.finishReminder(
          task._id,
          reminder,
          await this.sendReminder(send, telegramId, reminderText(task)),
        );
      }
    }
  }

  private async sendReminder(
    send: (telegramId: number, text: string) => Promise<boolean>,
    telegramId: number,
    text: string,
  ): Promise<boolean> {
    try {
      return await send(telegramId, text);
    } catch {
      return false;
    }
  }

  private async finishReminder(
    taskId: Types.ObjectId,
    reminder: TaskReminder,
    delivered: boolean,
  ): Promise<void> {
    const filter = { _id: taskId, 'reminders._id': reminder._id };
    const attempts = (reminder.attempts ?? 0) + 1;

    if (delivered) {
      await this.taskModel.updateOne(filter, {
        $set: { 'reminders.$.sentAt': new Date() },
      });
    } else if (attempts >= REMINDER_MAX_ATTEMPTS) {
      const failedAt = new Date();
      await this.taskModel.updateOne(filter, {
        $set: {
          'reminders.$.sentAt': failedAt,
          'reminders.$.failedAt': failedAt,
          'reminders.$.attempts': attempts,
        },
      });
    } else {
      await this.taskModel.updateOne(filter, {
        $set: { 'reminders.$.attempts': attempts },
        $unset: { 'reminders.$.claimedAt': 1 },
      });
    }
  }
}

function reminderText(task: { priority: string; title: string; dueAt?: Date }) {
  const marker =
    task.priority === 'high' ? '🔴' : task.priority === 'low' ? '⚪' : '🟡';
  const dueLine = task.dueAt
    ? `\nСрок: ${task.dueAt.toISOString().slice(0, 10)}`
    : '';
  return `${marker} Capy: напоминание\n«${task.title}»${dueLine}`;
}
