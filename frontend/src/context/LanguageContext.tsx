import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

type Language = 'ru' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  userId: string | null;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children, userId }: { children: ReactNode; userId: string | null }) => {
  const [language, setLanguage] = useState<Language>('ru');
  const { i18n } = useTranslation();

  // Load language from user data when userId changes
  useEffect(() => {
    if (userId) {
      const loadUserLanguage = async () => {
        try {
          const response = await api.get(`/users/id/${userId}`);
          if (response.data.language) {
            setLanguage(response.data.language);
            i18n.changeLanguage(response.data.language);
          }
        } catch (error) {
          console.error('Failed to load user language', error);
        }
      };
      loadUserLanguage();
    }
  }, [userId, i18n]);

  const handleSetLanguage = async (newLanguage: Language) => {
    setLanguage(newLanguage);
    i18n.changeLanguage(newLanguage);
    if (userId) {
      try {
        await api.patch(`/users/${userId}`, { language: newLanguage });
      } catch (error) {
        console.error('Failed to save language', error);
      }
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, userId }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
