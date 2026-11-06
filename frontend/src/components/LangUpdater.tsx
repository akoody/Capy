import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

const LangUpdater = () => {
  const { language } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return null;
};

export default LangUpdater;
