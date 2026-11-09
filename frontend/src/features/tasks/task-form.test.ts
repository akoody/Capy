import { describe, expect, it } from 'vitest';
import type { Task } from '../../types';
import {
  draftFromTask,
  draftToPayload,
  emptyTaskDraft,
  fromDatetimeLocalValue,
  sortTasks,
  toDatetimeLocalValue,
} from './task-form';

const task = (over: Partial<Task>): Task => ({
  _id: '1',
  title: 'T',
  status: 'open',
  priority: 'medium',
  reminders: [],
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('task form', () => {
  it('round-trips a local datetime', () => {
    const iso = new Date(2026, 4, 3, 14, 30).toISOString();
    expect(toDatetimeLocalValue(iso)).toBe('2026-05-03T14:30');
    expect(fromDatetimeLocalValue('2026-05-03T14:30')).toBe(iso);
  });

  it('rejects invalid dates', () => {
    expect(toDatetimeLocalValue('nope')).toBe('');
    expect(fromDatetimeLocalValue('nope')).toBeUndefined();
    expect(fromDatetimeLocalValue('  ')).toBeUndefined();
  });

  it('clears the due date explicitly when editing', () => {
    const draft = { ...emptyTaskDraft(), title: ' A ' };
    expect(draftToPayload(draft, true)).toMatchObject({
      title: 'A',
      dueAt: null,
      reminderFireTimes: [],
    });
  });

  it('omits empty optional fields when creating', () => {
    const payload = draftToPayload({ ...emptyTaskDraft(), title: 'A' }, false);
    expect(payload.dueAt).toBeUndefined();
    expect(payload.reminderFireTimes).toBeUndefined();
  });

  it('keeps one empty reminder row for a task without reminders', () => {
    expect(draftFromTask(task({})).reminderRows).toEqual(['']);
  });

  it('orders open first, then due date, then priority', () => {
    const sorted = sortTasks([
      task({ _id: 'done', status: 'done' }),
      task({ _id: 'none', priority: 'high' }),
      task({ _id: 'later', dueAt: '2026-02-01T00:00:00.000Z' }),
      task({ _id: 'soon', dueAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(sorted.map((t) => t._id)).toEqual(['soon', 'later', 'none', 'done']);
  });
});
