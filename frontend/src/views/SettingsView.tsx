import React from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { useTranslation } from 'react-i18next';

const SettingsView = () => {
  const { currency, setCurrency } = useCurrency();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrency(e.target.value as 'USD' | 'EUR' | 'GBP' | 'RUB' | 'MDL');
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'ru' | 'en');
  };

  return (
    <div>
      <h1 className="capy-page-title mb-6">{t('settings')}</h1>

      <div className="space-y-6">
        <div>
          <label htmlFor="currency" className="mb-2 block text-sm font-medium text-[color:var(--text-secondary-color)]">
            {t('currency')}
          </label>
          <select
            id="currency"
            value={currency}
            onChange={handleCurrencyChange}
            className="capy-input mt-1 py-3"
          >
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
            <option value="GBP">£ GBP</option>
            <option value="RUB">₽ RUB</option>
            <option value="MDL">L MDL</option>
          </select>
        </div>

        <div>
          <label htmlFor="language" className="mb-2 block text-sm font-medium text-[color:var(--text-secondary-color)]">
            {t('language')}
          </label>
          <select
            id="language"
            value={language}
            onChange={handleLanguageChange}
            className="capy-input mt-1 py-3"
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </div>
      </div>

      <p className="mt-10 text-xs text-gray-500 text-center leading-relaxed">
        build: {__APP_BUILD_ID__}
        <br />
        <span className="text-gray-600">
          Если здесь старая дата — в Telegram открывается кеш или nginx отдаёт не тот frontend/dist.
        </span>
      </p>
    </div>
  );
};

export default SettingsView;