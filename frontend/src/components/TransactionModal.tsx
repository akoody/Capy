import { useState, useEffect } from 'react';
import api from '../services/api';
import { Goal } from '../types';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../context/CurrencyContext';

type TransactionType = 'deposit' | 'withdraw';

interface TransactionModalProps {
  goal: Goal | null;
  onClose: () => void;
  onDepositSuccess: () => void;
}

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  MDL: 'L',
  RUB: '₽',
  EUR: '€',
  GBP: '£',
};

const TransactionModal = ({ goal, onClose, onDepositSuccess }: TransactionModalProps) => {
  const { t, i18n } = useTranslation();
  const { currency } = useCurrency();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [type, setType] = useState<TransactionType>('deposit');
  const [forecast, setForecast] = useState<string>('');

  useEffect(() => {
    if (goal && type === 'deposit') {
      const now = new Date();
      const createdAt = new Date(goal.createdAt);
      const daysSinceCreation = Math.max(1, (now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24));
      
      const dailyAverage = goal.currentAmount / daysSinceCreation;
      const inputAmount = Number(amount) || 0;
      const newCurrentAmount = goal.currentAmount + inputAmount;
      const remainingAmount = goal.targetAmount - newCurrentAmount;

      if (dailyAverage > 0 && remainingAmount > 0) {
        const daysToGoal = remainingAmount / dailyAverage;
        const estimatedDate = new Date();
        estimatedDate.setDate(now.getDate() + daysToGoal);
        const formattedDate = estimatedDate.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        
        if (inputAmount > 0) {
          setForecast(t('forecast_after_deposit', { date: formattedDate }));
        } else {
          setForecast(t('forecast_current_pace', { date: formattedDate }));
        }
      } else if (newCurrentAmount >= goal.targetAmount) {
        setForecast(t('goal_will_be_achieved'));
      } else {
        setForecast(t('start_depositing_for_forecast'));
      }
    } else {
      setForecast('');
    }
  }, [goal, amount, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!goal || !amount || Number(amount) <= 0) {
      setError(t('enter_valid_amount'));
      return;
    }

    const endpoint = type === 'deposit' ? 'deposit' : 'withdraw';

    try {
      console.log(`Making ${endpoint} request for goal ${goal._id} with amount ${amount}`);
      await api.patch(`/goals/${goal._id}/${endpoint}`, {
        amount: Number(amount),
      });
      console.log(`${endpoint} successful, calling onDepositSuccess`);
      onDepositSuccess();
      onClose();
    } catch (err: any) {
      console.error(`Failed to ${type}`, err);
      setError(err.response?.data?.message || `Failed to ${type}. Please try again.`);
    }
  };

  if (!goal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50" onClick={onClose}>
      <div className="bg-white/10 rounded-2xl p-6 w-full max-w-sm border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-1 text-[color:var(--text-header)]">{type === 'deposit' ? t('deposit') : t('withdraw')}</h3>
        <p className="text-sm text-[color:var(--text-secondary)] mb-6">{t('transaction_for', { goalName: goal.name })}</p>

        <div className="grid grid-cols-2 gap-2 mb-6 bg-black/20 p-1 rounded-lg">
          <button onClick={() => setType('deposit')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${type === 'deposit' ? 'bg-[color:var(--primary-color)]' : 'text-gray-400 hover:bg-white/5'}`}>
            {t('deposit')}
          </button>
          <button onClick={() => setType('withdraw')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${type === 'withdraw' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
            {t('withdraw')}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
          <div className="mb-4">
            <label htmlFor="transaction-amount" className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">{t('amount')}, {currencySymbols[currency]}</label>
            <input
              type="number"
              id="transaction-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
              className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
              required
              autoFocus
            />
          </div>

          {forecast && (
            <div className="text-center text-xs text-[color:var(--text-secondary)] bg-black/20 py-2 px-3 rounded-md mb-6">
              {forecast}
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-5">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-black/20 text-gray-300 rounded-lg hover:bg-black/30 transition-colors">{t('cancel')}</button>
            <button type="submit" className="px-5 py-2.5 text-white rounded-lg transition-opacity hover:opacity-90 shadow-lg" style={{ backgroundColor: type === 'deposit' ? 'var(--primary-color)' : '#F13C20' }}>
              {type === 'deposit' ? t('deposit') : t('withdraw')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;