import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

type Phase = 'idle' | 'recording' | 'uploading';

interface VoiceAssistantFABProps {
  /** Called after a successful command (refresh parent lists if needed). */
  onVoiceSuccess?: () => void;
}

const pickMimeType = (): string | undefined => {
  // Whisper принимает mp4/m4a; webm — нет. Предпочитаем MP4, если браузер умеет.
  const candidates = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return undefined;
};

function looksLikeGatewayHtmlBody(data: unknown): boolean {
  if (typeof data !== 'string') {
    return false;
  }
  const head = data.slice(0, 400).toLowerCase();
  return (
    head.includes('<html') ||
    head.includes('<!doctype') ||
    head.includes('nginx') ||
    head.includes('bad gateway') ||
    head.includes('gateway timeout')
  );
}

/** Текст ошибки с Nest / OpenAI / nginx для тоста */
function voiceRequestErrorMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as {
    message?: string;
    response?: {
      status?: number;
      data?: unknown;
    };
  };
  const status = e.response?.status;
  const data = e.response?.data;

  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (typeof d.message === 'string') return d.message;
    if (Array.isArray(d.message)) return d.message.map(String).join('; ');
    if (typeof d.error === 'object' && d.error !== null) {
      const er = d.error as Record<string, unknown>;
      if (typeof er.message === 'string') return er.message;
    }
  }

  if (status === 413) {
    return 'Файл слишком большой: в nginx увеличь client_max_body_size для /api/ (например 25m).';
  }
  if (status === 502 || status === 504) {
    return 'Сервер не ответил (502/504). Проверьте pm2 и порт Nest.';
  }
  if (status === 503) {
    return (
      (typeof data === 'object' &&
        data !== null &&
        typeof (data as { message?: unknown }).message === 'string' &&
        (data as { message: string }).message) ||
      'Сервис временно недоступен (503). Проверьте .env и pm2 restart capy-api.'
    );
  }
  if (status === 500) {
    if (looksLikeGatewayHtmlBody(data)) {
      return 'Ответ 500 с HTML (часто nginx до Node). Смотрите /var/log/nginx/error.log и таймауты proxy_* для location /api/.';
    }
    if (data === undefined || data === null || data === '') {
      return 'Пустой ответ при 500: запрос мог не дойти до Nest. Проверьте nginx error.log и curl localhost:3001 с сервера.';
    }
    const hint =
      typeof data === 'object' && data !== null && typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : null;
    return hint && hint !== 'Internal server error'
      ? hint
      : 'Ошибка сервера (500). Смотрите pm2 logs capy-api — если строк нет, это не Nest (см. nginx).';
  }
  if (status === 401 || status === 403) {
    return 'Доступ запрещён (401/403). Проверьте TELEGRAM_BOT_TOKEN в .env на сервере.';
  }

  if (e.message === 'Network Error') {
    return 'Нет соединения с сервером.';
  }
  if (typeof e.message === 'string' && e.message.length > 0 && e.message.length < 200) {
    return e.message;
  }
  return null;
}

