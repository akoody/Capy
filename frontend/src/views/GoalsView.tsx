import { useState, useMemo, useEffect } from 'react';
import { Goal, PiggyBank } from '../types';
import PiggyBankSection from '../components/PiggyBankSection';
import ActiveGoalsSection from '../components/ActiveGoalsSection';
import CompletedGoalsSection from '../components/CompletedGoalsSection';
import AddGoalModal from '../components/AddGoalModal';
import PiggyBankModal from '../components/PiggyBankModal';
import TransactionModal from '../components/TransactionModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import WhatIfModal from '../components/WhatIfModal';
import GenericConfirmDeleteModal from '../components/GenericConfirmDeleteModal';
import NotesModal from '../components/NotesModal';
import { useTranslation } from 'react-i18next';

import api from '../services/api';


interface GoalsViewProps {
  goals: Goal[];
  userId: string | null;
  fetchGoals: () => void;
}

const GoalsView = ({ goals, userId, fetchGoals }: GoalsViewProps) => {
  const { t } = useTranslation();
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);
  const [isPiggyBankModalOpen, setIsPiggyBankModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isWhatIfModalOpen, setIsWhatIfModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [goalToDeposit, setGoalToDeposit] = useState<Goal | null>(null);
  const [goalToRecur, setGoalToRecur] = useState<Goal | null>(null);
  const [goalToWhatIf, setGoalToWhatIf] = useState<Goal | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
  const [goalToNotes, setGoalToNotes] = useState<Goal | null>(null);
  
  const [sortOption, setSortOption] = useState('default');
  
  const [piggyBank, setPiggyBank] = useState<PiggyBank | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const openDeleteModal = (goal: Goal) => {
    setGoalToDelete(goal);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setGoalToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const confirmDelete = async () => {
    if (goalToDelete) {
      try {
        await api.delete(`/goals/${goalToDelete._id}`);
        fetchGoals();
        closeDeleteModal();
      } catch (error) {
        console.error('Failed to delete goal', error);
      }
    }
  };

  const fetchPiggyBank = async () => {
    if (!userId) return;
    try {
      const response = await api.get(`/piggy-bank?userId=${userId}`);
      setPiggyBank(response.data);
    } catch (error) {
      console.error('Failed to fetch piggy bank', error);
    }
  };

  useEffect(() => {
    fetchPiggyBank();
  }, [userId]);

  // Listen for wallet updates from other views (e.g., TransactionsView)
  useEffect(() => {
    const handleWalletUpdate = () => {
      console.log('Wallet updated event received, fetching piggy bank...');
      fetchPiggyBank();
    };

    window.addEventListener('walletUpdated', handleWalletUpdate);
    return () => {
      window.removeEventListener('walletUpdated', handleWalletUpdate);
    };
  }, [userId]); // Add userId to dependencies - fetchPiggyBank uses userId from closure

  const { activeGoals, completedGoals } = useMemo(() => {
    const active: Goal[] = [];
    const completed: Goal[] = [];

    goals.forEach(goal => {
      if (goal.currentAmount >= goal.targetAmount) {
        completed.push(goal);
      } else {
        active.push(goal);
      }
    });

    const sortFn = (a: Goal, b: Goal) => {
      switch (sortOption) {
        case 'progress':
          return (b.currentAmount / b.targetAmount) - (a.currentAmount / a.targetAmount);
        case 'amount':
          return b.targetAmount - a.targetAmount;
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    };

    return {
      activeGoals: active.sort(sortFn),
      completedGoals: completed.sort(sortFn),
    };
  }, [goals, sortOption]);

  

  

  const openRecurringModal = (goal: Goal) => {
    setGoalToRecur(goal);
    setIsRecurringModalOpen(true);
  };

  const openWhatIfModal = (goal: Goal) => {
    setGoalToWhatIf(goal);
    setIsWhatIfModalOpen(true);
  };


  const openNotesModal = (goal: Goal) => {
    setGoalToNotes(goal);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setShowAnalysis(true);
    setAnalysisResult(null);

    try {
      const response = await api.post('/piggy-bank/analyze');
      setAnalysisResult(response.data.analysis || response.data);
    } catch (error: any) {
      console.error('Failed to analyze savings', error);
      setAnalysisResult(
        error.response?.data?.message || 
        t('analysis_error') || 
        'Не удалось проанализировать накопления. Попробуйте позже.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <PiggyBankSection piggyBank={piggyBank} onAddMoney={() => setIsPiggyBankModalOpen(true)} userId={userId} />
      <p className="-mt-1 mb-6 px-0.5 text-sm leading-relaxed text-[color:var(--text-tertiary)]">
        {t('savings_goals_hint')}
      </p>

      {/* Analysis Savings Button */}
      <div className="mb-8">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="capy-btn-primary"
        >
          {isAnalyzing ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('analyzing') || 'Анализ...'}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {t('analyze_savings')}
            </>
          )}
        </button>
        {showAnalysis && analysisResult && (
          <div className="capy-card mt-4 overflow-hidden p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-bold text-[color:var(--text-color)]">{t('analysis_result') || 'Результат анализа'}</h3>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(analysisResult);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }}
                  className="text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] p-1 shrink-0 transition-colors"
                  title="Копировать"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowAnalysis(false)}
                  className="text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] p-1 shrink-0 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="text-[color:var(--text-secondary-color)] whitespace-pre-wrap text-sm leading-relaxed overflow-y-auto max-h-48">
              {analysisResult}
            </div>
          </div>
        )}
      </div>

      <ActiveGoalsSection 
        activeGoals={activeGoals}
        sortOption={sortOption}
        onSortChange={setSortOption}
        onGoalClick={setGoalToDeposit}
        onRecurring={openRecurringModal}
        onWhatIf={openWhatIfModal}
        onAddGoal={() => setIsAddGoalModalOpen(true)}
        fetchGoals={fetchGoals}
        onDelete={openDeleteModal}
        onNotes={openNotesModal}
      />
      <CompletedGoalsSection 
        completedGoals={completedGoals}
        onGoalClick={setGoalToDeposit}
        onRecurring={openRecurringModal}
        onWhatIf={openWhatIfModal}
        fetchGoals={fetchGoals}
        onDelete={openDeleteModal}
        onNotes={openNotesModal}
      />
      <AddGoalModal
        isOpen={isAddGoalModalOpen}
        onClose={() => setIsAddGoalModalOpen(false)}
        onGoalAdded={fetchGoals}
        userId={userId}
        goalsCount={goals.length}
      />
      <PiggyBankModal 
        isOpen={isPiggyBankModalOpen}
        onClose={() => setIsPiggyBankModalOpen(false)} 
        onSuccess={() => {
          fetchGoals();
          fetchPiggyBank();
        }}
        userId={userId}
      />
      <TransactionModal
        goal={goalToDeposit}
        onClose={() => setGoalToDeposit(null)}
        onDepositSuccess={fetchGoals}
      />
      <RecurringTransactionModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        goal={goalToRecur}
        onSuccess={fetchGoals}
      />
      <WhatIfModal
        isOpen={isWhatIfModalOpen}
        onClose={() => setIsWhatIfModalOpen(false)}
        goal={goalToWhatIf}
      />
      <GenericConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={t('confirm_delete')}
        message={t('confirm_delete_message', { goalName: goalToDelete?.name || '' })}
      />
      <NotesModal
        isOpen={!!goalToNotes}
        onClose={() => setGoalToNotes(null)}
        goal={goalToNotes}
        onSuccess={fetchGoals}
      />
    </>
  );
};

export default GoalsView;