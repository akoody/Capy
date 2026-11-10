import api from '../../services/api';

export interface VoiceCommandResult {
  transcript: string;
  message: string;
  executed: boolean;
  walletTouched?: boolean;
}

export const pickMimeType = (): string | undefined => {
  // Whisper принимает mp4/m4a, но не webm. Предпочитаем MP4, если браузер умеет.
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

export async function sendVoiceCommand(
  audio: Blob,
  mimeType: string,
): Promise<VoiceCommandResult> {
  const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
  const form = new FormData();
  form.append('audio', audio, `voice.${ext}`);
  const { data } = await api.post<VoiceCommandResult>('/assistant/voice', form);
  return data;
}

/** После команды обновляются все экраны, которые она могла затронуть. */
export function notifyVoiceCommandApplied(walletTouched: boolean | undefined) {
  if (walletTouched) {
    window.dispatchEvent(new CustomEvent('walletUpdated'));
  }
  for (const event of [
    'capyTransactionsUpdated',
    'tasksUpdated',
    'capyCategoriesUpdated',
    'capyBudgetsUpdated',
  ]) {
    window.dispatchEvent(new CustomEvent(event));
  }
}
