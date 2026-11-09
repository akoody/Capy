import { describe, expect, it } from 'vitest';
import { groupByDay } from './group-by-day';

const at = (day: number, hour: number) =>
  new Date(2026, 0, day, hour).toISOString();

describe('groupByDay', () => {
  const options = {
    day: (item: { at: string }) => item.at,
    time: (item: { at: string }) => item.at,
    locale: 'en-US',
  };

  it('puts the newest day and the newest item first', () => {
    const groups = groupByDay(
      [{ at: at(1, 9) }, { at: at(2, 8) }, { at: at(2, 20) }],
      options,
    );
    expect(groups.map((g) => g.items.length)).toEqual([2, 1]);
    expect(groups[0].label).toBe('January 2, 2026');
    expect(groups[0].items[0].at).toBe(at(2, 20));
  });

  it('does not mutate the input', () => {
    const input = [{ at: at(1, 9) }, { at: at(2, 8) }];
    groupByDay(input, options);
    expect(input[0].at).toBe(at(1, 9));
  });
});
