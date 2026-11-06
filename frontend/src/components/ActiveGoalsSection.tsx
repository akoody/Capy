import { Goal } from '../types';
import GoalCard from './GoalCard';
import { useTranslation } from 'react-i18next';

interface ActiveGoalsSectionProps {
  activeGoals: Goal[];
  sortOption: string;
  onSortChange: (sortOption: string) => void;
  onGoalClick: (goal: Goal) => void;
  onRecurring: (goal: Goal) => void;
  onWhatIf: (goal: Goal) => void;
  onAddGoal: () => void;
  fetchGoals: () => void;
  onDelete: (goal: Goal) => void;
  onNotes: (goal: Goal) => void;
}

const ActiveGoalsSection = ({ activeGoals, sortOption, onSortChange, onGoalClick, onRecurring, onWhatIf, onAddGoal, fetchGoals, onDelete, onNotes }: ActiveGoalsSectionProps) => {
  const { t } = useTranslation();
  const sortOptions: { [key: string]: string } = {
    default: t('sort_default'),
    progress: t('sort_progress'),
    amount: t('sort_amount'),
    date: t('sort_date'),
  };

  const handleSortClick = () => {
    const sortKeys = Object.keys(sortOptions);
    const currentSortIndex = sortKeys.indexOf(sortOption);
    const nextSortIndex = (currentSortIndex + 1) % sortKeys.length;
    onSortChange(sortKeys[nextSortIndex]);
  };

  return (
    <section id="goals-section" className="max-w-full overflow-x-hidden">
      <div className="mb-5 flex max-w-full items-center justify-between gap-2 overflow-x-hidden">
        <h2 className="capy-page-title">{t('active_goals')}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onAddGoal} className="capy-pill capy-pill-active py-2 text-xs">
            + {t('new_goal')}
          </button>
          <button type="button" onClick={handleSortClick} className="capy-pill capy-pill-idle flex items-center gap-1 py-2 text-xs">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h9m-9 4h13M19 20V4m0 16l-4-4m4 4l4-4" />
            </svg>
            <span>{sortOptions[sortOption]}</span>
          </button>
        </div>
      </div>

      <div id="goals-list" className="space-y-4 max-w-full overflow-x-hidden">
        {activeGoals.length > 0 ? (
          activeGoals.map(goal => (
            <GoalCard
              key={goal._id}
              goal={goal}
              onClick={() => onGoalClick(goal)}
              onRecurring={() => onRecurring(goal)}
              onWhatIf={() => onWhatIf(goal)}
              fetchGoals={fetchGoals}
              onDelete={() => onDelete(goal)}
              onNotes={() => onNotes(goal)}
            />
          ))
        ) : (
          <div className="capy-card border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="mb-3 text-4xl">🚀</p>
            <p className="font-semibold text-[color:var(--text-color)]">{t('start_journey')}</p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary-color)]">{t('no_active_goals')}</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default ActiveGoalsSection;
