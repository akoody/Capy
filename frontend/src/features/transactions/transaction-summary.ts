import type { Transaction } from '../../types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  RUB: '₽',
  MDL: 'L',
};

export const currencySymbol = (currency: string) =>
  CURRENCY_SYMBOLS[currency] ?? currency;

/** В ленту входят только доходы и расходы, операции с копилкой и целями нет. */
export const isCashflow = (t: Transaction) =>
  t.type === 'income' || t.type === 'expense';

export const transactionTime = (t: Transaction) => t.createdAt || t.date;

function isSameMonth(iso: string, now: Date): boolean {
  const date = new Date(iso);
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/** Складываем в копейках, иначе 0.1 + 0.2 накапливает ошибку float. */
function sum(transactions: readonly Transaction[]): number {
  const minor = transactions.reduce(
    (total, t) => total + Math.round(t.amount * 100),
    0,
  );
  return minor / 100;
}

export function summarizeMonth(
  transactions: readonly Transaction[],
  now: Date,
) {
  const month = transactions.filter(
    (t) => isCashflow(t) && isSameMonth(t.date, now),
  );
  const expenses = month.filter((t) => t.type === 'expense');
  const income = sum(month.filter((t) => t.type === 'income'));
  const expense = sum(expenses);
  return {
    income,
    expense,
    balance: Math.round((income - expense) * 100) / 100,
    expenses,
  };
}
