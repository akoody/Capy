import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import api, { apiErrorMessage } from '../../services/api';
import type { Task } from '../../types';
import { draftFromTask, draftToPayload, emptyTaskDraft, type TaskDraft } from './task-form';

interface TaskFormModalProps {
  /** Задача для редактирования, null — новая. Компонент монтируется на каждое открытие. */
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
}

const TaskFormModal = ({ task, onClose, onSaved }: TaskFormModalProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TaskDraft>(() => (task ? draftFromTask(task) : emptyTaskDraft()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const patch = (changes: Partial<TaskDraft>) => setDraft((current) => ({ ...current, ...changes }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError(t('fill_all_fields'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = draftToPayload(draft, task !== null);
      if (task) {
        await api.patch(`/tasks/${task._id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, t('save_error')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="capy-card max-h-[90vh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <h3 className="text-lg font-bold text-[color:var(--text-color)] mb-4">
          {task ? t('task_edit') : t('task_add')}
        </h3>
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-3">
          <label className="block">
            <span className="text-xs text-[color:var(--text-secondary-color)]">
              {t('task_title_label')}
            </span>
            <input
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              className="capy-input mt-1"
              placeholder={t('task_title_placeholder')}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[color:var(--text-secondary-color)]">
              {t('task_description')}
            </span>
            <textarea
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
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
              value={draft.priority}
              onChange={(e) =>
                patch({ priority: e.target.value as Task['priority'] })
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
                value={draft.dueLocal}
                onChange={(e) => patch({ dueLocal: e.target.value })}
                className="capy-input flex-1"
              />
              <button
                type="button"
                onClick={() => patch({ dueLocal: '' })}
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
            {draft.reminderRows.map((row, idx) => (
              <div key={idx} className="mb-2 flex gap-2">
                <input
                  type="datetime-local"
                  value={row}
                  onChange={(e) => {
                    const next = [...draft.reminderRows];
                    next[idx] = e.target.value;
                    patch({ reminderRows: next });
                  }}
                  className="capy-input flex-1"
                />
                {draft.reminderRows.length > 1 && (
                  <button
                    type="button"
                    className="px-2 rounded-lg bg-red-500/20 text-red-200"
                    onClick={() =>
                      patch({ reminderRows: draft.reminderRows.filter((_, j) => j !== idx) })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => patch({ reminderRows: [...draft.reminderRows, ''] })}
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
              onClick={onClose}
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
  );
};

export default TaskFormModal;
