import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Transaction } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';

interface WalletHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  transactions?: Transaction[];
  loading?: boolean;
  onRefresh?: () => void;
}

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  MDL: 'L',
  RUB: '₽',
  EUR: '€',
  GBP: '£',
};

const WalletHistoryModal = ({ isOpen, onClose, userId, transactions: preloadedTransactions, loading: preloadedLoading }: WalletHistoryModalProps) => {
  const { currency } = useCurrency();
  const { t, i18n } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Use preloaded transactions if available, otherwise fetch on open
  useEffect(() => {
    if (preloadedTransactions !== undefined) {
      setTransactions(preloadedTransactions);
      setLoading(preloadedLoading ?? false);
    } else if (isOpen && userId) {
      fetchTransactions();
    }
  }, [isOpen, userId, preloadedTransactions, preloadedLoading]);

  const fetchTransactions = async () => {
    try {
      if (userId) {
        const response = await api.get('/transactions');
        const allTx = response.data as Transaction[];
        
        const walletTx = allTx.filter((tx) => Boolean(tx.walletEffect)).sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
          return timeB - timeA; // newest first
        });
        
        setTransactions(walletTx);
      }
    } catch (error) {
      console.error('Failed to fetch wallet transactions', error);
    } finally {
      setLoading(false);
    }
  };

  // Get wallet-related transactions
  const walletTransactions = useMemo(() => {
    return transactions.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
      return timeB - timeA; // newest first
    });
  }, [transactions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50" onClick={onClose}>
      <div className="bg-[color:var(--card-bg-color)] rounded-2xl p-6 w-full max-w-md border border-[color:var(--card-border-color)] shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{t('wallet_history')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">{t('loading')}</div>
        ) : walletTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>{t('no_transactions')}</p>
            <p className="text-sm mt-2">История операций с кошельком появится здесь</p>
          </div>
        ) : (
          <div className="space-y-3">
            {walletTransactions.map((tx) => (
              <div key={tx._id} className="bg-black/20 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium text-white">
                    {tx.type === 'deposit' ? t('deposit') : tx.type === 'withdraw' ? t('withdraw') : tx.description || tx.category}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.createdAt || tx.date).toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <p className="font-bold" style={{ color: (tx.type === 'income' || tx.type === 'deposit') ? '#D79922' : '#F13C20' }}>
                  {tx.type === 'income' || tx.type === 'deposit' ? '+' : '-'}
                  {tx.amount.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')} {currencySymbols[currency]}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletHistoryModal;
