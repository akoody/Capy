import { useState, useMemo } from 'react';
import { Goal } from '../types';
import { useTranslation } from 'react-i18next';

interface WhatIfModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
}

const WhatIfModal = ({ isOpen, onClose, goal }: WhatIfModalProps) => {
  const { t, i18n } = useTranslation();
  const [extraAmount, setExtraAmount] = useState(0);

  const originalCompletionDate = useMemo(() => {
    if (!goal) return null;
    const remainingAmount = goal.targetAmount - goal.currentAmount;
    if (remainingAmount <= 0) return new Date();
    // Assuming a constant saving rate (e.g., from recurring transactions)
    // This is a simplified calculation. A more accurate calculation would require more data.
    const monthlySavingRate = 1000; // Placeholder
    const monthsToComplete = remainingAmount / monthlySavingRate;
    const completionDate = new Date();
    completionDate.setMonth(completionDate.getMonth() + monthsToComplete);
    return completionDate;
  }, [goal]);

  const newCompletionDate = useMemo(() => {
    if (!goal || !originalCompletionDate) return null;
    const remainingAmount = goal.targetAmount - goal.currentAmount;
    if (remainingAmount <= 0) return new Date();
    const monthlySavingRate = 1000 + extraAmount; // Placeholder
    const monthsToComplete = remainingAmount / monthlySavingRate;
    const completionDate = new Date();
    completionDate.setMonth(completionDate.getMonth() + monthsToComplete);
    return completionDate;
  }, [goal, originalCompletionDate, extraAmount]);

  if (!isOpen || !goal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50" onClick={onClose}>
      <div className="bg-[color:var(--card-bg-color)] rounded-2xl p-8 w-full max-w-sm border border-[color:var(--card-border-color)] shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl font-bold mb-2 text-white">{t('what_if')}</h3>
        <p className="text-[color:var(--text-secondary-color)] mb-6">{t('what_if_description', { goalName: goal.name })}</p>

        <div className="my-4">
          <label htmlFor="extraAmount" className="block text-sm font-medium text-left mb-1">{t('extra_per_month')}</label>
          <input
            type="number"
            id="extraAmount"
            value={extraAmount}
            onChange={(e) => setExtraAmount(Number(e.target.value))}
            className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
          />
        </div>

        <div className="my-6 text-left">
          <p className="text-lg text-white">{t('new_completion_date')}</p>
          <p className="text-2xl font-bold text-[color:var(--primary-color)]">
            {newCompletionDate ? newCompletionDate.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US') : 'N/A'}
          </p>
          {originalCompletionDate && newCompletionDate && (
            <p className="text-sm text-[color:var(--text-secondary-color)]">
              {t('faster_by_days', { days: Math.round((originalCompletionDate.getTime() - newCompletionDate.getTime()) / (1000 * 60 * 60 * 24)) })}
            </p>
          )}
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default WhatIfModal;
