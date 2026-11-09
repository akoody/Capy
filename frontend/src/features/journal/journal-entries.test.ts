import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '../../types';
import {
  collectTags,
  entriesCountLabel,
  entrySortTime,
  filterEntries,
} from './journal-entries';

const entry = (over: Partial<JournalEntry>): JournalEntry => ({
  _id: '1',
  content: 'Купил кофе',
  date: '2026-01-01T10:00:00.000Z',
  createdAt: '2026-01-02T10:00:00.000Z',
  user: 'u',
  ...over,
});

describe('journal entries', () => {
  it('declines the entry count in Russian', () => {
    expect(
      [1, 2, 5, 11, 12, 21, 22, 25, 111].map(entriesCountLabel),
    ).toEqual([
      '1 запись',
      '2 записи',
      '5 записей',
      '11 записей',
      '12 записей',
      '21 запись',
      '22 записи',
      '25 записей',
      '111 записей',
    ]);
  });

  it('filters by text, title and tag together', () => {
    const entries = [
      entry({ _id: 'a', tags: ['еда'] }),
      entry({ _id: 'b', title: 'Планы', content: 'Отпуск', tags: ['дом'] }),
    ];
    expect(filterEntries(entries, 'КОФЕ', null).map((e) => e._id)).toEqual(['a']);
    expect(filterEntries(entries, 'план', null).map((e) => e._id)).toEqual(['b']);
    expect(filterEntries(entries, 'кофе', 'дом')).toEqual([]);
  });

  it('sorts recent entries by creation time', () => {
    const e = entry({});
    expect(entrySortTime(e, 'recent')).toBe(e.createdAt);
    expect(entrySortTime(e, 'date')).toBe(e.date);
  });

  it('collects unique sorted tags', () => {
    expect(
      collectTags([entry({ tags: ['b', 'a'] }), entry({ tags: ['a'] })]),
    ).toEqual(['a', 'b']);
  });
});
