import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import api, { apiErrorMessage } from '../../services/api';
import type { JournalEntry } from '../../types';

interface JournalEntryModalProps {
  /** Запись для редактирования, null — новая. Компонент монтируется на каждое открытие. */
  entry: JournalEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

const JournalEntryModal = ({ entry, onClose, onSaved }: JournalEntryModalProps) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(entry?.title ?? '');
  const [content, setContent] = useState(entry?.content ?? '');
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!content.trim()) return;

    const body = {
      title: title.trim() || undefined,
      content: content.trim(),
      tags: tags.length > 0 ? tags : undefined,
    };
    setSaving(true);
    try {
      if (entry) {
        await api.patch(`/journal/${entry._id}`, body);
      } else {
        await api.post('/journal', { ...body, date: new Date().toISOString() });
      }
      onSaved();
    } catch (error) {
      console.error('Failed to save entry', error);
      alert(apiErrorMessage(error, t('save_error') || 'Не удалось сохранить запись'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--card-bg-color)] rounded-2xl p-6 w-full max-w-md border border-[color:var(--card-border-color)] shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[color:var(--text-color)]">
            {entry ? t('edit_entry') || 'Редактировать запись' : t('new_entry') || 'Новая запись'}
          </h2>
          <button onClick={onClose} className="text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] transition-colors p-1">
            <Icon name="close" className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-2">
              {t('title') || 'Заголовок'} (необязательно)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('title_placeholder') || 'Заголовок записи...'}
              className="w-full bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-4 py-2 border border-[color:var(--card-border-color)] focus:border-[color:var(--primary-color)] focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-2">
              {t('content') || 'Содержание'} *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('content_placeholder') || 'Напишите ваши мысли...'}
              className="w-full bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-4 py-3 border border-[color:var(--card-border-color)] focus:border-[color:var(--primary-color)] focus:outline-none resize-none"
              rows={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-2">
              Теги (необязательно)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Добавить тег..."
                className="flex-1 max-w-[200px] bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-3 py-2 border border-[color:var(--card-border-color)] focus:border-[color:var(--primary-color)] focus:outline-none transition-colors text-sm"
              />
              <button
                onClick={handleAddTag}
                className="w-10 h-10 bg-[color:var(--primary-color)] text-white rounded-lg hover:opacity-80 transition-opacity flex items-center justify-center shrink-0"
              >
                <Icon name="plus" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-[color:var(--card-bg-color)] text-[color:var(--text-secondary-color)] rounded-lg text-sm border border-[color:var(--card-border-color)]"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-white transition-colors"
                    >
                      <Icon name="close" className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-4 py-2 hover:opacity-80 transition-opacity font-medium border border-[color:var(--card-border-color)]"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim() || saving}
            className="flex-1 bg-[color:var(--primary-color)] text-white rounded-lg px-4 py-2 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity font-medium"
          >
            {saving ? t('saving') || 'Сохранение...' : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JournalEntryModal;
