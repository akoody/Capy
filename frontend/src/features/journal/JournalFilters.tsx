import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import type { JournalSort } from './journal-entries';

interface JournalFiltersProps {
  query: string;
  onQueryChange: (query: string) => void;
  sort: JournalSort;
  onSortChange: (sort: JournalSort) => void;
  tags: string[];
  activeTag: string | null;
  onActiveTagChange: (tag: string | null) => void;
}

const JournalFilters = ({
  query,
  onQueryChange,
  sort,
  onSortChange,
  tags,
  activeTag,
  onActiveTagChange,
}: JournalFiltersProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex-shrink-0 space-y-3 mb-4 overflow-x-hidden">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('search')}
          className="w-full bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-4 py-2.5 pl-10 pr-8 border border-[color:var(--card-border-color)] focus:border-[color:var(--primary-color)] focus:outline-none transition-colors"
        />
        <span className="text-[color:var(--text-secondary-color)] absolute left-3 top-1/2 -translate-y-1/2">
          <Icon name="search" className="h-4 w-4" />
        </span>
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] p-1 transition-colors"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          onClick={() => onSortChange(sort === 'date' ? 'recent' : 'date')}
          className="px-3 py-1.5 bg-[color:var(--card-bg-color)] text-[color:var(--text-secondary-color)] rounded-lg text-sm hover:text-white transition-colors flex items-center gap-2 border border-[color:var(--card-border-color)] shrink-0"
        >
          <Icon name="sort" className="h-4 w-4" />
          {sort === 'date' ? 'По дате' : 'Недавние'}
        </button>
        {activeTag && (
          <button
            type="button"
            onClick={() => onActiveTagChange(null)}
            className="px-3 py-1.5 bg-[color:var(--card-bg-color)] text-white rounded-lg text-sm hover:opacity-80 transition-opacity flex items-center gap-2 border border-[color:var(--card-border-color)] shrink-0"
          >
            <Icon name="close" className="h-4 w-4" />
            {activeTag}
          </button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onActiveTagChange(activeTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTag === tag
                  ? 'bg-[color:var(--primary-color)] text-white'
                  : 'bg-[color:var(--card-bg-color)] text-[color:var(--text-secondary-color)] hover:text-white border border-[color:var(--card-border-color)]'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalFilters;
