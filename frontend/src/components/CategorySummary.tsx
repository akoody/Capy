import { useMemo, useState } from 'react';
import { Transaction } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';

interface CategorySummaryProps {
  transactions: Transaction[];
  periodLabel: string;
}

const categoryColorPalette = [
  '#4056A1', // Deep blue
  '#D79922', // Golden yellow
  '#F13C20', // Terracotta red
  '#C5CBE3', // Lavender grey
  '#EFE2BA', // Cream
  '#8B6F47', // Darker gold
  '#6B4E71', // Muted purple
  '#5A7BA3', // Lighter blue
];

const getColorByIndex = (index: number) => categoryColorPalette[index % categoryColorPalette.length];

const CategorySummary = ({ transactions, periodLabel }: CategorySummaryProps) => {
  const { currency } = useCurrency();
  const { i18n, t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const { totalExpense, categories } = useMemo(() => {
    const expenseTx = transactions.filter(t => t.type === 'expense');
    const byCategory = new Map<string, number>();
    for (const t of expenseTx) {
      const key = t.category || '—';
      byCategory.set(key, (byCategory.get(key) || 0) + Math.abs(t.amount));
    }
    const entries = Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = entries.reduce((s, e) => s + e.value, 0);
    return { totalExpense: total, categories: entries };
  }, [transactions]);

  if (categories.length === 0) {
    return (
      <div className="bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] p-4 rounded-2xl">
        <p className="text-sm text-[color:var(--text-secondary-color)]">Нет расходов {periodLabel}</p>
      </div>
    );
  }

  const visible = showAll ? categories : categories.slice(0, 5);

  return (
    <div className="bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] p-4 rounded-2xl">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm text-[color:var(--text-secondary-color)]">{periodLabel}</p>
        <p className="text-sm text-[color:var(--text-color)] font-medium">
          {totalExpense.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')} {currency}
        </p>
      </div>

      <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(64, 86, 161, 0.2)' }}>
        <div className="w-full h-full flex">
          {categories.map((c, idx) => {
            const pct = totalExpense > 0 ? (c.value / totalExpense) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={c.name}
                className="h-full"
                style={{ width: `${pct}%`, backgroundColor: getColorByIndex(idx) }}
                title={`${c.name} — ${pct.toFixed(1)}%`}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-4 divide-y" style={{ borderColor: 'rgba(197, 203, 227, 0.2)' }}>
        {visible.map((c, idx) => {
          const pct = totalExpense > 0 ? (c.value / totalExpense) * 100 : 0;
          return (
            <div key={c.name} className="py-2 flex items-center justify-between">
              <div className="flex items-center min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-sm mr-3 flex-shrink-0"
                  style={{ backgroundColor: getColorByIndex(idx) }}
                />
                <span className="text-[color:var(--text-color)] font-medium truncate">{c.name || '—'}</span>
              </div>
              <div className="ml-4 flex items-baseline space-x-3 flex-shrink-0">
                <span className="text-[color:var(--text-color)] font-semibold">
                  {c.value.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')} {currency}
                </span>
                <span className="text-[color:var(--text-secondary-color)] text-sm">{pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {categories.length > 5 && (
        <button
          className="mt-3 text-sm font-medium text-[color:var(--primary-color)] hover:text-[color:var(--primary-color)]/80"
          onClick={() => setShowAll(v => !v)}
        >
          {showAll ? t('hide') : t('show_all')}
        </button>
      )}
    </div>
  );
};

export default CategorySummary;


