import { useState, useEffect } from 'react';
import { Goal } from '../types';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface RecurringTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  onSuccess: () => void;
}

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  MDL: 'L',
  RUB: '₽',
  EUR: '€',
  GBP: '£',
};

const RecurringTransactionModal = ({ isOpen, onClose, goal, onSuccess }: RecurringTransactionModalProps) => {
  const { currency } = useCurrency();
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [startDate, setStartDate] = useState('');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Load current recurring transaction settings when modal opens
  useEffect(() => {
    if (isOpen && goal) {
      if (goal.recurringTransaction) {
        setAmount(goal.recurringTransaction.amount.toString());
        setFrequency(goal.recurringTransaction.frequency);
        setStartDate(goal.recurringTransaction.startDate);
        setIsEditing(true);
      } else {
        setAmount('');
        setFrequency('weekly');
        setStartDate('');
        setIsEditing(false);
      }
      setError('');
    }
  }, [isOpen, goal]);

  const handleClose = () => {
    setAmount('');
    setFrequency('weekly');
    setStartDate('');
    setError('');
    setIsEditing(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!amount || !frequency || !startDate) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      await api.patch(`/goals/${goal?._id}/recurring`, {
        amount: Number(amount),
        frequency,
        startDate,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Failed to set up recurring transaction', err);
      setError('Failed to set up recurring transaction.');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/goals/${goal?._id}/recurring`);
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Failed to delete recurring transaction', err);
      setError('Failed to delete recurring transaction.');
    }
  };

  const getFrequencyText = (freq: string) => {
    switch (freq) {
      case 'daily': return 'ежедневно';
      case 'weekly': return 'еженедельно';
      case 'monthly': return 'ежемесячно';
      default: return freq;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50" onClick={handleClose}>
      <div className="bg-[color:var(--card-bg-color)] rounded-2xl p-8 w-full max-w-sm border border-[color:var(--card-border-color)] shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl font-bold mb-2 text-white">
          {isEditing ? 'Автопополнение настроено' : 'Настроить автопополнение'}
        </h3>
        <p className="text-[color:var(--text-secondary-color)] mb-6">Для цели "{goal?.name}"</p>
        
        {isEditing ? (
          // Show current settings
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-green-400 font-medium">Автопополнение активно</span>
              </div>
              <div className="text-white">
                <div className="text-lg font-semibold">
                  {amount} {currencySymbols[currency]} {getFrequencyText(frequency)}
                </div>
                <div className="text-sm text-gray-400">
                  Начало: {new Date(startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button 
                onClick={() => setIsEditing(false)} 
                className="flex-1 px-4 py-2 bg-[color:var(--primary-color)] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Изменить
              </button>
              <button 
                onClick={handleDelete} 
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Отключить
              </button>
            </div>
          </div>
        ) : (
          // Show form for new setup
          <form onSubmit={handleSubmit}>
            <div className="my-4">
              <label htmlFor="amount" className="block text-sm font-medium text-left mb-1">Сумма</label>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
                required
              />
            </div>

            <div className="my-4">
              <label htmlFor="frequency" className="block text-sm font-medium text-left mb-1">Частота</label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
              >
                <option value="daily">Ежедневно</option>
                <option value="weekly">Еженедельно</option>
                <option value="monthly">Ежемесячно</option>
              </select>
            </div>

            <div className="my-4">
              <label htmlFor="startDate" className="block text-sm font-medium text-left mb-1">Дата начала</label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

            <div className="flex justify-end space-x-3 mt-5">
              <button type="button" onClick={handleClose} className="px-5 py-2.5 bg-black/20 text-gray-300 rounded-lg hover:bg-black/30 transition-colors">Отмена</button>
              <button type="submit" className="px-5 py-2.5 bg-[color:var(--primary-color)] text-white rounded-lg hover:opacity-90 transition-opacity shadow-lg">Сохранить</button>
            </div>
          </form>
        )}

        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

export default RecurringTransactionModal;