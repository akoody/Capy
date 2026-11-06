import { useEffect, useState } from 'react';
import api from '../services/api';
import type { TransactionCategory } from '../types';
import { useTranslation } from 'react-i18next';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const ManageCategoriesModal = ({
  isOpen,
  onClose,
  onChanged,
}: ManageCategoriesModalProps) => {
  const { t } = useTranslation();
  const [list, setList] = useState<TransactionCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'expense' | 'income' | 'both'>('both');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get<TransactionCategory[]>('/transaction-categories')
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onVoiceCategories = () => {
      void api
        .get<TransactionCategory[]>('/transaction-categories')
        .then((r) => setList(Array.isArray(r.data) ? r.data : []))
        .catch(() => setList([]));
    };
    window.addEventListener('capyCategoriesUpdated', onVoiceCategories);
    return () =>
      window.removeEventListener('capyCategoriesUpdated', onVoiceCategories);
  }, [isOpen]);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const n = name.trim();
    if (!n) {
      setError(t('fill_all_fields'));
      return;
    }
    try {
      await api.post('/transaction-categories', {
        name: n,
        kind,
        description: desc.trim() || undefined,
      });
      setName('');
      setDesc('');
      setKind('both');
      load();
      onChanged();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      setError(typeof msg === 'string' ? msg : t('save_error'));
    }
  };

  const startEdit = (c: TransactionCategory) => {
    setEditingId(c._id);
    setEditDesc(c.description || '');
  };

  const saveEdit = async (c: TransactionCategory) => {
    try {
      await api.patch(`/transaction-categories/${c._id}`, {
        description: editDesc.trim() || undefined,
      });
      setEditingId(null);
      load();
      onChanged();
    } catch {
      setError(t('save_error'));
    }
  };

  const archive = async (c: TransactionCategory) => {
    if (!window.confirm(`${t('delete')} «${c.name}»?`)) return;
    try {
      await api.delete(`/transaction-categories/${c._id}`);
      load();
      onChanged();
    } catch {
      setError(t('save_error'));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-[color:var(--card-border-color)] bg-[color:var(--card-bg-color)] p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[color:var(--text-color)]">
            {t('tx_categories_manage')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[color:var(--text-secondary-color)] p-1"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-[color:var(--text-secondary-color)] mb-4">
          {t('tx_categories_manage_hint')}
        </p>

        <form onSubmit={addCategory} className="mb-6 space-y-3 border-b border-white/10 pb-4">
          <p className="text-sm font-medium text-[color:var(--text-color)]">
            {t('tx_category_new')}
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('category')}
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-[color:var(--text-color)]"
          />
          <select
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as 'expense' | 'income' | 'both')
            }
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-[color:var(--text-color)]"
          >
            <option value="expense">{t('tx_category_kind_expense')}</option>
            <option value="income">{t('tx_category_kind_income')}</option>
            <option value="both">{t('tx_category_kind_both')}</option>
          </select>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t('tx_category_desc_placeholder')}
            rows={2}
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-[color:var(--text-color)] resize-none text-sm"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-[color:var(--primary-color)] text-white font-semibold"
          >
            {t('tx_category_add_btn')}
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-[color:var(--text-secondary-color)]">{t('loading')}</p>
        ) : (
          <ul className="space-y-3">
            {list.map((c) => (
              <li
                key={c._id}
                className="rounded-xl border border-white/10 bg-black/15 p-3"
              >
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <p className="font-semibold text-[color:var(--text-color)]">
                      {c.name}
                    </p>
                    <p className="text-[10px] uppercase text-[color:var(--text-secondary-color)]">
                      {c.kind === 'expense'
                        ? t('tx_category_kind_expense')
                        : c.kind === 'income'
                          ? t('tx_category_kind_income')
                          : t('tx_category_kind_both')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void archive(c)}
                    className="text-xs text-red-300 shrink-0"
                  >
                    {t('delete')}
                  </button>
                </div>
                {editingId === c._id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg bg-black/30 border border-white/10 px-2 py-1 text-sm text-[color:var(--text-color)]"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveEdit(c)}
                        className="text-xs px-2 py-1 rounded bg-[color:var(--primary-color)] text-white"
                      >
                        {t('save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs px-2 py-1 rounded bg-white/10"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {c.description ? (
                      <p className="text-xs text-[color:var(--text-secondary-color)] mt-2">
                        {c.description}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-xs text-[color:var(--primary-color)] mt-2"
                    >
                      {t('tx_category_edit_desc')}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ManageCategoriesModal;
