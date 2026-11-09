import { useTranslation } from 'react-i18next';

interface MonthSummaryCardProps {
  income: number;
  expense: number;
  balance: number;
  formatAmount: (amount: number) => string;
}

const VALUE_CLASS = 'text-base font-bold tabular-nums tracking-tight sm:text-lg';
const LABEL_CLASS = 'mt-1 text-[11px] font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]';

const MonthSummaryCard = ({ income, expense, balance, formatAmount }: MonthSummaryCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="capy-card mb-6 p-5">
      <p className="capy-section-label mb-4">{t('balance_for_month')}</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className={`${VALUE_CLASS} text-[color:var(--income-color)]`}>{formatAmount(income)}</p>
          <p className={LABEL_CLASS}>{t('income')}</p>
        </div>
        <div>
          <p className={`${VALUE_CLASS} text-[color:var(--expense-color)]`}>{formatAmount(expense)}</p>
          <p className={LABEL_CLASS}>{t('expense')}</p>
        </div>
        <div>
          <p
            className={`${VALUE_CLASS} ${balance >= 0 ? 'text-[color:var(--text-color)]' : 'text-[color:var(--expense-color)]'}`}
          >
            {formatAmount(balance)}
          </p>
          <p className={LABEL_CLASS}>{t('total')}</p>
        </div>
      </div>
    </div>
  );
};

export default MonthSummaryCard;
