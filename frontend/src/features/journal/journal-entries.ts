import type { JournalEntry } from '../../types';

export type JournalSort = 'date' | 'recent';

/** Время записи: «Недавние» сортируют по моменту создания, а не по дате записи. */
export const entrySortTime = (entry: JournalEntry, sort: JournalSort) =>
  sort === 'recent'
    ? entry.createdAt || entry.date
    : entry.date || entry.createdAt;

export const entryDay = (entry: JournalEntry) => entry.date || entry.createdAt;

export function collectTags(entries: readonly JournalEntry[]): string[] {
  return Array.from(new Set(entries.flatMap((e) => e.tags ?? []))).sort();
}

export function filterEntries(
  entries: readonly JournalEntry[],
  query: string,
  tag: string | null,
): JournalEntry[] {
  const needle = query.toLowerCase();
  return entries.filter(
    (entry) =>
      (!tag || entry.tags?.includes(tag)) &&
      (!needle ||
        entry.content.toLowerCase().includes(needle) ||
        entry.title?.toLowerCase().includes(needle) ||
        entry.tags?.some((t) => t.toLowerCase().includes(needle))),
  );
}

export function entriesCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  let word = 'записей';
  if (last === 1 && lastTwo !== 11) word = 'запись';
  else if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14))
    word = 'записи';
  return `${count} ${word}`;
}
