import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import { localeTag } from '../../lib/group-by-day';
import type { JournalEntry } from '../../types';
import { entryDay } from './journal-entries';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onOpen: () => void;
  onDelete: () => void;
}

const PREVIEW_LENGTH = 200;

const JournalEntryCard = ({ entry, onOpen, onDelete }: JournalEntryCardProps) => {
  const { t, i18n } = useTranslation();

  return (
    <div
      className="bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] rounded-lg p-3 cursor-pointer hover:border-[color:var(--primary-color)]/50 transition-colors"
      onClick={onOpen}
    >
      {entry.title && (
        <h4 className="font-semibold text-[color:var(--text-color)] text-sm mb-1.5 leading-tight">{entry.title}</h4>
      )}
      <p className="text-[color:var(--text-secondary-color)] text-xs leading-relaxed whitespace-pre-wrap break-words line-clamp-3 mb-2">
        {entry.content.length > PREVIEW_LENGTH ? `${entry.content.substring(0, PREVIEW_LENGTH)}...` : entry.content}
      </p>
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-[color:var(--card-bg-color)] text-[color:var(--text-secondary-color)] rounded text-xs border border-[color:var(--card-border-color)]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-between items-center pt-2 border-t border-[color:var(--card-border-color)]">
        <div className="flex items-center gap-1.5 text-xs text-[color:var(--text-secondary-color)]">
          <Icon name="clock" className="h-3 w-3" />
          <span>
            {new Date(entryDay(entry)).toLocaleTimeString(localeTag(i18n.language), {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <button
          type="button"
          aria-label={t('delete')}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-[color:var(--text-secondary-color)] hover:text-red-400 transition-colors p-1"
        >
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default JournalEntryCard;
