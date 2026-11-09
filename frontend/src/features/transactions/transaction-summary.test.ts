import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types';
import { currencySymbol, summarizeMonth } from './transaction-summary';

const NOW = new Date(2026, 5, 15);

const tx = (over: Partial<Transaction>): Transaction => ({
  _id: '1',
  amount: 1,
  type: 'expense',
  category: 'c',
  date: new Date(2026, 5, 10).toISOString(),
  ...over,
});

describe('summarizeMonth', () => {
  it('sums without float drift', () => {
    const result = summarizeMonth(
      [
        tx({ type: 'income', amount: 0.1 }),
        tx({ type: 'income', amount: 0.2 }),
      ],
      NOW,
    );
    expect(result.income).toBe(0.3);
    expect(result.balance).toBe(0.3);
  });

  it('ignores other months, other years and wallet transfers', () => {
    const result = summarizeMonth(
      [
        tx({ amount: 5 }),
        tx({ amount: 7, date: new Date(2026, 4, 10).toISOString() }),
        tx({ amount: 9, date: new Date(2025, 5, 10).toISOString() }),
        tx({ amount: 11, type: 'deposit' }),
      ],
      NOW,
    );
    expect(result.expense).toBe(5);
    expect(result.expenses).toHaveLength(1);
  });
});

describe('currencySymbol', () => {
  it('falls back to the code for unknown currencies', () => {
    expect(currencySymbol('GBP')).toBe('£');
    expect(currencySymbol('KZT')).toBe('KZT');
  });
});
