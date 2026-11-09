import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import { useVoiceCommand } from './useVoiceCommand';

interface VoiceAssistantFABProps {
  /** Вызывается после выполненной команды. */
  onVoiceSuccess?: () => void;
}

const VoiceAssistantFAB = ({ onVoiceSuccess }: VoiceAssistantFABProps) => {
  const { t } = useTranslation();
  const { phase, toast, onPointerDown } = useVoiceCommand(onVoiceSuccess);
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
          <Icon name="microphone" className="h-7 w-7" />
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
