import type { Db, ObjectId } from 'mongodb';

interface FieldMove {
  collection: string;
  from: string;
  to: string;
}

const FIELD_MOVES: FieldMove[] = [
  { collection: 'transactions', from: 'amount', to: 'amountMinor' },
  { collection: 'piggybanks', from: 'amount', to: 'amountMinor' },
  { collection: 'budgets', from: 'amount', to: 'amountMinor' },
  { collection: 'goals', from: 'targetAmount', to: 'targetAmountMinor' },
  { collection: 'goals', from: 'currentAmount', to: 'currentAmountMinor' },
  {
    collection: 'goals',
    from: 'recurringTransaction.amount',
    to: 'recurringTransaction.amountMinor',
  },
];

const DEBIT_TEXT = 'списано с кошелька';
const CREDIT_TEXT = 'пополнено в кошелек';
const NO_GOAL = { $not: ['$goal'] };

export interface MoneyMigrationReport {
  dryRun: boolean;
  moved: Array<{
    field: string;
    documents: number;
    sumMajor: number;
    sumMinorAdded: number;
  }>;
  currencyUpdated: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

async function sumField(db: Db, move: FieldMove, field: string) {
  const [row] = await db
    .collection(move.collection)
    .aggregate<{ total: number; count: number }>([
      { $match: { [field]: { $type: 'number' } } },
      {
        $group: { _id: null, total: { $sum: `$${field}` }, count: { $sum: 1 } },
      },
    ])
    .toArray();
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}

/** Связь операции с кошельком раньше хранилась в тексте описания. */
async function deriveWalletEffect(db: Db) {
  const contains = (text: string) => ({
    $regexMatch: { input: { $ifNull: ['$description', ''] }, regex: text },
  });
  const stripped = {
    $trim: {
      input: {
        $replaceAll: {
          input: {
            $replaceAll: {
              input: { $ifNull: ['$description', ''] },
              find: `(${DEBIT_TEXT})`,
              replacement: '',
            },
          },
          find: `(${CREDIT_TEXT})`,
          replacement: '',
        },
      },
    },
  };

  await db
    .collection('transactions')
    .updateMany({ amount: { $exists: true } }, [
      {
        $set: {
          walletEffect: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [{ $eq: ['$type', 'expense'] }, contains(DEBIT_TEXT)],
                  },
                  then: 'debit',
                },
                {
                  case: {
                    $and: [{ $eq: ['$type', 'income'] }, contains(CREDIT_TEXT)],
                  },
                  then: 'credit',
                },
                {
                  case: { $and: [{ $eq: ['$type', 'withdraw'] }, NO_GOAL] },
                  then: 'debit',
                },
                {
                  case: { $and: [{ $eq: ['$type', 'deposit'] }, NO_GOAL] },
                  then: 'credit',
                },
              ],
              default: '$$REMOVE',
            },
          },
          description: {
            $cond: [{ $ifNull: ['$description', false] }, stripped, '$$REMOVE'],
          },
        },
      },
    ]);
}

async function fillCurrency(db: Db) {
  let updated = 0;
  const users = (await db.collection('transactions').distinct('user', {
    currency: { $exists: false },
  })) as ObjectId[];
  for (const user of users) {
    const owner = await db
      .collection<{ _id: ObjectId; currency?: string }>('users')
      .findOne({ _id: user });
    const result = await db
      .collection('transactions')
      .updateMany(
        { user, currency: { $exists: false } },
        { $set: { currency: owner?.currency ?? 'USD' } },
      );
    updated += result.modifiedCount;
  }
  return updated;
}

/**
 * Переводит суммы из float в целые копейки. Безопасно запускать повторно:
 * обрабатываются только документы со старыми полями. Если сумма после
 * перевода разошлась больше чем на округление, запуск падает.
 */
export async function migrateMoney(
  db: Db,
  { dryRun = false } = {},
): Promise<MoneyMigrationReport> {
  const report: MoneyMigrationReport = {
    dryRun,
    moved: [],
    currencyUpdated: 0,
  };

  if (!dryRun) {
    await deriveWalletEffect(db);
  }

  for (const move of FIELD_MOVES) {
    const before = await sumField(db, move, move.from);
    const minorBefore = await sumField(db, move, move.to);

    if (!dryRun && before.count > 0) {
      await db
        .collection(move.collection)
        .updateMany({ [move.from]: { $type: 'number' } }, [
          {
            $set: {
              [move.to]: { $round: [{ $multiply: [`$${move.from}`, 100] }, 0] },
            },
          },
          { $unset: move.from },
        ]);
    }

    const minorAfter = dryRun ? minorBefore : await sumField(db, move, move.to);
    const added = minorAfter.total - minorBefore.total;

    if (
      !dryRun &&
      Math.abs(added / 100 - before.total) > before.count * 0.005 + 1e-6
    ) {
      throw new Error(
        `Sum mismatch for ${move.collection}.${move.from}: ${before.total} -> ${added / 100}`,
      );
    }

    report.moved.push({
      field: `${move.collection}.${move.from}`,
      documents: before.count,
      sumMajor: round2(before.total),
      sumMinorAdded: added,
    });
  }

  if (!dryRun) {
    report.currencyUpdated = await fillCurrency(db);
  }

  return report;
}
