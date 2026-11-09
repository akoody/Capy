import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import type { Task } from '../../types';
import TaskCard from './TaskCard';
import TaskFormModal from './TaskFormModal';
import { sortTasks } from './task-form';

type FilterTab = 'open' | 'all' | 'done';

const FILTER_LABEL: Record<FilterTab, string> = {
  open: 'task_filter_open',
  all: 'task_filter_all',
  done: 'task_filter_done',
};

interface TasksViewProps {
  userId: string | null;
}

/** undefined — форма закрыта, null — новая задача. */
type EditorState = Task | null | undefined;

const TasksView = ({ userId }: TasksViewProps) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('open');
  const [editing, setEditing] = useState<EditorState>(undefined);

  const fetchTasks = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get<Task[]>(`/tasks?status=${filter}`);
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

  // Задачи меняет и голосовой ассистент.
  useEffect(() => {
    const refresh = () => void fetchTasks();
    window.addEventListener('tasksUpdated', refresh);
    return () => window.removeEventListener('tasksUpdated', refresh);
  }, [fetchTasks]);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);

  /** Подписка в этом же компоненте перезагрузит список. */
  const notifyChanged = () => window.dispatchEvent(new CustomEvent('tasksUpdated'));

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      notifyChanged();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTask = (task: Task) => {
    if (window.confirm(`${t('delete')} «${task.title}»?`)) {
      void run(() => api.delete(`/tasks/${task._id}`));
    }
  };

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
            className={`capy-pill py-2 text-xs font-semibold ${filter === f ? 'capy-pill-active' : 'capy-pill-idle'}`}
          >
            {t(FILTER_LABEL[f])}
          </button>
        ))}
      </div>

      <button type="button" onClick={() => setEditing(null)} className="capy-btn-primary mb-4">
        {t('task_add')}
      </button>

      {loading ? (
        <p className="text-[color:var(--text-secondary-color)]">{t('loading')}</p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-[color:var(--text-secondary-color)] text-center py-8">{t('task_no_tasks')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onComplete={() => void run(() => api.post(`/tasks/${task._id}/complete`))}
              onReopen={() => void run(() => api.patch(`/tasks/${task._id}`, { status: 'open' }))}
              onEdit={() => setEditing(task)}
              onDelete={() => deleteTask(task)}
            />
          ))}
        </ul>
      )}

      {editing !== undefined && userId && (
        <TaskFormModal
          task={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            notifyChanged();
          }}
        />
      )}
    </section>
  );
};

export default TasksView;
