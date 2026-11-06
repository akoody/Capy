import { useTranslation } from 'react-i18next';
import React from 'react';

interface BottomNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const iconClass = 'h-6 w-6';

const BottomNav = React.memo(({ activeView, setActiveView }: BottomNavProps) => {
  const { t } = useTranslation();

  const goalsIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );

  const profileIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );

  const transactionsIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const tasksIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );

  const navItems = [
    { id: 'goals', name: t('savings'), icon: goalsIcon },
    { id: 'transactions', name: t('transactions'), icon: transactionsIcon },
    { id: 'tasks', name: t('tasks'), icon: tasksIcon },
    { id: 'profile', name: t('profile'), icon: profileIcon },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-3 pointer-events-none"
      style={{
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <nav
        className="pointer-events-auto flex w-full max-w-md items-stretch justify-around gap-0.5 rounded-2xl border px-1 py-1.5 shadow-nav backdrop-blur-xl"
        style={{
          height: 'var(--fab-nav-height)',
          maxHeight: 'var(--fab-nav-height)',
          backgroundColor: 'rgba(20, 20, 25, 0.82)',
          borderColor: 'var(--card-border-color)',
          boxShadow: 'var(--shadow-nav), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
        aria-label="Main"
      >
        {navItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-colors duration-200"
              style={{
                color: active ? 'var(--primary-color)' : 'var(--text-tertiary)',
              }}
            >
              {active && (
                <span
                  className="absolute inset-x-2 top-1 bottom-1 -z-10 rounded-xl"
                  style={{ background: 'var(--primary-muted)' }}
                />
              )}
              <span className="flex items-center justify-center">{item.icon}</span>
              <span
                className="max-w-full truncate px-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]"
                style={{ opacity: active ? 1 : 0.75 }}
              >
                {item.name}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

export default BottomNav;
