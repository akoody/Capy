/**
 * Деньги: целые копейки, атомарность записи и кошелька, отсутствие гонок.
 * Нужен replica set: транзакции MongoDB на одиночном сервере не работают.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { buildInitData } from '../src/auth/testing/sign-init-data';
import { migrateMoney } from '../src/transactions/money-migration';
import { VoiceCommandExecutor } from '../src/assistant/voice-command-executor.service';
import type { VoiceInterpretResult } from '../src/assistant/voice-intent.types';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;

describe('Ledger (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let nextId = 2000;
  let user: { id: number; first_name: string };

  const auth = () => ({
    Authorization: `tma ${buildInitData({ botToken: BOT_TOKEN, user })}`,
  });
  const http = () => request(app.getHttpServer());
  const walletBalance = async () =>
    ((await http().get('/piggy-bank').set(auth())).body as { amount?: number })
      .amount ?? 0;
  const history = async () =>
    (await http().get('/transactions').set(auth())).body as Array<
      Record<string, unknown>
    >;
  const deposit = (amount: number) =>
    http().patch('/piggy-bank/deposit').set(auth()).send({ amount });
  const expense = (amount: number, affectWallet = true) =>
    http().post('/transactions').set(auth()).send({
      type: 'expense',
      amount,
      category: 'Food',
      date: '2026-11-01',
      affectWallet,
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: ['error'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
  });

  beforeEach(() => {
    nextId += 1;
    user = { id: nextId, first_name: 'Payer' };
  });

  afterAll(async () => {
    await connection?.dropDatabase();
    await app?.close();
  });

  it('stores exact minor units and exposes major units', async () => {
    const created = await expense(19.99, false).expect(201);
    expect(created.body).toMatchObject({ amount: 19.99, amountMinor: 1999 });
    expect(created.body.currency).toBe('USD');

    await expense(19.999, false).expect(400);

    for (let i = 0; i < 10; i += 1) {
      await deposit(0.1).expect(200);
    }
    expect(await walletBalance()).toBe(1);
  });

  it('debits the wallet together with the expense', async () => {
    await deposit(100).expect(200);
    const created = await expense(30).expect(201);
    expect(created.body.walletEffect).toBe('debit');
    expect(await walletBalance()).toBe(70);
  });

  it('saves nothing when the wallet cannot cover the expense', async () => {
    await deposit(10).expect(200);
    await expense(30).expect(400);
    expect(await walletBalance()).toBe(10);
    expect(await history()).toHaveLength(0);
  });

  it('credits the wallet with income', async () => {
    const created = await http()
      .post('/transactions')
      .set(auth())
      .send({
        type: 'income',
        amount: 50.5,
        category: 'Salary',
        date: '2026-11-01',
        affectWallet: true,
      })
      .expect(201);
    expect(created.body.walletEffect).toBe('credit');
    expect(await walletBalance()).toBe(50.5);
  });

  it('leaves the wallet alone for an ordinary expense', async () => {
    await deposit(10).expect(200);
    const created = await expense(3, false).expect(201);
    expect(created.body.walletEffect).toBeUndefined();
    expect(await walletBalance()).toBe(10);
  });

  it('returns the money when a wallet expense is deleted', async () => {
    await deposit(100).expect(200);
    const created = await expense(40).expect(201);
    await http()
      .delete(`/transactions/${created.body._id}`)
      .set(auth())
      .expect(200);
    expect(await walletBalance()).toBe(100);
    expect(await history()).toHaveLength(0);
  });

  it('refuses to delete income that has already been spent', async () => {
    const income = await http()
      .post('/transactions')
      .set(auth())
      .send({
        type: 'income',
        amount: 20,
        category: 'Gift',
        date: '2026-11-01',
        affectWallet: true,
      })
      .expect(201);
    await expense(15).expect(201);

    await http()
      .delete(`/transactions/${income.body._id}`)
      .set(auth())
      .expect(400);

    expect(await walletBalance()).toBe(5);
    expect(await history()).toHaveLength(2);
  });

  it('adjusts the wallet when a wallet expense is edited', async () => {
    await deposit(100).expect(200);
    const created = await expense(40).expect(201);

    await http()
      .put(`/transactions/${created.body._id}`)
      .set(auth())
      .send({ amount: 55.5 })
      .expect(200);
    expect(await walletBalance()).toBe(44.5);

    await http()
      .put(`/transactions/${created.body._id}`)
      .set(auth())
      .send({ type: 'income' })
      .expect(400);
  });

  it('records a wallet operation in history atomically', async () => {
    const done = await http()
      .patch('/piggy-bank/deposit')
      .set(auth())
      .send({ amount: 25, category: 'Копилка', description: 'Пополнение' })
      .expect(200);
    expect(done.body.amount).toBe(25);
    expect((await history())[0]).toMatchObject({
      type: 'deposit',
      amount: 25,
      walletEffect: 'credit',
    });

    await http()
      .patch('/piggy-bank/withdraw')
      .set(auth())
      .send({ amount: 100, category: 'Копилка' })
      .expect(400);
    expect(await history()).toHaveLength(1);
    expect(await walletBalance()).toBe(25);
  });

  it('never lets parallel spending overdraw the wallet', async () => {
    await deposit(100).expect(200);

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        http().patch('/piggy-bank/withdraw').set(auth()).send({ amount: 30 }),
      ),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect(results.filter((r) => r.status === 400)).toHaveLength(3);
    expect(await walletBalance()).toBe(10);
  });

  it('never lets parallel withdrawals overdraw a goal', async () => {
    const goal = await http()
      .post('/goals')
      .set(auth())
      .send({ name: 'Car', targetAmount: 1000.5 })
      .expect(201);
    expect(goal.body.targetAmount).toBe(1000.5);
    await http()
      .patch(`/goals/${goal.body._id}/deposit`)
      .set(auth())
      .send({ amount: 100 })
      .expect(200);

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        http()
          .patch(`/goals/${goal.body._id}/withdraw`)
          .set(auth())
          .send({ amount: 40 }),
      ),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    const after = await http().get(`/goals/${goal.body._id}`).set(auth());
    expect(after.body.currentAmount).toBe(20);
  });

  it('executes voice wallet commands through the same ledger', async () => {
    const executor = app.get(VoiceCommandExecutor);
    const userId = (await http().get('/users/me').set(auth())).body
      ._id as string;
    const command = (overrides: Partial<VoiceInterpretResult>) =>
      ({
        confidence: 0.9,
        amount: 100,
        category: 'Еда',
        description: null,
        date: '2026-11-01',
        reply_hint: '',
        ...overrides,
      }) as VoiceInterpretResult;

    await executor.execute(command({ intent: 'wallet_deposit' }), userId);
    const spent = await executor.execute(
      command({ intent: 'create_expense', amount: 30, affect_wallet: true }),
      userId,
    );
    expect(spent.transactionId).toBeDefined();
    expect(await walletBalance()).toBe(70);

    await expect(
      executor.execute(
        command({ intent: 'create_expense', amount: 500, affect_wallet: true }),
        userId,
      ),
    ).rejects.toThrow('Недостаточно средств');
    expect(await history()).toHaveLength(1);

    await expect(
      executor.execute(
        command({ intent: 'wallet_deposit', amount: null }),
        userId,
      ),
    ).rejects.toThrow('Сумма не указана');
    await expect(
      executor.execute(command({ intent: 'unknown' }), userId),
    ).rejects.toThrow('Команда не выполнена');
  });

  it('migrates legacy float documents once and keeps the sums', async () => {
    const db = connection.db!;
    const owner = await db
      .collection('users')
      .insertOne({ telegramId: 987654, currency: 'RUB' });
    const legacyUser = owner.insertedId;
    await db.collection('transactions').insertMany([
      {
        user: legacyUser,
        amount: 19.99,
        type: 'expense',
        category: 'Food',
        date: new Date(),
        description: 'Обед (списано с кошелька)',
      },
      {
        user: legacyUser,
        amount: 100.1,
        type: 'income',
        category: 'Job',
        date: new Date(),
        description: '(пополнено в кошелек)',
      },
      {
        user: legacyUser,
        amount: 5,
        type: 'expense',
        category: 'Bus',
        date: new Date(),
      },
      {
        user: legacyUser,
        amount: 7,
        type: 'deposit',
        category: 'Wallet',
        date: new Date(),
      },
    ]);
    await db
      .collection('piggybanks')
      .insertOne({ user: legacyUser, amount: 12.34 });
    await db.collection('goals').insertOne({
      user: legacyUser,
      name: 'Old',
      targetAmount: 300.3,
      currentAmount: 0.07,
      recurringTransaction: { amount: 9.99, frequency: 'weekly' },
    });
    await db.collection('budgets').insertOne({
      user: legacyUser,
      name: 'B',
      amount: 50,
      category: 'c',
      period: 'monthly',
    });

    const dry = await migrateMoney(db, { dryRun: true });
    expect(
      dry.moved.find((m) => m.field === 'piggybanks.amount')?.documents,
    ).toBe(1);
    expect(
      await db.collection('piggybanks').findOne({ user: legacyUser }),
    ).toMatchObject({ amount: 12.34 });

    const report = await migrateMoney(db);
    expect(report.currencyUpdated).toBe(4);

    const rows = await db
      .collection('transactions')
      .find({ user: legacyUser })
      .sort({ _id: 1 })
      .toArray();
    expect(rows.map((r) => r.amountMinor as number)).toEqual([
      1999, 10010, 500, 700,
    ]);
    expect(rows.map((r) => r.walletEffect as string | undefined)).toEqual([
      'debit',
      'credit',
      undefined,
      'credit',
    ]);
    expect(rows[0].description).toBe('Обед');
    expect(rows[0].currency).toBe('RUB');
    expect(rows[0].amount).toBeUndefined();

    expect(
      await db.collection('piggybanks').findOne({ user: legacyUser }),
    ).toMatchObject({ amountMinor: 1234 });
    expect(
      await db.collection('goals').findOne({ user: legacyUser }),
    ).toMatchObject({
      targetAmountMinor: 30030,
      currentAmountMinor: 7,
      recurringTransaction: { amountMinor: 999 },
    });

    const again = await migrateMoney(db);
    expect(again.moved.every((m) => m.documents === 0)).toBe(true);
    expect(
      await db.collection('piggybanks').findOne({ user: legacyUser }),
    ).toMatchObject({ amountMinor: 1234 });
  });
});
