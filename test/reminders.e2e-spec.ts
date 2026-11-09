/** Напоминания: один получатель одного сообщения при любом числе воркеров. */
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { INestApplicationContext } from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import { TasksService } from '../src/tasks/tasks.service';
import { Task, type TaskDocument } from '../src/tasks/schemas/task.schema';
import { User, type UserDocument } from '../src/users/schemas/user.schema';
import { WorkerModule } from '../src/worker.module';

describe('Reminders worker (e2e)', () => {
  let worker: INestApplicationContext;
  let connection: Connection;
  let tasks: Model<TaskDocument>;
  let users: Model<UserDocument>;
  let service: TasksService;
  let telegramId = 5000;

  const now = new Date('2026-11-09T12:00:00Z');
  const minutes = (m: number) => new Date(now.getTime() + m * 60_000);

  async function createTask(
    reminders: Array<{ fireAt: Date; claimedAt?: Date }>,
  ) {
    telegramId += 1;
    const user = await users.create({ telegramId, firstName: 'U' });
    return tasks.create({ user: user._id, title: 'Оплатить', reminders });
  }
  const reload = (id: unknown) => tasks.findById(id).orFail().exec();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();
    worker = await moduleRef.init();
    connection = worker.get<Connection>(getConnectionToken());
    tasks = worker.get(getModelToken(Task.name));
    users = worker.get(getModelToken(User.name));
    service = worker.get(TasksService);
  });

  beforeEach(() => tasks.deleteMany({}));

  afterAll(async () => {
    await connection.dropDatabase();
    await worker.close();
  });

  it('sends a due reminder once and skips future ones', async () => {
    const task = await createTask([
      { fireAt: minutes(-1) },
      { fireAt: minutes(10) },
    ]);
    const send = jest.fn().mockResolvedValue(true);

    await service.processDueReminders(send, now);
    await service.processDueReminders(send, now);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toContain('Оплатить');
    const saved = await reload(task._id);
    expect(saved.reminders[0].sentAt).toBeDefined();
    expect(saved.reminders[1].sentAt).toBeUndefined();
  });

  it('delivers each reminder once with several workers running', async () => {
    await Promise.all(
      Array.from({ length: 5 }, () => createTask([{ fireAt: minutes(-1) }])),
    );
    const send = jest.fn().mockResolvedValue(true);

    await Promise.all(
      Array.from({ length: 6 }, () => service.processDueReminders(send, now)),
    );

    expect(send).toHaveBeenCalledTimes(5);
  });

  it('retries after a failed send and gives up after five attempts', async () => {
    const task = await createTask([{ fireAt: minutes(-1) }]);
    const send = jest.fn().mockResolvedValue(false);

    await service.processDueReminders(send, now);
    expect((await reload(task._id)).reminders[0].sentAt).toBeUndefined();

    for (let i = 0; i < 6; i += 1) {
      await service.processDueReminders(send, now);
    }

    expect(send).toHaveBeenCalledTimes(5);
    const saved = await reload(task._id);
    expect(saved.reminders[0].failedAt).toBeDefined();
  });

  it('treats a thrown send as a failed attempt', async () => {
    const task = await createTask([{ fireAt: minutes(-1) }]);
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(true);

    await service.processDueReminders(send, now);
    await service.processDueReminders(send, now);

    expect(send).toHaveBeenCalledTimes(2);
    expect((await reload(task._id)).reminders[0].sentAt).toBeDefined();
  });

  it('leaves a fresh claim alone but takes over one from a dead worker', async () => {
    await createTask([{ fireAt: minutes(-1), claimedAt: minutes(-1) }]);
    await createTask([{ fireAt: minutes(-20), claimedAt: minutes(-6) }]);
    const send = jest.fn().mockResolvedValue(true);

    await service.processDueReminders(send, now);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not remind about finished tasks', async () => {
    const task = await createTask([{ fireAt: minutes(-1) }]);
    await tasks.updateOne({ _id: task._id }, { status: 'done' });
    const send = jest.fn().mockResolvedValue(true);

    await service.processDueReminders(send, now);

    expect(send).not.toHaveBeenCalled();
  });
});
