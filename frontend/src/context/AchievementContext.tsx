import { createContext, useContext, useState, ReactNode } from 'react';
import AchievementToast from '../components/AchievementToast';

interface AchievementContextType {
  showAchievement: (name: string) => void;
}

const AchievementContext = createContext<AchievementContextType | undefined>(undefined);

export const useAchievement = () => {
  const context = useContext(AchievementContext);
  if (!context) {
    throw new Error('useAchievement must be used within an AchievementProvider');
  }
  return context;
};

interface AchievementProviderProps {
  children: ReactNode;
}

export const AchievementProvider = ({ children }: AchievementProviderProps) => {
  const [achievement, setAchievement] = useState<{ name: string } | null>(null);

  const showAchievement = (name: string) => {
    setAchievement({ name });
    setTimeout(() => {
      setAchievement(null);
    }, 3000); // Same duration as the CSS animation
  };

  return (
    <AchievementContext.Provider value={{ showAchievement }}>
      {children}
      <AchievementToast name={achievement?.name || ''} isVisible={!!achievement} />
    </AchievementContext.Provider>
  );
};
