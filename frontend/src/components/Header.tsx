import { useTranslation } from 'react-i18next';
import { useCurrency } from '../context/CurrencyContext';
import React from 'react';

interface HeaderProps {
  totalSavings: number;
}

const currencySymbols: { [key: string]: string } = {
  USD: '$',
  MDL: 'L',
  RUB: '₽',
  EUR: '€',
  GBP: '£',
};

const Header = React.memo(({ totalSavings }: HeaderProps) => {
  const { t, i18n } = useTranslation();
  const { currency } = useCurrency();

  const formatted = totalSavings.toLocaleString(
    i18n.language === 'ru' ? 'ru-RU' : 'en-US',
  );

  return (
    <header className="px-4 pt-3 pb-2">
      <div className="capy-card relative overflow-hidden px-5 py-6 text-center">
        <div
          className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full opacity-[0.12]"
          style={{ background: 'var(--primary-color)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full opacity-[0.08]"
          style={{ background: 'var(--income-color)' }}
        />
        <p className="capy-section-label relative mb-2">{t('total_savings')}</p>
        <p className="relative text-[2rem] font-bold leading-none tracking-[-0.04em] text-[color:var(--text-color)] sm:text-[2.25rem]">
          {formatted}
          <span className="ml-1.5 text-[1.35rem] font-semibold text-[color:var(--primary-color)]">
            {currencySymbols[currency]}
          </span>
        </p>
      </div>
    </header>
  );
});

export default Header;
