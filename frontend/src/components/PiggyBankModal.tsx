import { useState } from 'react';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';

interface PiggyBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string | null;
}

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  MDL: 'L',
  RUB: '₽',
  EUR: '€',
  GBP: '£',
};

const PiggyBankModal = ({ isOpen, onClose, onSuccess, userId }: PiggyBankModalProps) => {
  const { currency } = useCurrency();
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');

  const handleTransaction = async () => {
    if (!amount || Number(amount) <= 0) {
      setError(t('enter_valid_amount'));
      return;
    }

    if (!userId) {
      setError(t('user_not_found'));
      return;
    }

    try {
      // Update piggy bank balance
      await api.patch(`/piggy-bank/${mode}`,
        {
          userId,
          amount: Number(amount),
        },
      );

      // Create a transaction for wallet history
      try {
        await api.post('/transactions', {
          user: userId,
          type: mode, // 'deposit' or 'withdraw'
          amount: Number(amount),
          category: t('piggy_bank'),
          description: mode === 'deposit' ? t('deposit') : t('withdraw'),
          date: new Date().toISOString().split('T')[0],
        });
      } catch (txErr) {
        console.error('Failed to create transaction for wallet history', txErr);
        // Don't fail the whole operation if transaction creation fails
      }

      // Dispatch event to update wallet balance in other views
      window.dispatchEvent(new CustomEvent('walletUpdated'));

      onSuccess();
      onClose();
    } catch (err) {
      console.error(`Failed to make a piggy bank ${mode}`, err);
      setError(`Failed to make a ${mode}.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50" onClick={onClose}>
      <div className="bg-[color:var(--card-bg-color)] rounded-2xl p-8 w-full max-w-sm border border-[color:var(--card-border-color)] shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center mb-6">
          <button onClick={() => setMode('deposit')} className={`px-4 py-2 text-sm font-medium ${mode === 'deposit' ? 'border-b-2 border-[color:var(--primary-color)] text-[color:var(--primary-color)]' : 'text-[color:var(--text-secondary-color)]'}`}>{t('deposit')}</button>
          <button onClick={() => setMode('withdraw')} className={`px-4 py-2 text-sm font-medium ${mode === 'withdraw' ? 'border-b-2 border-[color:var(--primary-color)] text-[color:var(--primary-color)]' : 'text-[color:var(--text-secondary-color)]'}`}>{t('withdraw')}</button>
        </div>
        
        <div className="my-4">
          <label htmlFor="amount" className="block text-sm font-medium text-left mb-1 text-[color:var(--text-secondary-color)]">{t('amount')}, {currencySymbols[currency]}</label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-full px-4 py-3 bg-[color:var(--bg-color)] border-[color:var(--card-border-color)] rounded-lg shadow-sm placeholder-[color:var(--text-secondary-color)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all text-white"
            required
          />
        </div>

        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <div className="flex justify-end space-x-3 mt-5">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-[color:var(--card-border-color)] text-[color:var(--text-color)] rounded-lg hover:opacity-80 transition-colors">{t('cancel')}</button>
          <button onClick={handleTransaction} className={`px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity shadow-lg ${mode === 'deposit' ? 'bg-[color:var(--primary-color)] text-black' : 'bg-red-500 text-white'}`}>
            {mode === 'deposit' ? t('deposit') : t('withdraw')}
          </button>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 text-[color:var(--text-secondary-color)] hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default PiggyBankModal;
