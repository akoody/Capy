import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import { AchievementProvider } from './context/AchievementContext';

function initTelegramChrome(): void {
  try {
    const w = window.Telegram?.WebApp;
    if (!w) return;
    w.ready();
    w.expand();
  } catch (e) {
    console.error('Telegram WebApp init:', e);
  }
}

// После парсинга inline-скрипта TG иногда нужен тик, иначе WebApp ещё пустой
initTelegramChrome();
queueMicrotask(() => initTelegramChrome());

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root not found');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AchievementProvider>
      <App />
    </AchievementProvider>
  </React.StrictMode>,
);