import { useState, useEffect } from 'react';
import { Goal } from '../types';
import { tips, Tip } from '../services/tips';

interface TipsViewProps {
  goals: Goal[];
}

const getRandomTip = (tipCategory: Tip[]) => {
  return tipCategory[Math.floor(Math.random() * tipCategory.length)];
};

const getRelevantTip = (goals: Goal[]): Tip => {
  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount);

  if (activeGoals.length === 0) {
    return getRandomTip(tips.GENERAL);
  }

  // Simple logic to find a relevant tip
  for (const goal of activeGoals) {
    const name = goal.name.toLowerCase();
    if (name.includes('отпуск') || name.includes('путешествие') || name.includes('море')) {
      return getRandomTip(tips.TRAVEL);
    }
    if (name.includes('macbook') || name.includes('ноутбук') || name.includes('телефон') || name.includes('компьютер')) {
      return getRandomTip(tips.TECH);
    }
    if (goal.targetAmount > 500000) {
      return getRandomTip(tips.LONG_TERM);
    }
  }

  // Fallback to a general tip
  return getRandomTip(tips.GENERAL);
};

const TipsView = ({ goals }: TipsViewProps) => {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    setTip(getRelevantTip(goals));
  }, [goals]);

  return (
    <section id="tips-section">
      <h2 className="text-2xl font-bold text-[color:var(--text-header)] mb-6">Совет дня</h2>
      <div className="bg-gradient-to-br from-white/10 to-white/5 p-6 rounded-2xl shadow-lg text-center border border-white/10 backdrop-blur-md min-h-[150px] flex flex-col justify-center items-center">
        {!tip ? (
          <p className="text-[color:var(--text-secondary)]">Загрузка совета...</p>
        ) : (
          <>
            <p className="text-5xl mb-3">💡</p>
            <p className="text-[color:var(--text-main)] font-medium text-lg">{tip.content}</p>
            <p className="text-sm text-[color:var(--text-secondary)] mt-2">- {tip.title}</p>
          </>
        )}
      </div>
    </section>
  );
};

export default TipsView;
