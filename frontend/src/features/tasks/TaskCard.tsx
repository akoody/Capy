import { useTranslation } from 'react-i18next';
import { localeTag } from '../../lib/group-by-day';
import type { Task } from '../../types';

interface TaskCardProps {
  task: Task;
  onComplete: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const PRIORITY_CLASS: Record<Task['priority'], string> = {
  high: 'bg-red-500/25 text-red-200 border-red-500/40',
  medium: 'bg-amber-500/20 text-amber-100 border-amber-500/35',
  low: 'bg-white/10 text-[color:var(--text-secondary-color)] border-white/15',
};

const TaskCard = ({ task, onComplete, onReopen, onEdit, onDelete }: TaskCardProps) => {
  const { t, i18n } = useTranslation();

  return (
      <li key={task._id} className="capy-card p-4">
        <div className="flex justify-between gap-2 items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${PRIORITY_CLASS[task.priority]}`}
              >
                {t(`task_priority_${task.priority}`)}
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
                  localeTag(i18n.language),
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
              onClick={onComplete}
              className="text-sm px-3 py-1.5 rounded-lg bg-green-600/30 text-green-100 font-medium"
            >
              {t('task_complete')}
            </button>
          )}
          {(task.status === 'done' || task.status === 'cancelled') && (
            <button
              type="button"
              onClick={onReopen}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/10 font-medium"
            >
              {t('task_reopen')}
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="text-sm px-3 py-1.5 rounded-lg bg-white/10 font-medium"
          >
            {t('task_edit')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-sm px-3 py-1.5 rounded-lg bg-red-600/25 text-red-200 font-medium"
          >
            {t('delete')}
          </button>
        </div>
      </li>
  );
};

export default TaskCard;
