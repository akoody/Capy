import { Goal } from '../types';
import api from '../services/api';
import { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';

interface GoalCardProps {
  goal: Goal;
  onClick: () => void;
  onRecurring: () => void;
  onWhatIf: () => void;
  fetchGoals: () => void;
  onDelete: () => void;
  onNotes?: () => void;
}

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  MDL: 'L',
  RUB: '₽',
  EUR: '€',
  GBP: '£',
};

// Inserts soft hyphens into long uninterrupted tokens to allow nicer wrapping with hyphen display
const insertSoftHyphens = (text: string, minTokenLength = 12, chunkSize = 8): string => {
  const longTokenRegex = new RegExp(`[\\p{L}\\p{N}]{${minTokenLength},}`, 'gu'); // sequences of letters/numbers, including Cyrillic
  return text.replace(longTokenRegex, (token) => {
    const chunks: string[] = [];
    for (let i = 0; i < token.length; i += chunkSize) {
      chunks.push(token.slice(i, i + chunkSize));
    }
    return chunks.join('\u200B\u00AD'); // zero-width space + soft hyphen
  });
};

const GoalCard = ({ goal, onClick, onRecurring, onWhatIf, fetchGoals, onDelete, onNotes }: GoalCardProps) => {
  const { currency } = useCurrency();
  const { t, i18n } = useTranslation();
  const [isDepositing, setIsDepositing] = useState(false);
  const isCompleted = goal.currentAmount >= goal.targetAmount;
  const progressPercentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);

  const handleRecurring = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRecurring();
  };

  const handleWhatIf = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWhatIf();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };


  const handleNotes = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNotes) {
      onNotes();
    }
  };

  const handleQuickDeposit = async (e: React.MouseEvent, amount: number) => {
    e.stopPropagation();
    setIsDepositing(true);
    try {
      await api.patch(`/goals/${goal._id}/deposit`, { amount });
      fetchGoals();
    } catch (error) {
      console.error('Quick deposit failed', error);
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div
      className={`capy-card p-5 transition-all duration-300 ${isCompleted ? 'opacity-55' : ''} min-h-[160px] w-full max-w-full overflow-hidden`}
    >
      <div className="flex items-center overflow-hidden">
        <div className="flex-shrink-0 text-4xl mr-4">{goal.icon || '🎯'}</div>
        <div className="flex-1 min-w-0 max-w-full overflow-hidden">
          <h3
            lang={i18n.language}
            style={{ hyphens: 'auto', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-all' }}
            className={`block w-full max-w-full overflow-hidden break-words break-all whitespace-pre-wrap text-lg font-bold text-[color:var(--text-color)] ${isCompleted && 'line-through'}`}
          >
            {insertSoftHyphens(goal.name)}
          </h3>
          <p className="text-sm text-[color:var(--text-secondary-color)]">
            <span className={`font-semibold tabular-nums ${isCompleted ? 'text-[color:var(--income-color)]' : 'text-[color:var(--text-color)]'}`}>{goal.currentAmount.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}</span>{' '}
            / {goal.targetAmount.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')} {currencySymbols[currency]}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center space-x-1">
          <button type="button" onClick={handleWhatIf} className="rounded-lg p-2 text-[color:var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[color:var(--primary-color)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
              <path d="M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4"></path>
              <line x1="12" y1="19" x2="12" y2="19.01"></line>
            </svg>
          </button>
          <button type="button" onClick={handleRecurring} className="rounded-lg p-2 text-[color:var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[color:var(--primary-color)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" >
              <path d="M17 1L21 5L17 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 11V9C3 7.93913 3.42143 6.92172 4.17157 6.17157C4.92172 5.42143 5.93913 5 7 5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 23L3 19L7 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 13V15C21 16.0609 20.5786 17.0783 19.8284 17.8284C19.0783 18.5786 18.0609 19 17 19H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {onNotes && (
            <button type="button" onClick={handleNotes} className="rounded-lg p-2 text-[color:var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-amber-300/90" title="Заметки">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M14 3v4a1 1 0 0 0 1 1h4"></path>
                <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"></path>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
                <line x1="9" y1="17" x2="13" y2="17"></line>
              </svg>
            </button>
          )}
          <button type="button" onClick={handleDelete} className="rounded-lg p-2 text-[color:var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[color:var(--expense-color)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
              <line x1="4" y1="7" x2="20" y2="7"></line>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
              <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"></path>
              <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"></path>
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/35">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500/90 to-[color:var(--primary-color)]"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-[color:var(--text-tertiary)]">
        {t('created_at', { date: new Date(goal.createdAt).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' }) })}
      </div>
      {!isCompleted && (
        <div className="mt-4 flex justify-between items-center">
          <div className="flex space-x-4">
            {isDepositing ? (
                <div className="text-sm font-medium text-[color:var(--text-tertiary)]">{t('depositing')}</div>
            ) : (
                <>
                    <button type="button" onClick={(e) => handleQuickDeposit(e, 100)} className="text-sm font-semibold text-[color:var(--text-secondary-color)] transition-colors hover:text-[color:var(--text-color)]" disabled={isDepositing}>+100 {currencySymbols[currency]}</button>
                    <button type="button" onClick={(e) => handleQuickDeposit(e, 500)} className="text-sm font-semibold text-[color:var(--text-secondary-color)] transition-colors hover:text-[color:var(--text-color)]" disabled={isDepositing}>+500 {currencySymbols[currency]}</button>
                    <button type="button" onClick={(e) => handleQuickDeposit(e, 1000)} className="text-sm font-semibold text-[color:var(--text-secondary-color)] transition-colors hover:text-[color:var(--text-color)]" disabled={isDepositing}>+1000 {currencySymbols[currency]}</button>
                </>
            )}
          </div>
          <button
            type="button"
            onClick={onClick}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#0c0c0f] shadow-lg transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(165deg, #c4b5fd 0%, var(--primary-color) 100%)',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-6-6h12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default GoalCard;
