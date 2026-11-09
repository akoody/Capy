import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import api, { apiErrorMessage } from '../../services/api';

/** Кнопка AI-разбора операций и его результат. */
const TransactionAnalysis = () => {
  const { t } = useTranslation();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const analyze = async () => {
    setAnalyzing(true);
    setResult(null);
    try {
      const { data } = await api.post('/transactions/analyze');
      setResult(data.analysis || data);
    } catch (error) {
      console.error('Failed to analyze transactions', error);
      setResult(apiErrorMessage(error, t('analysis_error') || 'Не удалось проанализировать транзакции. Попробуйте позже.'));
    } finally {
      setAnalyzing(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const iconButton = 'text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] p-1 shrink-0 transition-colors';

  return (
    <div className="mb-6 mt-6">
      <button type="button" onClick={() => void analyze()} disabled={analyzing} className="capy-btn-primary">
        {analyzing ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t('analyzing') || 'Анализ...'}
          </>
        ) : (
          <>
            <Icon name="chart" />
            {t('analyze_transactions')}
          </>
        )}
      </button>
      {result && (
        <div className="capy-card mt-4 overflow-hidden p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-[color:var(--text-color)]">{t('analysis_result') || 'Результат анализа'}</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => void copy()} className={iconButton} title="Копировать">
                <Icon name="copy" />
              </button>
              <button type="button" onClick={() => setResult(null)} className={iconButton}>
                <Icon name="close" />
              </button>
            </div>
          </div>
          <div className="text-[color:var(--text-secondary-color)] whitespace-pre-wrap text-sm leading-relaxed overflow-y-auto max-h-48">
            {result}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionAnalysis;
