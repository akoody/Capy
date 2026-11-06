import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { Transaction } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';
import AddTransactionModal from '../components/AddTransactionModal';
import ManageCategoriesModal from '../components/ManageCategoriesModal';
import CategorySummary from '../components/CategorySummary';
import GenericConfirmDeleteModal from '../components/GenericConfirmDeleteModal';

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  MDL: 'L',
  RUB: '₽',
  EUR: '€',
};

const getUserId = () => {
  const tg = window.Telegram?.WebApp;
  if (tg && tg.initData) {
    const params = new URLSearchParams(tg.initData);
    const user = params.get('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        return userData.id.toString(); // Convert to string for API
      } catch (error) {
        console.error("Failed to parse user data from Telegram initData", error);
        return null;
      }
    }
  }
  return null;
};

const TransactionsView = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const { currency } = useCurrency();
  const { t, i18n } = useTranslation();

  const userId = useMemo(() => getUserId(), []);

  const fetchTransactions = useCallback(async () => {
    try {
      if (userId) {
        const response = await api.get(`/transactions?userId=${userId}`);
        setTransactions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch transactions', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const onRefresh = () => {
      void fetchTransactions();
    };
    window.addEventListener('capyTransactionsUpdated', onRefresh);
    return () => window.removeEventListener('capyTransactionsUpdated', onRefresh);
  }, [fetchTransactions]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const onTransactionAdded = () => {
    fetchTransactions();
  };

  const openDeleteModal = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setTransactionToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const confirmDelete = async () => {
    if (transactionToDelete) {
      try {
        // Check if transaction was deducted from wallet
        const wasDeductedFromWallet = 
          transactionToDelete.type === 'expense' && 
          transactionToDelete.description && 
          (transactionToDelete.description.includes('(списано с кошелька)') || 
           transactionToDelete.description.includes('списано с кошелька'));

        // Check if transaction was deposited to wallet
        const wasDepositedToWallet = 
          transactionToDelete.type === 'income' && 
          transactionToDelete.description && 
          (transactionToDelete.description.includes('(пополнено в кошелек)') || 
           transactionToDelete.description.includes('пополнено в кошелек'));

        // Delete the transaction
        await api.delete(`/transactions/${transactionToDelete._id}`);
        setTransactions(transactions.filter(t => t._id !== transactionToDelete._id));

        // If it was deducted from wallet, return the funds
        if (wasDeductedFromWallet && userId) {
          try {
            await api.patch('/piggy-bank/deposit', {
              userId,
              amount: transactionToDelete.amount,
            });
            // Dispatch event to update wallet balance in other views
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('walletUpdated'));
            }, 100);
          } catch (walletErr) {
            console.error('Failed to return funds to wallet', walletErr);
          }
        }

        // If it was deposited to wallet, withdraw the funds
        if (wasDepositedToWallet && userId) {
          try {
            await api.patch('/piggy-bank/withdraw', {
              userId,
              amount: transactionToDelete.amount,
            });
            // Dispatch event to update wallet balance in other views
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('walletUpdated'));
            }, 100);
          } catch (walletErr) {
            console.error('Failed to withdraw funds from wallet', walletErr);
          }
        }

        closeDeleteModal();
      } catch (error) {
        console.error('Failed to delete transaction', error);
      }
    }
  };

  const groupedTransactions = useMemo(() => {
    // Filter out goal and piggy bank transactions
    const filteredTransactions = transactions.filter(transaction => 
      transaction.type === 'income' || transaction.type === 'expense'
    );
    
    // Sort transactions by createdAt (time) or date (newest first)
    const sortedTransactions = filteredTransactions.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
      return timeB - timeA; // newest first
    });
    
    const grouped = sortedTransactions.reduce((acc, transaction) => {
      const date = new Date(transaction.date).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>);
    
    // Sort transactions within each date group by createdAt or date (newest first)
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
        return timeB - timeA; // newest first
      });
    });
    
    // Sort date keys by the date of the first transaction in each group (newest first)
    const sortedDateKeys = Object.keys(grouped).sort((dateA, dateB) => {
      const firstTxA = grouped[dateA][0];
      const firstTxB = grouped[dateB][0];
      const timeA = firstTxA.createdAt ? new Date(firstTxA.createdAt).getTime() : new Date(firstTxA.date).getTime();
      const timeB = firstTxB.createdAt ? new Date(firstTxB.createdAt).getTime() : new Date(firstTxB.date).getTime();
      return timeB - timeA; // newest first
    });
    
    // Create a new object with sorted keys
    const sortedGrouped: Record<string, Transaction[]> = {};
    sortedDateKeys.forEach(date => {
      sortedGrouped[date] = grouped[date];
    });
    
    return sortedGrouped;
  }, [transactions, i18n.language]);

  const summary = useMemo(() => {
    const now = new Date();
    const currentMonthTransactions = transactions.filter(t => 
      new Date(t.date).getMonth() === now.getMonth() && 
      new Date(t.date).getFullYear() === now.getFullYear() &&
      (t.type === 'income' || t.type === 'expense')
    );
    
    const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return { income, expense, balance: income - expense };
  }, [transactions]);

  const currentMonthExpenseTx = useMemo(() => {
    const now = new Date();
    return transactions.filter(t =>
      new Date(t.date).getMonth() === now.getMonth() &&
      new Date(t.date).getFullYear() === now.getFullYear() &&
      t.type === 'expense'
    );
  }, [transactions]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setShowAnalysis(true);
    setAnalysisResult(null);

    try {
      const response = await api.post('/transactions/analyze');
      setAnalysisResult(response.data.analysis || response.data);
    } catch (error: any) {
      console.error('Failed to analyze transactions', error);
      setAnalysisResult(
        error.response?.data?.message || 
        t('analysis_error') || 
        'Не удалось проанализировать транзакции. Попробуйте позже.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4" aria-busy>
        <div className="capy-shimmer h-10 w-48 rounded-lg" />
        <div className="capy-shimmer h-32 rounded-[var(--radius-lg)]" />
        <div className="capy-shimmer h-24 rounded-[var(--radius-lg)]" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="capy-page-title">{t('transactions')}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCategoriesModalOpen(true)}
            className="capy-pill capy-pill-idle py-2 text-xs font-semibold"
          >
            {t('tx_categories_manage_short')}
          </button>
          <button type="button" onClick={openModal} className="capy-pill capy-pill-active py-2 text-xs font-semibold">
            + {t('new_transaction')}
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="capy-card mt-8 border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="font-medium text-[color:var(--text-color)]">{t('no_transactions')}</p>
          <p className="mt-2 text-sm text-[color:var(--text-secondary-color)]">{t('click_new_transaction')}</p>
        </div>
      ) : (
        <>
          <div className="capy-card mb-6 p-5">
            <p className="capy-section-label mb-4">{t('balance_for_month')}</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-base font-bold tabular-nums tracking-tight text-[color:var(--income-color)] sm:text-lg">
                  {summary.income.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')} {currencySymbols[currency]}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]">{t('income')}</p>
              </div>
              <div>
                <p className="text-base font-bold tabular-nums tracking-tight text-[color:var(--expense-color)] sm:text-lg">
                  {summary.expense.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')} {currencySymbols[currency]}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]">{t('expense')}</p>
              </div>
              <div>
                <p
                  className={`text-base font-bold tabular-nums tracking-tight sm:text-lg ${
                    summary.balance >= 0 ? 'text-[color:var(--text-color)]' : 'text-[color:var(--expense-color)]'
                  }`}
                >
                  {summary.balance.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')} {currencySymbols[currency]}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]">{t('total')}</p>
              </div>
            </div>
          </div>

          {/* Minimal stacked bar by categories for current month */}
          <CategorySummary transactions={currentMonthExpenseTx} periodLabel={t('expenses_for_month') || 'за месяц'} />

          {/* Analysis Transactions Button */}
          {transactions.length > 0 && (
            <div className="mb-6 mt-6">
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
                    {t('analyze_transactions')}
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
          )}

          <div className="space-y-6 mt-8">
            {Object.keys(groupedTransactions).map(date => (
              <div key={date}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">{date}</h3>
                <div className="space-y-2">
                  {groupedTransactions[date].map((transaction: Transaction) => (
                    <div
                      key={transaction._id}
                      className="capy-card flex items-center justify-between p-4 transition-opacity hover:opacity-[0.97]"
                    >
                      <div className="flex-1 max-w-[65%] pr-2">
                        <p className="font-medium text-[color:var(--text-color)]">{transaction.category}</p>
                        <p className="text-xs text-[color:var(--text-secondary-color)] break-words">{transaction.description}</p>
                        <p className="text-xs text-[color:var(--text-secondary-color)] opacity-70 mt-1">
                          {new Date(transaction.createdAt || transaction.date).toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <p className="font-bold" style={{ color: transaction.type === 'income' ? '#D79922' : '#F13C20' }}>
                          {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')} {currencySymbols[currency]}
                        </p>
                        <button onClick={() => openDeleteModal(transaction)} className="ml-4 hover:opacity-70 transition-opacity" style={{ color: '#F13C20' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {userId && (
        <>
          <AddTransactionModal
            isOpen={isModalOpen}
            onClose={closeModal}
            onSuccess={() => {
              closeModal();
              onTransactionAdded();
            }}
            userId={userId}
          />
          <ManageCategoriesModal
            isOpen={isCategoriesModalOpen}
            onClose={() => setIsCategoriesModalOpen(false)}
            onChanged={() => void fetchTransactions()}
          />
        </>
      )}

      <GenericConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={t('confirm_delete')}
        message={'Вы уверены, что хотите удалить транзакцию?'}
      />
    </div>
  );
};

export default TransactionsView;