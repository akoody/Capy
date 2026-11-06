import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';

const SettingsSection = () => {
  const { currency, setCurrency } = useCurrency();
  const { i18n, t } = useTranslation();

  const handleCurrencyChange = (newCurrency: 'USD' | 'EUR' | 'GBP' | 'RUB' | 'MDL') => {
    setCurrency(newCurrency);
  };

  const handleLanguageChange = (newLanguage: 'en' | 'ru') => {
    i18n.changeLanguage(newLanguage);
  };

  const currencies = [
    { code: 'USD', symbol: '$', name: 'USD' },
    { code: 'EUR', symbol: '€', name: 'EUR' },
    { code: 'GBP', symbol: '£', name: 'GBP' },
    { code: 'RUB', symbol: '₽', name: 'RUB' },
    { code: 'MDL', symbol: 'L', name: 'MDL' },
  ];

  const languages = [
    { code: 'en', flag: '🇺🇸', name: 'English' },
    { code: 'ru', flag: '🇷🇺', name: 'Русский' },
  ];

  return (
    <div className="space-y-6">
      {/* Currency Selection */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">{t('currency')}</h3>
        <div className="grid grid-cols-5 gap-3">
          {currencies.map((curr) => (
            <button
              key={curr.code}
              onClick={() => handleCurrencyChange(curr.code as any)}
              className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                currency === curr.code
                  ? 'border-blue-500 bg-blue-500/20 text-white'
                  : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
              }`}
            >
              <div className="text-2xl mb-1">{curr.symbol}</div>
              <div className="text-xs font-medium">{curr.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Language Selection */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">{t('language')}</h3>
        <div className="grid grid-cols-2 gap-4">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code as any)}
              className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                i18n.language === lang.code
                  ? 'border-blue-500 bg-blue-500/20 text-white'
                  : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
              }`}
            >
              <div className="text-3xl mb-2">{lang.flag}</div>
              <div className="text-sm font-medium">{lang.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsSection;
