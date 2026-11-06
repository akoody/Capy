import { useState, useMemo, useEffect } from 'react';
import { useAcademy } from '../context/AcademyContext';
import { Course, Category, Goal } from '../types';
import { tips, Tip } from '../services/tips';
import { useTranslation } from 'react-i18next';

interface AcademyViewProps {
  onCourseSelect: (courseId: string) => void;
  goals?: Goal[];
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

const AcademyView = ({ onCourseSelect, goals = [] }: AcademyViewProps) => {
  const { courses, user, loading, error } = useAcademy();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Category | ''>(() => {
    if (courses.length > 0) {
      const categories = [...new Set(courses.map(c => c.category))];
      return categories[0];
    }
    return '';
  });

  useEffect(() => {
    if (courses.length > 0) {
      const categories = [...new Set(courses.map(c => c.category))];
      if (!activeTab || !categories.includes(activeTab)) {
        setActiveTab(categories[0]);
      }
    }
  }, [courses, activeTab]);

  const coursesByCategory = useMemo(() => {
    return courses.reduce((acc, course) => {
      const category = course.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(course);
      return acc;
    }, {} as Record<string, Course[]>);
  }, [courses]);

  const level = useMemo(() => {
    if (!user) return 1;
    const points = user.points;
    if (points < 100) return 1;
    if (points < 250) return 2;
    if (points < 500) return 3;
    if (points < 1000) return 4;
    return 5;
  }, [user]);

  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    setTip(getRelevantTip(goals));
  }, [goals]);

  if (loading) {
    return (
      <div className="space-y-4 py-6" aria-busy>
        <div className="capy-shimmer h-10 w-40 rounded-lg" />
        <div className="capy-shimmer h-36 rounded-[var(--radius-lg)]" />
      </div>
    );
  }
  if (error) {
    return <p className="text-center text-[color:var(--expense-color)]">{t('error_fetching_data')}</p>;
  }

  return (
    <section id="academy-section">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 className="capy-page-title">{t('academy')}</h2>
        {user && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-[color:var(--text-color)]">
              {t('level')} {level}
            </p>
            <p className="text-xs text-[color:var(--text-tertiary)]">{user.points} XP</p>
          </div>
        )}
      </div>

      {/* Tips Section */}
      <div className="mb-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-[color:var(--text-tertiary)]">
          {t('tip_of_the_day')}
        </h3>
        <div className="capy-card flex min-h-[120px] flex-col items-center justify-center bg-gradient-to-br from-[color:var(--primary-muted)] to-transparent p-6 text-center">
          {!tip ? (
            <p className="text-[color:var(--text-secondary-color)]">{t('loading_tip')}</p>
          ) : (
            <>
              <p className="mb-3 text-4xl">💡</p>
              <p className="text-lg font-medium leading-snug text-[color:var(--text-color)]">{tip.content}</p>
              <p className="mt-2 text-sm text-[color:var(--text-secondary-color)]">— {tip.title}</p>
            </>
          )}
        </div>
      </div>

      <div className="mb-5 overflow-x-auto rounded-[var(--radius-md)] bg-black/30 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav className="flex min-w-min gap-1" aria-label="Tabs">
          {Object.keys(coursesByCategory).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveTab(category as Category)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                activeTab === category
                  ? 'bg-[color:var(--primary-muted)] text-[color:var(--primary-color)] shadow-[0_0_0_1px_var(--primary-ring)]'
                  : 'text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]'
              }`}
            >
              {category}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-4">
        {coursesByCategory[activeTab]?.map(course => {
          const completedLessons = course.lessons.filter(courseLesson => user?.completedLessons.some(completedLesson => completedLesson._id === courseLesson._id)).length || 0;
          const progress = (completedLessons / course.lessons.length) * 100;
          const isCompleted = user?.completedCourses?.includes(course._id);

          return (
            <button
              key={course._id}
              type="button"
              onClick={() => onCourseSelect(course._id)}
              className="capy-card w-full p-5 text-left transition-all duration-200 hover:ring-1 hover:ring-[color:var(--primary-ring)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-[color:var(--text-color)]">{course.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-secondary-color)]">{course.description}</p>
                </div>
                {isCompleted && (
                  <span className="shrink-0 text-xs font-bold text-[color:var(--income-color)]">{t('completed')}</span>
                )}
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs font-medium text-[color:var(--text-tertiary)]">
                  <span>{t('progress')}</span>
                  <span>
                    {completedLessons} / {course.lessons.length}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/35">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500/90 to-[color:var(--primary-color)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  );
};

export default AcademyView;
