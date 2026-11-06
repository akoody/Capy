import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import api from '../services/api';

type Currency = 'USD' | 'EUR' | 'GBP' | 'RUB' | 'MDL'; // Add more currencies as needed

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  userId: string | null;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children, userId }: { children: ReactNode; userId: string | null }) => {
  const [currency, setCurrency] = useState<Currency>('USD');

  // Load currency from user data when userId changes
  useEffect(() => {
    if (userId) {
      const loadUserCurrency = async () => {
        try {
          const response = await api.get(`/users/id/${userId}`);
          if (response.data.currency) {
            setCurrency(response.data.currency);
          }
        } catch (error) {
          console.error('Failed to load user currency', error);
        }
      };
      loadUserCurrency();
    }
  }, [userId]);

  const handleSetCurrency = async (newCurrency: Currency) => {
    setCurrency(newCurrency);
    if (userId) {
      try {
        await api.patch(`/users/${userId}`, { currency: newCurrency });
      } catch (error) {
        console.error('Failed to save currency', error);
      }
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency: handleSetCurrency, userId }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};