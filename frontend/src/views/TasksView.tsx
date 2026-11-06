import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import type { Task } from '../types';
import { useTranslation } from 'react-i18next';

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(s: string): string | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

type FilterTab = 'all' | 'open' | 'done';

interface TasksViewProps {
  userId: string | null;
}

const TasksView = ({ userId }: TasksViewProps) => {
  const { t, i18n } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('open');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueLocal, setDueLocal] = useState('');
  const [reminderRows, setReminderRows] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchTasks = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const status =
        filter === 'all' ? 'all' : filter === 'open' ? 'open' : 'done';
      const { data } = await api.get<Task[]>(`/tasks?status=${status}`);
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [userId, filter]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const onUpd = () => void fetchTasks();
    window.addEventListener('tasksUpdated', onUpd);
    return () => window.removeEventListener('tasksUpdated', onUpd);
  }, [fetchTasks]);

  const sortedTasks = useMemo(() => {
    const priOrder = { high: 0, medium: 1, low: 2 };
    return [...tasks].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'open' ? -1 : 1;
      }
      const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      if (da !== db) return da - db;
      return priOrder[a.priority] - priOrder[b.priority];
    });
  }, [tasks]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueLocal('');
    setReminderRows(['']);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setDueLocal(task.dueAt ? toDatetimeLocalValue(task.dueAt) : '');
    const fires = task.reminders?.length
      ? task.reminders.map((r) => toDatetimeLocalValue(r.fireAt))
      : [''];
    setReminderRows(fires);
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const tit = title.trim();
    if (!tit) {
      setError(t('fill_all_fields'));
      return;
    }
    setSaving(true);
    setError('');
    const dueIso = fromDatetimeLocalValue(dueLocal);
    const reminderFireTimes = reminderRows
      .map((r) => fromDatetimeLocalValue(r))
      .filter((x): x is string => Boolean(x));
    try {
      if (editing) {
        await api.patch(`/tasks/${editing._id}`, {
          title: tit,
          description: description.trim() || undefined,
          priority,
          dueAt: dueIso ?? null,
          reminderFireTimes,
        });
      } else {
        await api.post('/tasks', {
          title: tit,
          description: description.trim() || undefined,
          priority,
          dueAt: dueIso,
          reminderFireTimes:
            reminderFireTimes.length > 0 ? reminderFireTimes : undefined,
        });
      }
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
      closeModal();
      void fetchTasks();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      setError(typeof msg === 'string' ? msg : t('save_error'));
    } finally {
      setSaving(false);
    }
  };

  const completeTask = async (task: Task) => {
    try {
      await api.post(`/tasks/${task._id}/complete`);
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
      void fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const reopenTask = async (task: Task) => {
    try {
      await api.patch(`/tasks/${task._id}`, { status: 'open' });
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
      void fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTask = async (task: Task) => {
    if (!window.confirm(`${t('delete')} «${task.title}»?`)) return;
    try {
      await api.delete(`/tasks/${task._id}`);
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
      void fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const priClass = (p: Task['priority']) =>
    p === 'high'
      ? 'bg-red-500/25 text-red-200 border-red-500/40'
      : p === 'low'
        ? 'bg-white/10 text-[color:var(--text-secondary-color)] border-white/15'
        : 'bg-amber-500/20 text-amber-100 border-amber-500/35';

  const priLabel = (p: Task['priority']) =>
    p === 'high'
      ? t('task_priority_high')
      : p === 'low'
        ? t('task_priority_low')
        : t('task_priority_medium');

  return (
    <section className="mb-8">
      <div className="mb-5 flex flex-col gap-1.5">
        <h2 className="capy-page-title">{t('tasks')}</h2>
        <p className="text-sm leading-relaxed text-[color:var(--text-secondary-color)]">{t('tasks_subtitle')}</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['open', 'all', 'done'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`capy-pill py-2 text-xs font-semibold ${
              filter === f ? 'capy-pill-active' : 'capy-pill-idle'
            }`}
          >
            {f === 'all'
              ? t('task_filter_all')
              : f === 'open'
                ? t('task_filter_open')
                : t('task_filter_done')}
          </button>
        ))}
      </div>

      <button type="button" onClick={openCreate} className="capy-btn-primary mb-4">
        {t('task_add')}
      </button>

      {loading ? (
        <p className="text-[color:var(--text-secondary-color)]">{t('loading')}</p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-[color:var(--text-secondary-color)] text-center py-8">
          {t('task_no_tasks')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sortedTasks.map((task) => (
            <li key={task._id} className="capy-card p-4">
              <div className="flex justify-between gap-2 items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${priClass(task.priority)}`}
                    >
                      {priLabel(task.priority)}
                    </span>
                    {task.status === 'done' && (
                      <span className="text-[10px] text-green-400">
                        {t('task_filter_done')}
                      </span>
                    )}
                    {task.status === 'cancelled' && (
                      <span className="text-[10px] text-gray-400">
                        ×
                      </span>
                    )}
                  </div>
                  <h3
                    className={`font-semibold text-[color:var(--text-color)] ${task.status === 'done' ? 'line-through opacity-70' : ''}`}
                  >
                    {task.title}
                  </h3>
                  {task.description ? (
                    <p className="text-sm text-[color:var(--text-secondary-color)] mt-1 line-clamp-3">
                      {task.description}
                    </p>
                  ) : null}
                  {task.dueAt ? (
                    <p className="text-xs text-[color:var(--text-secondary-color)] mt-2">
                      {t('task_due')}:{' '}
                      {new Date(task.dueAt).toLocaleString(
                        i18n.language === 'ru' ? 'ru-RU' : 'en-US',
                        {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    </p>
                  ) : null}
                  {task.reminders?.length ? (
                    <p className="text-xs text-[color:var(--text-secondary-color)] mt-1">
                      {t('task_reminders')}: {task.reminders.length} (
                      {
                        task.reminders.filter((r) => r.sentAt).length
                      }{' '}
                      {t('task_sent')})
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {task.status === 'open' && (
                  <button
                    type="button"
                    onClick={() => void completeTask(task)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-green-600/30 text-green-100 font-medium"
                  >
                    {t('task_complete')}
                  </button>
                )}
                {(task.status === 'done' || task.status === 'cancelled') && (
                  <button
                    type="button"
                    onClick={() => void reopenTask(task)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-white/10 font-medium"
                  >
                    {t('task_reopen')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(task)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-white/10 font-medium"
                >
                  {t('task_edit')}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteTask(task)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-red-600/25 text-red-200 font-medium"
                >
                  {t('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="capy-card max-h-[90vh] w-full max-w-md overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <h3 className="text-lg font-bold text-[color:var(--text-color)] mb-4">
              {editing ? t('task_edit') : t('task_add')}
            </h3>
            <form onSubmit={(e) => void saveTask(e)} className="flex flex-col gap-3">
              <label className="block">
                <span className="text-xs text-[color:var(--text-secondary-color)]">
                  {t('task_title_label')}
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="capy-input mt-1"
                  placeholder={t('task_title_placeholder')}
                />
              </label>
              <label className="block">
                <span className="text-xs text-[color:var(--text-secondary-color)]">
                  {t('task_description')}
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="capy-input mt-1 resize-none"
                  placeholder={t('task_description_placeholder')}
                />
              </label>
              <label className="block">
                <span className="text-xs text-[color:var(--text-secondary-color)]">
                  {t('task_priority')}
                </span>
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as 'low' | 'medium' | 'high')
                  }
                  className="capy-input mt-1"
                >
                  <option value="low">{t('task_priority_low')}</option>
                  <option value="medium">{t('task_priority_medium')}</option>
                  <option value="high">{t('task_priority_high')}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-[color:var(--text-secondary-color)]">
                  {t('task_due')}
                </span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="datetime-local"
                    value={dueLocal}
                    onChange={(e) => setDueLocal(e.target.value)}
                    className="capy-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setDueLocal('')}
                    className="text-xs px-2 rounded-lg bg-white/10 shrink-0"
                  >
                    {t('task_due_clear')}
                  </button>
                </div>
              </label>
              <div>
                <span className="text-xs text-[color:var(--text-secondary-color)]">
                  {t('task_reminders')}
                </span>
                <p className="text-[11px] text-[color:var(--text-secondary-color)] mt-1 mb-2 opacity-90">
                  {t('task_reminder_hint')}
                </p>
                {reminderRows.map((row, idx) => (
                  <div key={idx} className="mb-2 flex gap-2">
                    <input
                      type="datetime-local"
                      value={row}
                      onChange={(e) => {
                        const next = [...reminderRows];
                        next[idx] = e.target.value;
                        setReminderRows(next);
                      }}
                      className="capy-input flex-1"
                    />
                    {reminderRows.length > 1 && (
                      <button
                        type="button"
                        className="px-2 rounded-lg bg-red-500/20 text-red-200"
                        onClick={() =>
                          setReminderRows(reminderRows.filter((_, j) => j !== idx))
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setReminderRows([...reminderRows, ''])}
                  className="text-sm text-[color:var(--primary-color)] font-medium"
                >
                  + {t('task_reminder_add')}
                </button>
              </div>
              {error ? (
                <p className="text-sm text-red-300">{error}</p>
              ) : null}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl bg-white/10 font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-[color:var(--primary-color)] text-white font-bold disabled:opacity-50"
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default TasksView;