const VoiceAssistantFAB = ({ onVoiceSuccess }: VoiceAssistantFABProps) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /**
   * Принимаем dataavailable только от текущего MediaRecorder.
   * Нельзя использовать счётчик сессий: в Telegram при visibility «hidden» он мог увеличиваться во время записи,
   * и все чанки отбрасывались → пустой файл и «Слишком короткая запись».
   */
  const chunksRecorderRef = useRef<MediaRecorder | null>(null);
  const finishingRef = useRef(false);
  const pointerEndHandlerRef = useRef<(() => void) | null>(null);
  const pointerCaptureRef = useRef<{ el: Element; id: number } | null>(null);
  /** Один живой поток микрофона на сессию: иначе iOS / Telegram WebView часто снова показывают запрос после stop() на треках. */
  const micStreamRef = useRef<MediaStream | null>(null);
  /** Не используем clone() для записи: в Telegram WebView клон часто даёт пустые чанки → «Слишком короткая запись». */
  const recordStreamDisposeRef = useRef<(() => void) | null>(null);

  const releaseMicStream = useCallback(() => {
    const s = micStreamRef.current;
    if (s) {
      s.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
  }, []);

  const releasePointerCaptureSafe = useCallback(() => {
    const p = pointerCaptureRef.current;
    if (!p) return;
    pointerCaptureRef.current = null;
    try {
      if (p.el.hasPointerCapture?.(p.id)) {
        p.el.releasePointerCapture(p.id);
      }
    } catch {
      /* WebView */
    }
  }, []);

  const detachPointerEnd = useCallback(() => {
    releasePointerCaptureSafe();
    const fn = pointerEndHandlerRef.current;
    if (fn) {
      document.removeEventListener('pointerup', fn, true);
      document.removeEventListener('pointercancel', fn, true);
      pointerEndHandlerRef.current = null;
    }
  }, [releasePointerCaptureSafe]);

  useEffect(() => () => detachPointerEnd(), [detachPointerEnd]);

  useEffect(() => {
    /**
     * Не вызывать releaseMicStream при visibility hidden: в Telegram/iOS WebView вкладка
     * часто уходит в hidden при смене чата или сворачивании. Если гасить треки, следующий
     * getUserMedia снова показывает «Разрешить микрофон».
     * Отпускаем микрофон только при уходе со страницы (pagehide / unload) и размонтировании.
     */
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      detachPointerEnd();
      if (recorderRef.current?.state === 'recording') {
        chunksRecorderRef.current = null;
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
        recorderRef.current = null;
        chunksRef.current = [];
      }
      try {
        recordStreamDisposeRef.current?.();
      } catch {
        /* ignore */
      }
      recordStreamDisposeRef.current = null;
      setPhase((p) => (p === 'recording' ? 'idle' : p));
    };
    const releaseOnLeave = () => {
      releaseMicStream();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', releaseOnLeave);
    window.addEventListener('beforeunload', releaseOnLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', releaseOnLeave);
      window.removeEventListener('beforeunload', releaseOnLeave);
      releaseMicStream();
    };
  }, [detachPointerEnd, releaseMicStream]);

  const haptic = (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
    } catch {
      /* ignore */
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4500);
  };

  const finishRecording = useCallback(async () => {
    detachPointerEnd();
    if (finishingRef.current) {
      return;
    }

    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') {
      setPhase((p) => (p === 'recording' ? 'idle' : p));
      return;
    }

    finishingRef.current = true;

    try {
      let blob: Blob | undefined;
      let blobType = 'audio/webm';

      try {
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          // Сбросить хвост буфера: иначе часть браузеров отдаёт неполный/битый WebM со 2-й записи.
          if (rec.state === 'recording') {
            try {
              rec.requestData();
            } catch {
              /* старые WebView без requestData */
            }
          }
          rec.stop();
        });
        // В WebKit финальный dataavailable иногда приходит после onstop.
        await new Promise((r) => setTimeout(r, 220));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        blobType = rec.mimeType || pickMimeType() || 'audio/webm';
        blob = new Blob(chunksRef.current, { type: blobType });
        chunksRef.current = [];
      } finally {
        chunksRecorderRef.current = null;
        recorderRef.current = null;
        try {
          recordStreamDisposeRef.current?.();
        } catch {
          /* ignore */
        }
        recordStreamDisposeRef.current = null;
      }

      if (!blob || blob.size < 120) {
        setPhase('idle');
        showToast(t('voice_too_short'));
        return;
      }

      setPhase('uploading');
      haptic('light');

      const ext = blobType.includes('mp4') ? 'm4a' : 'webm';
      const form = new FormData();
      form.append('audio', blob, `voice.${ext}`);

      try {
        const { data } = await api.post<{
          transcript: string;
          message: string;
          executed: boolean;
          walletTouched?: boolean;
        }>('/assistant/voice', form);

        if (data.executed) {
          if (data.walletTouched) {
            window.dispatchEvent(new CustomEvent('walletUpdated'));
          }
          window.dispatchEvent(new CustomEvent('capyTransactionsUpdated'));
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
          window.dispatchEvent(new CustomEvent('capyCategoriesUpdated'));
          window.dispatchEvent(new CustomEvent('capyBudgetsUpdated'));
          onVoiceSuccess?.();
        }
        showToast(
          data.message || (data.executed ? t('voice_done') : t('voice_not_executed')),
        );
      } catch (err: unknown) {
        console.error('assistant/voice', err);
        const msg = voiceRequestErrorMessage(err);
        showToast(msg ?? t('voice_request_failed'));
      } finally {
        setPhase('idle');
      }
    } finally {
      finishingRef.current = false;
    }
  }, [detachPointerEnd, onVoiceSuccess, t]);

  const startRecording = useCallback(async () => {
    if (phase !== 'idle') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(t('voice_mic_unavailable'));
      return;
    }
    try {
      let stream: MediaStream | null = micStreamRef.current;
      const tracks = stream?.getAudioTracks() ?? [];
      const hasLiveTrack = tracks.some((t) => t.readyState === 'live');
      if (!hasLiveTrack) {
        releaseMicStream();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
      }
      if (!stream) {
        showToast(t('voice_mic_unavailable'));
        return;
      }
      const masterTrack = stream.getAudioTracks()[0];
      if (!masterTrack || masterTrack.readyState !== 'live') {
        releaseMicStream();
        showToast(t('voice_mic_unavailable'));
        return;
      }

      const recordStream = stream;
      recordStreamDisposeRef.current = () => {};

      const mimeType = pickMimeType();
      let rec: MediaRecorder;
      try {
        rec = mimeType
          ? new MediaRecorder(recordStream, { mimeType })
          : new MediaRecorder(recordStream);
      } catch {
        rec = new MediaRecorder(recordStream);
      }
      chunksRef.current = [];
      chunksRecorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (chunksRecorderRef.current !== rec) return;
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      // Timeslice: в iOS/Telegram без него часто нет ни одного чанка до stop или пустой финальный blob.
      rec.start(250);
      recorderRef.current = rec;
      setPhase('recording');
      haptic('medium');

      const onUp = () => {
        detachPointerEnd();
        void finishRecording();
      };
      pointerEndHandlerRef.current = onUp;
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onUp, true);
    } catch {
      releaseMicStream();
      showToast(t('voice_mic_denied'));
    }
  }, [detachPointerEnd, finishRecording, phase, releaseMicStream, t]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    pointerCaptureRef.current = { el, id: e.pointerId };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* старые WebView */
    }
    void startRecording();
  };

  const busy = phase === 'uploading';
  const recording = phase === 'recording';

  return (
    <>
      <button
        type="button"
        aria-label={t('voice_assistant')}
        title={t('voice_hold_hint')}
        disabled={busy}
        onPointerDown={onPointerDown}
        className={`fixed right-5 z-[10050] flex h-14 w-14 select-none items-center justify-center rounded-full transition-all duration-150 touch-none ${
          recording || busy ? 'text-white' : 'text-[#0c0c0f]'
        } ${busy ? 'scale-95 opacity-60' : 'active:scale-95'} ${
          recording ? 'animate-pulse ring-4 ring-rose-500/50' : ''
        }`}
        style={{
          bottom: 'var(--fab-voice-bottom)',
          background: recording
            ? '#be123c'
            : 'linear-gradient(165deg, #c4b5fd 0%, var(--primary-color) 100%)',
          boxShadow: recording
            ? '0 4px 24px rgba(190, 18, 60, 0.45)'
            : '0 4px 20px rgba(99, 102, 241, 0.35), 0 0 0 1px rgba(255,255,255,0.15) inset',
        }}
      >
        {busy ? (
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </button>
      {toast && (
        <div
          className="fixed left-4 right-4 z-[60] rounded-[var(--radius-lg)] border border-white/10 bg-zinc-950/90 px-4 py-3.5 text-sm leading-relaxed text-zinc-100 shadow-2xl backdrop-blur-xl"
          style={{
            bottom: 'calc(var(--fab-voice-bottom) + 4rem)',
          }}
          role="status"
        >
          {toast}
        </div>
      )}
    </>
  );
};

export default VoiceAssistantFAB;
