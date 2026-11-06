import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import api from './services/api';

import { Goal, Course, Lesson, User, JournalEntry } from './types';
import Confetti from 'react-confetti';
import { usePrevious } from './hooks/usePrevious';

import { AcademyProvider } from './context/AcademyContext';
import { LanguageProvider } from './context/LanguageContext';
import { CurrencyProvider } from './context/CurrencyContext';

import GoalsView from './views/GoalsView';
import TasksView from './views/TasksView';
import ProfileView from './views/ProfileView';
import AcademyView from './views/AcademyView';
import TransactionsView from './views/TransactionsView';
import SettingsView from './views/SettingsView';
import JournalView from './views/JournalView';
import JournalFAB from './components/JournalFAB';
import VoiceAssistantFAB from './components/VoiceAssistantFAB';

const CourseView = lazy(() => import('./views/CourseView'));
const LessonView = lazy(() => import('./views/LessonView'));
const CertificateView = lazy(() => import('./views/CertificateView'));

import LangUpdater from './components/LangUpdater';
import { waitForTelegramInitData } from './utils/waitForTelegramInitData';

function App() {
  const [activeView, setActiveView] = useState('goals');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  /** Нет initData (браузер) или вход не удался — показываем текст вместо «пустого» экрана */
  const [authHint, setAuthHint] = useState<string | null>(null);
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(true);

  // Academy state
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const handleViewChange = (view: string) => {
    setActiveView(view);
    // Reset academy state when changing main views
    if (view !== 'academy') {
      setSelectedCourse(null);
      setSelectedLesson(null);
    }
  };

  const totalSavings = useMemo(() => {
    return goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  }, [goals]);

  const prevGoals = usePrevious(goals);


  // Effect to check for completed goals
  useEffect(() => {
    if (prevGoals && prevGoals.length > 0) {
      goals.forEach(goal => {
        const prevGoal = prevGoals.find(p => p._id === goal._id);
        if (prevGoal && prevGoal.currentAmount < prevGoal.targetAmount && goal.currentAmount >= goal.targetAmount) {
          // Goal was just completed!
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000); // Show confetti for 5 seconds

          // Show notification
          if (Notification.permission === 'granted') {
            new Notification('Цель достигнута!', {
              body: `Поздравляем! Вы накопили на "${goal.name}".`,
              icon: './logo.svg' // Optional: add a logo
            });
          }
        }
      });
    }
  }, [goals, prevGoals]);

  const fetchGoals = useCallback(async () => {
    if (!user?._id) return;
    try {
      const goalsResponse = await api.get(`/goals?userId=${user._id}`);
      setGoals(goalsResponse.data);
    } catch (err) {
      console.error("Failed to fetch goals", err);
    }
  }, [user]);

  const fetchJournalEntries = useCallback(async () => {
    try {
      const response = await api.get('/journal');
      setJournalEntries(response.data);
    } catch (error) {
      console.error('Failed to fetch journal entries', error);
    } finally {
      setJournalLoading(false);
    }
  }, []);

  useEffect(() => {
    const setup = async () => {
      setLoading(true);
      try {
        const hasInit = await waitForTelegramInitData();
        if (!hasInit) {
          setAuthHint(
            'Откройте приложение кнопкой в Telegram (у бота). В обычном браузере вход недоступен.',
          );
          console.error(
            'Telegram initData пустой — откройте приложение кнопкой из бота, не просто ссылкой в браузере.',
          );
          return;
        }

        const userResponse = await api.post<User>('/auth/login');
        const currentUser = userResponse.data;
        setUser(currentUser);
        setAuthHint(null);

      } catch (err: any) {
        const st = err?.response?.status;
        setAuthHint(
          st === 403
            ? 'Не удалось проверить данные Telegram. Проверьте TELEGRAM_BOT_TOKEN на сервере (тот же бот, что открыл приложение).'
            : st === 503
              ? 'Сервер не настроен (например TELEGRAM_BOT_TOKEN). Обратитесь к администратору.'
              : 'Не удалось войти. Попробуйте закрыть приложение и открыть снова из бота.',
        );
        console.error("Setup failed:", err);
      } finally {
        setLoading(false);
      }
    };

    setup();
  }, []);

  useEffect(() => {
    if (user) {
      fetchGoals();
      fetchJournalEntries();
    }
  }, [user, fetchGoals, fetchJournalEntries]);

  const handleCourseSelect = async (courseId: string) => {
    try {
      const response = await api.get<Course>(`/academy/courses/${courseId}`);
      setSelectedCourse(response.data);
    } catch (error) {
      console.error("Failed to fetch course", error);
    }
  };

  return (
    <AcademyProvider userId={user?._id ?? null}>
      <LanguageProvider userId={user?._id ?? null}>
        <LangUpdater />
        <CurrencyProvider userId={user?._id ?? null}>
          {/* FAB с position:fixed не должны быть внутри overflow-x-hidden — в Telegram WebView их обрезает. */}
          <>
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-hidden">
              {showConfetti && <Confetti recycle={false} />}
              <Header totalSavings={totalSavings} />
              <main className="flex-grow overflow-x-hidden px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-1">
                {authHint && (
                  <p
                    className="mb-4 rounded-[var(--radius-lg)] border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3.5 text-center text-sm leading-relaxed text-amber-100/95"
                    role="alert"
                  >
                    {authHint}
                  </p>
                )}
                <Suspense
                  fallback={
                    <div className="space-y-4 py-6" aria-hidden>
                      <div className="capy-shimmer h-28 rounded-[var(--radius-lg)]" />
                      <div className="capy-shimmer h-36 rounded-[var(--radius-lg)]" />
                      <div className="capy-shimmer h-24 rounded-[var(--radius-lg)]" />
                    </div>
                  }
                >
                  {showCertificate && <CertificateView user={user} />}
                  <div style={{ display: activeView === 'goals' ? 'block' : 'none' }}>
                    <GoalsView goals={goals} userId={user?._id ?? null} fetchGoals={fetchGoals} />
                  </div>
                  <div style={{ display: activeView === 'transactions' ? 'block' : 'none' }}>
                    <TransactionsView />
                  </div>
                  <div style={{ display: activeView === 'tasks' ? 'block' : 'none' }}>
                    <TasksView userId={user?._id ?? null} />
                  </div>
                  <div style={{ display: activeView === 'academy' ? 'block' : 'none' }}>
                    {selectedLesson ? (
                      <LessonView lesson={selectedLesson} onBack={() => setSelectedLesson(null)} />
                    ) : selectedCourse ? (
                      <CourseView course={selectedCourse} onLessonSelect={setSelectedLesson} onBack={() => setSelectedCourse(null)} />
                    ) : (
                      <AcademyView onCourseSelect={handleCourseSelect} goals={goals} />
                    )}
                  </div>
                  <div style={{ display: activeView === 'profile' ? 'block' : 'none' }}>
                    <ProfileView
                      user={user}
                      loading={loading}
                      onShowCertificate={() => setShowCertificate(true)}
                      onOpenAcademy={() => handleViewChange('academy')}
                    />
                  </div>
                  <div style={{ display: activeView === 'settings' ? 'block' : 'none' }}>
                    <SettingsView />
                  </div>
                </Suspense>
              </main>
              <BottomNav activeView={activeView} setActiveView={handleViewChange} />
            </div>
            {showJournal ? (
              <JournalView
                isModal={true}
                onClose={() => setShowJournal(false)}
                initialEntries={journalEntries}
                initialLoading={journalLoading}
                onEntriesUpdate={setJournalEntries}
              />
            ) : (
              <>
                <VoiceAssistantFAB
                  onVoiceSuccess={() => {
                    void fetchGoals();
                    void fetchJournalEntries();
                  }}
                />
                <JournalFAB onClick={() => setShowJournal(true)} />
              </>
            )}
          </>
        </CurrencyProvider>
      </LanguageProvider>
    </AcademyProvider>
  );
}

export default App;
