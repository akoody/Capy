import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddTransactionModal from '../../components/AddTransactionModal';
import CategorySummary from '../../components/CategorySummary';
import GenericConfirmDeleteModal from '../../components/GenericConfirmDeleteModal';
import ManageCategoriesModal from '../../components/ManageCategoriesModal';
import { useCurrency } from '../../context/CurrencyContext';
import { groupByDay, localeTag } from '../../lib/group-by-day';
import api, { apiErrorMessage } from '../../services/api';
import type { Transaction } from '../../types';
import MonthSummaryCard from './MonthSummaryCard';
import TransactionAnalysis from './TransactionAnalysis';
import TransactionRow from './TransactionRow';
import {
  currencySymbol,
  isCashflow,
  summarizeMonth,
  transactionTime,
} from './transaction-summary';

const TransactionsView = () => {
  const { t, i18n } = useTranslation();
  const { currency, userId } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      if (userId) {
        const response = await api.get<Transaction[]>('/transactions');
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

  // Операции добавляет и голосовой ассистент.
  useEffect(() => {
    const refresh = () => void fetchTransactions();
    window.addEventListener('capyTransactionsUpdated', refresh);
    return () => window.removeEventListener('capyTransactionsUpdated', refresh);
  }, [fetchTransactions]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      // Кошелёк сервер корректирует вместе с удалением.
      await api.delete(`/transactions/${toDelete._id}`);
      setTransactions((current) => current.filter((tx) => tx._id !== toDelete._id));
      if (toDelete.walletEffect) {
        window.dispatchEvent(new CustomEvent('walletUpdated'));
      }
      setToDelete(null);
    } catch (error) {
      console.error('Failed to delete transaction', error);
      window.alert(apiErrorMessage(error, 'Failed to delete transaction'));
    }
  };

  const locale = localeTag(i18n.language);
  const days = useMemo(
    () =>
      groupByDay(transactions.filter(isCashflow), {
        day: (tx) => tx.date,
        time: transactionTime,
        locale,
      }),
    [transactions, locale],
  );
  const summary = useMemo(() => summarizeMonth(transactions, new Date()), [transactions]);
  const formatAmount = (amount: number) => `${amount.toLocaleString(locale)} ${currencySymbol(currency)}`;

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
            onClick={() => setIsCategoriesOpen(true)}
            className="capy-pill capy-pill-idle py-2 text-xs font-semibold"
          >
            {t('tx_categories_manage_short')}
          </button>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="capy-pill capy-pill-active py-2 text-xs font-semibold"
          >
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
          <MonthSummaryCard
            income={summary.income}
            expense={summary.expense}
            balance={summary.balance}
            formatAmount={formatAmount}
          />
          <CategorySummary transactions={summary.expenses} periodLabel={t('expenses_for_month') || 'за месяц'} />
          <TransactionAnalysis />
          <div className="space-y-6 mt-8">
            {days.map(({ label, items }) => (
              <div key={label}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
                  {label}
                </h3>
                <div className="space-y-2">
                  {items.map((transaction) => (
                    <TransactionRow
                      key={transaction._id}
                      transaction={transaction}
                      formatAmount={formatAmount}
                      onDelete={() => setToDelete(transaction)}
                    />
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
            isOpen={isAddOpen}
            onClose={() => setIsAddOpen(false)}
            onSuccess={() => {
              setIsAddOpen(false);
              void fetchTransactions();
            }}
            userId={userId}
          />
          <ManageCategoriesModal
            isOpen={isCategoriesOpen}
            onClose={() => setIsCategoriesOpen(false)}
            onChanged={() => void fetchTransactions()}
          />
        </>
      )}

      <GenericConfirmDeleteModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={t('confirm_delete')}
        message="Вы уверены, что хотите удалить транзакцию?"
      />
    </div>
  );
};

export default TransactionsView;
