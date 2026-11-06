import { Goal } from '../types';
import GoalCard from './GoalCard';
import { useTranslation } from 'react-i18next';

interface CompletedGoalsSectionProps {
  completedGoals: Goal[];
  onGoalClick: (goal: Goal) => void;
  onRecurring: (goal: Goal) => void;
  onWhatIf: (goal: Goal) => void;
  fetchGoals: () => void;
  onDelete: (goal: Goal) => void;
  onNotes: (goal: Goal) => void;
}

const CompletedGoalsSection = ({ completedGoals, onGoalClick, onRecurring, onWhatIf, fetchGoals, onDelete, onNotes }: CompletedGoalsSectionProps) => {
  const { t } = useTranslation();
  if (completedGoals.length === 0) return null;

  return (
    <section id="completed-goals-section" className="mt-10 max-w-full overflow-x-hidden">
      <h2 className="capy-page-title mb-5">{t('completed_goals')}</h2>
      <div className="space-y-4 max-w-full overflow-x-hidden">
        {completedGoals.map(goal => (
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
        ))}
      </div>
    </section>
  );
};

export default CompletedGoalsSection;
