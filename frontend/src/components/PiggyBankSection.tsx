import { useState, useEffect, useCallback } from 'react';
import { PiggyBank, Transaction } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import WalletHistoryModal from './WalletHistoryModal';

interface PiggyBankSectionProps {
  piggyBank: PiggyBank | null;
  onAddMoney: () => void;
  userId: string | null;
}

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  MDL: 'L',
  RUB: '₽',
  EUR: '€',
  GBP: '£',
};

const PiggyBankSection = ({ piggyBank, onAddMoney, userId }: PiggyBankSectionProps) => {
  const { currency } = useCurrency();
  const { t } = useTranslation();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  const fetchWalletTransactions = useCallback(async () => {
    try {
      if (userId) {
        const response = await api.get('/transactions');
        const allTx = response.data as Transaction[];
        
        const walletTx = allTx.filter((tx) => Boolean(tx.walletEffect)).sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
          return timeB - timeA; // newest first
        });
        
        setWalletTransactions(walletTx);
      }
    } catch (error) {
      console.error('Failed to fetch wallet transactions', error);
    } finally {
      setLoadingTransactions(false);
    }
  }, [userId]);

  // Preload wallet transactions on mount
  useEffect(() => {
    if (userId) {
      fetchWalletTransactions();
    }
  }, [userId, fetchWalletTransactions]);

  // Listen for wallet updates to refresh transactions
  useEffect(() => {
    const handleWalletUpdate = () => {
      if (userId) {
        fetchWalletTransactions();
      }
    };

    window.addEventListener('walletUpdated', handleWalletUpdate);
    return () => {
      window.removeEventListener('walletUpdated', handleWalletUpdate);
    };
  }, [userId, fetchWalletTransactions]);

  return (
    <>
      <section id="piggy-bank-section" className="mb-8">
        <h2 className="capy-page-title mb-4">{t('piggy_bank')}</h2>
        <div className="capy-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-[color:var(--text-secondary-color)]">{t('current_balance')}</p>
            <p className="text-xl font-bold tabular-nums tracking-tight text-[color:var(--text-color)]">
              {(piggyBank?.amount ?? 0).toLocaleString()} {currencySymbols[currency]}
            </p>
          </div>
          <button type="button" onClick={onAddMoney} className="capy-btn-primary mt-5">
            {t('deposit_withdraw')}
          </button>
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="capy-btn-secondary mt-2.5"
          >
            {t('wallet_history')}
          </button>
        </div>
      </section>

      <WalletHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        userId={userId}
        transactions={walletTransactions}
        loading={loadingTransactions}
        onRefresh={fetchWalletTransactions}
      />
    </>
  );
};

export default PiggyBankSection;
