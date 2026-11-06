import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
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

  async processDueReminders(
    send: (telegramId: number, text: string) => Promise<boolean>,
  ): Promise<void> {
    const tasks = await this.taskModel
      .find({
        status: 'open',
        reminders: {
          $elemMatch: {
            fireAt: { $lte: new Date() },
            sentAt: { $exists: false },
          },
        },
      })
      .populate<{ user: UserDocument }>('user')
      .exec();

    const now = new Date();
    for (const task of tasks) {
      const u = task.user as UserDocument;
      const tid = u?.telegramId;
      if (tid == null) continue;

      let changed = false;
      for (let i = 0; i < task.reminders.length; i++) {
        const r = task.reminders[i];
        if (r.sentAt) continue;
        if (r.fireAt > now) continue;
        const pri =
          task.priority === 'high'
            ? '🔴'
            : task.priority === 'low'
              ? '⚪'
              : '🟡';
        const dueLine = task.dueAt
          ? `\nСрок: ${task.dueAt.toISOString().slice(0, 10)}`
          : '';
        const text = `${pri} Capy — напоминание\n«${task.title}»${dueLine}`;
        await send(tid, text);
        task.reminders[i].sentAt = new Date();
        changed = true;
      }
      if (changed) {
        task.markModified('reminders');
        await task.save();
      }
    }
  }
}
