import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { notifyVoiceCommandApplied, pickMimeType, sendVoiceCommand } from './voice-api';
import { voiceErrorText } from './voice-errors';

export type VoicePhase = 'idle' | 'recording' | 'uploading';

/** Запись по удержанию кнопки и отправка голосовой команды. */
export function useVoiceCommand(onVoiceSuccess?: () => void) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<VoicePhase>('idle');
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

      try {
        const data = await sendVoiceCommand(blob, blobType);

        if (data.executed) {
          notifyVoiceCommandApplied(data.walletTouched);
          onVoiceSuccess?.();
        }
        showToast(
          data.message || (data.executed ? t('voice_done') : t('voice_not_executed')),
        );
      } catch (err: unknown) {
        console.error('assistant/voice', err);
        showToast(voiceErrorText(err, t));
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

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
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

  return { phase, toast, onPointerDown };
}
