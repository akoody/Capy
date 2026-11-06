interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  // Add other properties from Telegram WebApp script if needed
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
