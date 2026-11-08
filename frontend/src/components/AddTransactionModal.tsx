import { useState, useEffect, useMemo } from 'react';
import api, { apiErrorMessage } from '../services/api';
import { useTranslation } from 'react-i18next';
import type { TransactionCategory } from '../types';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string | null;
}

const AddTransactionModal = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
}: AddTransactionModalProps) => {
  const { t } = useTranslation();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [deductFromWallet, setDeductFromWallet] = useState(false);
  const [depositToWallet, setDepositToWallet] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<TransactionCategory[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    api
      .get<TransactionCategory[]>('/transaction-categories')
      .then((r) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCategories([]));
  }, [isOpen]);

  const filteredCategories = useMemo(() => {
    return categories.filter(
      (c) => c.kind === 'both' || c.kind === type,
    );
  }, [categories, type]);

  useEffect(() => {
    if (!isOpen) return;
    setAmount('');
    setSelectedCategoryId('');
    setCustomCategory('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setDeductFromWallet(false);
    setDepositToWallet(false);
    setError('');
  }, [isOpen]);

  useEffect(() => {
    setSelectedCategoryId('');
    setCustomCategory('');
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!userId) {
      setError(t('user_not_found'));
      return;
    }
    if (!amount || !date) {
      setError(t('fill_all_fields'));
      return;
    }

    const useId =
      selectedCategoryId &&
      selectedCategoryId !== '__new__' &&
      selectedCategoryId.length > 0;
    const custom = customCategory.trim();
    if (!useId && !custom) {
      setError(t('tx_category_required'));
      return;
    }

    try {
      const affectWallet =
        (deductFromWallet && type === 'expense') ||
        (depositToWallet && type === 'income');

      const body: Record<string, unknown> = {
        type,
        amount: Number(amount),
        date,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(affectWallet ? { affectWallet: true } : {}),
      };
      if (useId) {
        body.categoryId = selectedCategoryId;
      } else {
        body.category = custom;
      }

      await api.post('/transactions', body);

      onSuccess();

      if (affectWallet) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('walletUpdated'));
        }, 200);
      }

      onClose();
    } catch (err) {
      console.error('Failed to create transaction', err);
      setError(apiErrorMessage(err, 'Failed to create transaction. Please try again.'));
    }
  };

  if (!isOpen) return null;

  const showCustomInput =
    selectedCategoryId === '__new__' || filteredCategories.length === 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--card-bg-color)] rounded-2xl p-6 w-full max-w-sm border border-[color:var(--card-border-color)] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-2 gap-2 mb-6 bg-black/20 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${type === 'expense' ? 'text-white' : 'text-[color:var(--text-secondary-color)] hover:bg-white/5'}`}
            style={type === 'expense' ? { backgroundColor: '#F13C20' } : {}}
          >
            {t('expense')}
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${type === 'income' ? 'text-white' : 'text-[color:var(--text-secondary-color)] hover:bg-white/5'}`}
            style={type === 'income' ? { backgroundColor: '#D79922' } : {}}
          >
            {t('income')}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
          )}

          <div className="mb-4">
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-1"
            >
              {t('amount')}
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full box-border px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="categoryPick"
              className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-1"
            >
              {t('category')}
            </label>
            <select
              id="categoryPick"
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                if (e.target.value !== '__new__') setCustomCategory('');
              }}
              className="mt-1 block w-full box-border px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white"
            >
              <option value="">{t('tx_category_select')}</option>
              {filteredCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
              <option value="__new__">{t('tx_category_custom')}</option>
            </select>
            {showCustomInput && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder={t('tx_category_custom_placeholder')}
                className="mt-2 block w-full box-border px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white"
              />
            )}
            <p className="text-[11px] text-[color:var(--text-secondary-color)] mt-1.5 leading-snug">
              {t('tx_category_field_hint')}
            </p>
          </div>

          <div className="mb-4">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-1"
            >
              {t('tx_transaction_note')}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t('tx_transaction_note_placeholder')}
              className="mt-1 block w-full box-border px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white resize-none text-sm"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="date"
              className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-1"
            >
              {t('date')}
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full box-border px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white"
              required
            />
          </div>

          {type === 'expense' && (
            <div className="mb-4 p-4 bg-black/20 border border-white/10 rounded-lg">
              <label
                htmlFor="deductFromWallet"
                className="flex items-center cursor-pointer"
              >
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    id="deductFromWallet"
                    checked={deductFromWallet}
                    onChange={(e) => setDeductFromWallet(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[color:var(--primary-color)] rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[color:var(--primary-color)]" />
                </div>
                <span className="ml-3 text-sm font-medium text-white">
                  {t('deduct_from_wallet')}
                </span>
              </label>
            </div>
          )}

          {type === 'income' && (
            <div className="mb-4 p-4 bg-black/20 border border-white/10 rounded-lg">
              <label
                htmlFor="depositToWallet"
                className="flex items-center cursor-pointer"
              >
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    id="depositToWallet"
                    checked={depositToWallet}
                    onChange={(e) => setDepositToWallet(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[color:var(--primary-color)] rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[color:var(--primary-color)]" />
                </div>
                <span className="ml-3 text-sm font-medium text-white">
                  {t('deposit_to_wallet')}
                </span>
              </label>
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-black/20 text-gray-300 rounded-lg"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[color:var(--primary-color)] text-black rounded-lg"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;
