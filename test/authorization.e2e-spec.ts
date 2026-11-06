/**
 * Сквозная проверка: каждый пользователь видит и меняет только свои данные.
 * Поднимает весь AppModule на настоящей MongoDB (MONGODB_TEST_URI),
 * каждый запуск в отдельной базе, которая удаляется после тестов.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { buildInitData } from '../src/auth/testing/sign-init-data';

// Выставлен в test/e2e-env.ts вместе с MONGODB_URI отдельной базы.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;

describe('Authorization (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;

  const alice = { id: 1001, first_name: 'Alice' };
  const bob = { id: 1002, first_name: 'Bob' };
  const as = (user: typeof alice) => ({
    Authorization: `tma ${buildInitData({ botToken: BOT_TOKEN, user })}`,
  });
  const http = () => request(app.getHttpServer());

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

  afterAll(async () => {
    await connection?.dropDatabase();
    await app?.close();
  });

  it('creates an account on first request and returns only the caller profile', async () => {
    const me = await http().get('/users/me').set(as(alice)).expect(200);
    expect(me.body).toMatchObject({ telegramId: alice.id, firstName: 'Alice' });
    const other = await http().get('/users/me').set(as(bob)).expect(200);
    expect(other.body.telegramId).toBe(bob.id);
  });

  it('keeps goals private to their owner', async () => {
    const goal = await http()
      .post('/goals')
      .set(as(alice))
      .send({ name: 'Car', targetAmount: 1000, userId: 'ignored' })
      .expect(201);
    const goalId = goal.body._id as string;

    const bobGoals = await http().get('/goals').set(as(bob)).expect(200);
    expect(bobGoals.body).toEqual([]);

    await http().get(`/goals/${goalId}`).set(as(bob)).expect(404);
    await http()
      .patch(`/goals/${goalId}/deposit`)
      .set(as(bob))
      .send({ amount: 10 })
      .expect(404);
    await http()
      .patch(`/goals/${goalId}/notes`)
      .set(as(bob))
      .send({ notes: 'pwned' })
      .expect(404);
    await http().delete(`/goals/${goalId}`).set(as(bob)).expect(404);

    const aliceGoal = await http()
      .get(`/goals/${goalId}`)
      .set(as(alice))
      .expect(200);
    expect(aliceGoal.body).toMatchObject({ currentAmount: 0 });
    expect(aliceGoal.body.notes).toBeUndefined();
  });

  it('rejects non-positive amounts instead of treating them as withdrawals', async () => {
    const goal = await http()
      .post('/goals')
      .set(as(alice))
      .send({ name: 'Trip', targetAmount: 500 })
      .expect(201);
    await http()
      .patch(`/goals/${goal.body._id}/deposit`)
      .set(as(alice))
      .send({ amount: -100 })
      .expect(400);
    await http()
      .patch('/piggy-bank/deposit')
      .set(as(alice))
      .send({ amount: 0 })
      .expect(400);
  });

  it('keeps transactions private and blocks linking to a foreign goal', async () => {
    const aliceGoal = await http()
      .post('/goals')
      .set(as(alice))
      .send({ name: 'House', targetAmount: 5000 })
      .expect(201);
    const tx = await http()
      .post('/transactions')
      .set(as(alice))
      .send({
        type: 'expense',
        amount: 25,
        category: 'Food',
        date: '2026-11-01',
      })
      .expect(201);

    expect(
      (await http().get('/transactions').set(as(bob)).expect(200)).body,
    ).toEqual([]);
    await http()
      .put(`/transactions/${tx.body._id}`)
      .set(as(bob))
      .send({ amount: 1 })
      .expect(404);
    await http()
      .delete(`/transactions/${tx.body._id}`)
      .set(as(bob))
      .expect(404);
    await http()
      .post('/transactions')
      .set(as(bob))
      .send({
        type: 'deposit',
        amount: 5,
        category: 'Savings',
        date: '2026-11-01',
        goal: aliceGoal.body._id,
      })
      .expect(400);

    const aliceTxs = await http()
      .get('/transactions')
      .set(as(alice))
      .expect(200);
    expect(aliceTxs.body).toHaveLength(1);
    expect(aliceTxs.body[0]).toMatchObject({ amount: 25 });
  });

  it('scopes the piggy bank to the caller and never goes negative', async () => {
    await http()
      .patch('/piggy-bank/deposit')
      .set(as(alice))
      .send({ amount: 100 })
      .expect(200);
    const bobBank = await http().get('/piggy-bank').set(as(bob)).expect(200);
    expect(bobBank.body).toEqual({});

    const overdraw = await http()
      .patch('/piggy-bank/withdraw')
      .set(as(alice))
      .send({ amount: 150 })
      .expect(200);
    expect(overdraw.body).toEqual({});

    await Promise.all(
      Array.from({ length: 5 }, () =>
        http().patch('/piggy-bank/deposit').set(as(alice)).send({ amount: 10 }),
      ),
    );
    const bank = await http().get('/piggy-bank').set(as(alice)).expect(200);
    expect(bank.body.amount).toBe(150);
  });

  it('keeps budgets private to their owner', async () => {
    const budget = await http()
      .post('/budgets')
      .set(as(alice))
      .send({ name: 'Food', amount: 300, category: 'Food', period: 'monthly' })
      .expect(201);
    expect(
      (await http().get('/budgets').set(as(bob)).expect(200)).body,
    ).toEqual([]);
    await http().get(`/budgets/${budget.body._id}`).set(as(bob)).expect(404);
    await http().delete(`/budgets/${budget.body._id}`).set(as(bob)).expect(404);
  });

  it('only lets profile settings be changed, not points or identity', async () => {
    const updated = await http()
      .patch('/users/me')
      .set(as(alice))
      .send({ currency: 'EUR', points: 99999, telegramId: 1 })
      .expect(200);
    expect(updated.body).toMatchObject({
      currency: 'EUR',
      points: 0,
      telegramId: alice.id,
    });
    await http()
      .patch('/users/me')
      .set(as(alice))
      .send({ currency: 'BTC' })
      .expect(400);
  });

  it('lets only the recipient answer a friend request', async () => {
    const aliceId = (await http().get('/users/me').set(as(alice))).body
      ._id as string;
    const bobId = (await http().get('/users/me').set(as(bob))).body
      ._id as string;

    await http()
      .post('/friends')
      .set(as(alice))
      .send({ recipientId: aliceId })
      .expect(400);
    const fr = await http()
      .post('/friends')
      .set(as(alice))
      .send({ recipientId: bobId, requesterId: 'spoofed' })
      .expect(201);
    expect(String(fr.body.requester)).toBe(aliceId);

    await http()
      .post(`/friends/${fr.body._id}/accept`)
      .set(as(alice))
      .expect(404);
    await http()
      .post(`/friends/${fr.body._id}/accept`)
      .set(as(bob))
      .expect(201);
    await http()
      .post(`/friends/${fr.body._id}/reject`)
      .set(as(bob))
      .expect(404);

    const bobFriends = await http()
      .get('/users/me/friends')
      .set(as(bob))
      .expect(200);
    expect(bobFriends.body).toEqual([
      expect.objectContaining({ firstName: 'Alice' }),
    ]);
    expect(bobFriends.body[0].telegramId).toBeUndefined();
  });

  it('exposes only public fields on the leaderboard', async () => {
    const board = await http()
      .get('/gamification/leaderboard')
      .set(as(bob))
      .expect(200);
    expect(board.body.length).toBeGreaterThan(0);
    for (const entry of board.body) {
      expect(Object.keys(entry).sort()).toEqual(
        expect.arrayContaining(['_id', 'firstName', 'points']),
      );
      expect(entry.telegramId).toBeUndefined();
      expect(entry.friends).toBeUndefined();
    }
  });

  it('does not expose the removed user directory endpoints', async () => {
    await http().get('/users').set(as(bob)).expect(404);
    await http()
      .post('/users')
      .set(as(bob))
      .send({ telegramId: 5 })
      .expect(404);
  });
});
