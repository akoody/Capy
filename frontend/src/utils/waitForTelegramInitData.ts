/** В WebView Telegram initData иногда появляется чуть позже ready(); в обычном браузере всегда пусто. */
export async function waitForTelegramInitData(
  maxMs = 8000,
  stepMs = 120,
): Promise<boolean> {
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  if (webApp?.initData && webApp.initData.length > 0) {
    return true;
  }

  // Нельзя выходить по platform === 'unknown': в части клиентов Telegram так бывает до появления initData.
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const d =
      typeof window !== 'undefined'
        ? (window.Telegram?.WebApp?.initData ?? '')
        : '';
    if (d.length > 0) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  const final =
    typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData ?? '' : '';
  return final.length > 0;
}
