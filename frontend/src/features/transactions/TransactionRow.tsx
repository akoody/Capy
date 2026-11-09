import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import { localeTag } from '../../lib/group-by-day';
import type { Transaction } from '../../types';
import { transactionTime } from './transaction-summary';

interface TransactionRowProps {
  transaction: Transaction;
  formatAmount: (amount: number) => string;
  onDelete: () => void;
}

const TransactionRow = ({ transaction, formatAmount, onDelete }: TransactionRowProps) => {
  const { t, i18n } = useTranslation();
  const isIncome = transaction.type === 'income';

  return (
    <div className="capy-card flex items-center justify-between p-4 transition-opacity hover:opacity-[0.97]">
      <div className="flex-1 max-w-[65%] pr-2">
        <p className="font-medium text-[color:var(--text-color)]">{transaction.category}</p>
        <p className="text-xs text-[color:var(--text-secondary-color)] break-words">{transaction.description}</p>
        <p className="text-xs text-[color:var(--text-secondary-color)] opacity-70 mt-1">
          {new Date(transactionTime(transaction)).toLocaleTimeString(localeTag(i18n.language), {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <div className="flex items-center">
        <p className="font-bold" style={{ color: isIncome ? '#D79922' : '#F13C20' }}>
          {isIncome ? '+' : '-'}
          {formatAmount(transaction.amount)}
        </p>
        <button
          type="button"
          aria-label={t('delete')}
          onClick={onDelete}
          className="ml-4 hover:opacity-70 transition-opacity"
          style={{ color: '#F13C20' }}
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
};

export default TransactionRow;
