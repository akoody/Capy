import type { Task } from '../../types';

export interface TaskDraft {
  title: string;
  description: string;
  priority: Task['priority'];
  dueLocal: string;
  reminderRows: string[];
}

export const emptyTaskDraft = (): TaskDraft => ({
  title: '',
  description: '',
  priority: 'medium',
  dueLocal: '',
  reminderRows: [''],
});

/** ISO в значение поля datetime-local в часовом поясе устройства. */
export function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    dueLocal: toDatetimeLocalValue(task.dueAt),
    reminderRows: task.reminders?.length
      ? task.reminders.map((r) => toDatetimeLocalValue(r.fireAt))
      : [''],
  };
}

/** Тело запроса: при редактировании пустой срок явно сбрасывается. */
export function draftToPayload(draft: TaskDraft, isEdit: boolean) {
  const dueAt = fromDatetimeLocalValue(draft.dueLocal);
  const reminderFireTimes = draft.reminderRows
    .map(fromDatetimeLocalValue)
    .filter((x): x is string => Boolean(x));
  const common = {
    title: draft.title.trim(),
    description: draft.description.trim() || undefined,
    priority: draft.priority,
  };
  return isEdit
    ? { ...common, dueAt: dueAt ?? null, reminderFireTimes }
    : {
        ...common,
        dueAt,
        reminderFireTimes:
          reminderFireTimes.length > 0 ? reminderFireTimes : undefined,
      };
}

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Открытые выше, затем ближайший срок, затем приоритет. */
export function sortTasks(tasks: readonly Task[]): Task[] {
  const due = (task: Task) =>
    task.dueAt ? new Date(task.dueAt).getTime() : Infinity;
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    if (due(a) !== due(b)) return due(a) - due(b);
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
}
