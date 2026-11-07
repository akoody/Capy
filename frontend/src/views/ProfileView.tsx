import { useState, useEffect } from 'react';
import api from '../services/api';
import { Achievement, User } from '../types';
import SettingsSection from '../components/SettingsSection';
import { useTranslation } from 'react-i18next';

interface ProfileViewProps {
  user: User | null;
  loading: boolean;
  onShowCertificate: () => void;
  onOpenAcademy: () => void;
}

const ProfileView = ({ user, loading, onOpenAcademy }: ProfileViewProps) => {
  const { t } = useTranslation();
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [streak, setStreak] = useState(0);
  const [activeTab, setActiveTab] = useState('achievements');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        try {
          const achievementsRes = await api.get('/achievements');
          setAllAchievements(achievementsRes.data);

          const streakRes = await api.get('/users/me/streak');
          setStreak(streakRes.data.streak);

          const leaderboardRes = await api.get('/gamification/leaderboard');
          setLeaderboard(leaderboardRes.data);
        } catch (error) {
          console.error("Failed to fetch profile data", error);
          setError('Failed to fetch profile data. Please try again later.');
        }
      }
    };
    fetchData();
  }, [user]);

  const userAchievementIds = new Set(
    (user?.achievements ?? []).map((a) => a._id),
  );

  if (loading) {
    return (
      <div className="space-y-6 py-8" aria-busy>
        <div className="capy-shimmer mx-auto h-24 w-24 rounded-full" />
        <div className="capy-shimmer mx-auto h-8 w-40 rounded-lg" />
        <div className="capy-shimmer h-24 rounded-[var(--radius-lg)]" />
      </div>
    );
  }
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <>
      <div className="mb-8 flex flex-col items-center text-center">
        {user?.photoUrl ? (
          <img
            src={user.photoUrl}
            alt=""
            className="mb-4 h-24 w-24 rounded-full object-cover ring-2 ring-white/10 ring-offset-4 ring-offset-[color:var(--bg-color)]"
          />
        ) : (
          <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 ring-2 ring-white/10">
            <span className="text-3xl font-bold text-[color:var(--text-color)]">{user?.firstName?.charAt(0)}</span>
          </div>
        )}
        <h2 className="text-xl font-bold tracking-tight text-[color:var(--text-color)]">
          {user?.firstName} {user?.lastName}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--text-tertiary)]">@{user?.username}</p>
      </div>

      <div className="capy-card mb-8 grid grid-cols-3 gap-2 p-4 text-center">
        <div className="rounded-xl py-2">
          <p className="text-xl font-bold tabular-nums text-[color:var(--text-color)]">{user?.points || 0}</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]">Очки</p>
        </div>
        <div className="rounded-xl py-2">
          <p className="text-xl font-bold tabular-nums text-[color:var(--text-color)]">{user?.goals?.length || 0}</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]">Цели</p>
        </div>
        <div className="rounded-xl py-2">
          <p className="text-xl font-bold tabular-nums text-[color:var(--primary-color)]">{streak}</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-[color:var(--text-tertiary)]">Марафон</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenAcademy}
        className="capy-card mb-8 flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--primary-muted)', color: 'var(--primary-color)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[color:var(--text-color)]">{t('academy')}</span>
          <span className="mt-0.5 block text-sm text-[color:var(--text-tertiary)]">{t('academy_subtitle')}</span>
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-[color:var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="mb-8">
        <div className="flex gap-1 rounded-[var(--radius-md)] bg-black/30 p-1">
          {(['achievements', 'leaderboard', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`min-w-0 flex-1 rounded-lg py-2.5 text-center text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-[color:var(--primary-muted)] text-[color:var(--primary-color)] shadow-[0_0_0_1px_var(--primary-ring)]'
                  : 'text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)]'
              }`}
            >
              {tab === 'achievements' ? t('achievements') : tab === 'leaderboard' ? t('leaderboard') : t('settings')}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'achievements' && (
        <section id="achievements-section">
          <div className="grid grid-cols-4 gap-x-4 gap-y-6 text-center">
            {allAchievements.map(ach => {
              const isUnlocked = userAchievementIds.has(ach._id);
              return (
                <div key={ach._id} className={`flex flex-col items-center transition-opacity ${!isUnlocked && 'opacity-30'}`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg relative overflow-hidden ${isUnlocked ? 'bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)]' : 'bg-black/20'}`}>
                    {ach.icon}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${isUnlocked ? 'text-[color:var(--text-color)]' : 'text-[color:var(--text-secondary-color)]'}`}>{ach.name}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'leaderboard' && (
        <section id="leaderboard-section">
          <div className="capy-card p-4">
            {leaderboard.map((leader, index) => (
              <div key={leader._id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-b-0">
                <p>#{index + 1} {leader.firstName}</p>
                <p>{leader.points} очков</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'settings' && (
        <section id="settings-section">
          <SettingsSection />
        </section>
      )}
    </>
  );
};

export default ProfileView;
