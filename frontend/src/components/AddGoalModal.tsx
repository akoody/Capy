import { useState } from 'react';
import api from '../services/api';
import { useAchievement } from '../context/AchievementContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';
import IconPicker, { goalIcons } from './IconPicker';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalAdded: () => void;
  userId: string | null;
  goalsCount: number;
}

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  MDL: 'L',
  RUB: '₽',
  EUR: '€',
  GBP: '£',
};

const AddGoalModal = ({ isOpen, onClose, onGoalAdded, userId, goalsCount }: AddGoalModalProps) => {
  const { currency } = useCurrency();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(goalIcons[0]);
  const [error, setError] = useState('');
  const { showAchievement } = useAchievement();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!userId) {
      setError(t('user_not_found'));
      return;
    }
    if (!name || !amount) {
      setError(t('fill_all_fields'));
      return;
    }

    try {
      await api.post('/goals', {
        name,
        targetAmount: Number(amount),
        userId,
        icon: selectedIcon,
      });

      if (goalsCount === 0) {
        showAchievement(t('first_goal'));
      }

      onGoalAdded();
      onClose();
      setName('');
      setAmount('');
      setSelectedIcon(goalIcons[0]);
    } catch (err) {
      console.error('Failed to create goal', err);
      setError(t('failed_to_create_goal'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50" onClick={onClose}>
      <div className="bg-white/10 rounded-2xl p-6 w-full max-w-sm border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-6 text-[color:var(--text-header)]">{t('new_goal')}</h3>
        <form onSubmit={handleSubmit}>
          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
          <IconPicker selectedIcon={selectedIcon} onSelect={setSelectedIcon} />
          <div className="mb-4">
            <label htmlFor="goal-name" className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">{t('goal_name')}</label>
            <input
              type="text"
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('goal_name_placeholder')}
              className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-color)] sm:text-sm transition-all"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="goal-amount" className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">{t('amount')}, {currencySymbols[currency]}</label>
            <input
              type="number"
              id="goal-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="250000"
              className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-color)] sm:text-sm transition-all"
              required
            />
          </div>
          <div className="flex justify-end space-x-3 mt-5">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-black/20 text-gray-300 rounded-lg hover:bg-black/30 transition-colors">{t('cancel')}</button>
            <button type="submit" className="px-5 py-2.5 bg-[color:var(--accent-color)] text-white rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/20">{t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGoalModal;
