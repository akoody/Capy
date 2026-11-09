import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GenericConfirmDeleteModal from '../../components/GenericConfirmDeleteModal';
import Icon from '../../components/Icon';
import { groupByDay, localeTag } from '../../lib/group-by-day';
import api from '../../services/api';
import type { JournalEntry } from '../../types';
import JournalEntryCard from './JournalEntryCard';
import JournalEntryModal from './JournalEntryModal';
import JournalFilters from './JournalFilters';
import {
  collectTags,
  entriesCountLabel,
  entryDay,
  entrySortTime,
  filterEntries,
  type JournalSort,
} from './journal-entries';

interface JournalViewProps {
  isModal?: boolean;
  onClose?: () => void;
  initialEntries?: JournalEntry[];
  initialLoading?: boolean;
  onEntriesUpdate?: (entries: JournalEntry[]) => void;
}

/** undefined — форма закрыта, null — новая запись. */
type EditorState = JournalEntry | null | undefined;

const JournalView = ({
  isModal = false,
  onClose,
  initialEntries = [],
  initialLoading = false,
  onEntriesUpdate,
}: JournalViewProps) => {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditorState>(undefined);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<JournalSort>('date');
  const [isAnimating, setIsAnimating] = useState(isModal);

  useEffect(() => {
    if (!isModal) return;
    const timer = setTimeout(() => setIsAnimating(false), 50);
    return () => clearTimeout(timer);
  }, [isModal]);

  const updateEntries = (next: JournalEntry[]) => {
    setEntries(next);
    onEntriesUpdate?.(next);
  };

  const fetchEntries = async () => {
    try {
      const response = await api.get<JournalEntry[]>('/journal');
      updateEntries(response.data);
    } catch (error) {
      console.error('Failed to fetch journal entries', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialEntries.length === 0 && !initialLoading) {
      setLoading(true);
      void fetchEntries();
    }
    // Загрузка только при открытии: дальше список обновляют действия пользователя.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await api.delete(`/journal/${entryToDelete._id}`);
      updateEntries(entries.filter((e) => e._id !== entryToDelete._id));
      setEntryToDelete(null);
    } catch (error) {
      console.error('Failed to delete entry', error);
    }
  };

  const allTags = useMemo(() => collectTags(entries), [entries]);
  const visibleEntries = useMemo(
    () => filterEntries(entries, searchQuery, filterTag),
    [entries, searchQuery, filterTag],
  );
  const days = useMemo(
    () =>
      groupByDay(visibleEntries, {
        day: entryDay,
        time: (entry) => entrySortTime(entry, sortBy),
        locale: localeTag(i18n.language),
      }),
    [visibleEntries, sortBy, i18n.language],
  );

  if (loading && entries.length === 0) {
    return (
      <div className={isModal ? 'fixed inset-0 z-50' : ''}>
        {isModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={onClose}
          />
        )}
        <div
          className={
            isModal
              ? 'fixed inset-4 bg-[color:var(--card-bg-color)] rounded-2xl shadow-2xl flex items-center justify-center'
              : 'p-4'
          }
        >
          <div className="text-white">{t('loading')}</div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex justify-between items-start mb-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white mb-1">{t('journal') || 'Дневник'}</h1>
          {entries.length > 0 && (
            <p className="text-sm text-[color:var(--text-secondary-color)]">{entriesCountLabel(entries.length)}</p>
          )}
        </div>
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[color:var(--text-secondary-color)] hover:text-white transition-colors p-1"
          >
            <Icon name="close" className="h-6 w-6" />
          </button>
        )}
      </div>

      <JournalFilters
        query={searchQuery}
        onQueryChange={setSearchQuery}
        sort={sortBy}
        onSortChange={setSortBy}
        tags={allTags}
        activeTag={filterTag}
        onActiveTagChange={setFilterTag}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {visibleEntries.length === 0 ? (
          <div className="text-center text-gray-400 mt-10 py-12">
            {searchQuery || filterTag ? (
              <>
                <Icon name="search" className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>{t('no_results') || 'Ничего не найдено'}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterTag(null);
                  }}
                  className="mt-2 text-[color:var(--primary-color)] hover:opacity-80 text-sm transition-opacity"
                >
                  Очистить фильтры
                </button>
              </>
            ) : (
              <>
                <Icon name="document" className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">{t('no_entries') || 'У вас пока нет записей в дневнике.'}</p>
                <p className="text-sm">{t('click_new_entry') || 'Нажмите кнопку ниже, чтобы добавить первую.'}</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-5 pb-4">
            {days.map(({ label, items }) => (
              <div key={label}>
                <div className="mb-3">
                  <div className="inline-block bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] rounded-full px-5 py-2">
                    <h3 className="text-xs font-semibold text-[color:var(--text-secondary-color)] uppercase tracking-wider">
                      {label}
                    </h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {items.map((entry) => (
                    <JournalEntryCard
                      key={entry._id}
                      entry={entry}
                      onOpen={() => setEditing(entry)}
                      onDelete={() => setEntryToDelete(entry)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModal && (
        <button
          type="button"
          aria-label={t('new_entry') || 'Новая запись'}
          onClick={() => setEditing(null)}
          className="absolute bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-[color:var(--primary-color)] shadow-lg flex items-center justify-center transition-transform duration-150 active:scale-95 text-white"
        >
          <Icon name="plus" className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );

  const dialogs = (
    <>
      {editing !== undefined && (
        <JournalEntryModal
          entry={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void fetchEntries();
          }}
        />
      )}
      <GenericConfirmDeleteModal
        isOpen={entryToDelete !== null}
        onClose={() => setEntryToDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={t('confirm_delete')}
        message={t('confirm_delete_entry') || 'Вы уверены, что хотите удалить эту запись?'}
      />
    </>
  );

  if (!isModal) {
    return (
      <div>
        {content}
        {dialogs}
      </div>
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-4 bg-[color:var(--card-bg-color)] rounded-2xl shadow-2xl z-50 flex flex-col p-4 transition-all duration-300 ${
          isAnimating ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
      {dialogs}
    </>
  );
};

export default JournalView;
