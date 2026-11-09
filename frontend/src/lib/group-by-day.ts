export interface DayGroup<T> {
  label: string;
  items: T[];
}

interface GroupByDayOptions<T> {
  /** Дата, по которой элемент попадает в день. */
  day: (item: T) => string;
  /** Время для сортировки внутри дня, новые сверху. */
  time: (item: T) => string;
  locale: string;
}

/** Группы по календарным дням: сначала самые свежие. */
export function groupByDay<T>(
  items: readonly T[],
  { day, time, locale }: GroupByDayOptions<T>,
): DayGroup<T>[] {
  const newestFirst = [...items].sort(
    (a, b) => new Date(time(b)).getTime() - new Date(time(a)).getTime(),
  );
  const groups = new Map<string, T[]>();
  for (const item of newestFirst) {
    const label = new Date(day(item)).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return Array.from(groups, ([label, grouped]) => ({ label, items: grouped }));
}

export const localeTag = (language: string) =>
  language === 'ru' ? 'ru-RU' : 'en-US';
