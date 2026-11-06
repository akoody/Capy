import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { JournalEntry } from '../types';
import { useTranslation } from 'react-i18next';
import GenericConfirmDeleteModal from '../components/GenericConfirmDeleteModal';

interface JournalViewProps {
  isModal?: boolean;
  onClose?: () => void;
  initialEntries?: JournalEntry[];
  initialLoading?: boolean;
  onEntriesUpdate?: (entries: JournalEntry[]) => void;
}

const JournalView = ({ isModal = false, onClose, initialEntries = [], initialLoading = false, onEntriesUpdate }: JournalViewProps) => {
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'recent'>('date');
  const { t, i18n } = useTranslation();
  const [isAnimating, setIsAnimating] = useState(isModal);

  useEffect(() => {
    if (isModal) {
      const timer = setTimeout(() => setIsAnimating(false), 50);
      return () => clearTimeout(timer);
    }
  }, [isModal]);

  const fetchEntries = async () => {
    try {
      const response = await api.get('/journal');
      setEntries(response.data);
      onEntriesUpdate?.(response.data);
    } catch (error) {
      console.error('Failed to fetch journal entries', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialEntries.length > 0) {
      setEntries(initialEntries);
      setLoading(false);
    } else if (!initialLoading) {
      setLoading(true);
      fetchEntries();
    }
  }, []);

  const openModal = (entry?: JournalEntry) => {
    if (entry) {
      setEditingEntry(entry);
    } else {
      setEditingEntry(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const openDeleteModal = (entry: JournalEntry) => {
    setEntryToDelete(entry);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setEntryToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const confirmDelete = async () => {
    if (entryToDelete) {
      try {
        await api.delete(`/journal/${entryToDelete._id}`);
        const updatedEntries = entries.filter(e => e._id !== entryToDelete._id);
        setEntries(updatedEntries);
        onEntriesUpdate?.(updatedEntries);
        closeDeleteModal();
      } catch (error) {
        console.error('Failed to delete entry', error);
      }
    }
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(entry => {
      entry.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [entries]);

  const filteredAndSortedEntries = useMemo(() => {
    let filtered = entries;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.content.toLowerCase().includes(query) ||
        entry.title?.toLowerCase().includes(query) ||
        entry.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (filterTag) {
      filtered = filtered.filter(entry => 
        entry.tags?.includes(filterTag)
      );
    }

    if (sortBy === 'recent') {
      filtered = [...filtered].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date).getTime();
        const timeB = new Date(b.createdAt || b.date).getTime();
        return timeB - timeA;
      });
    }

    return filtered;
  }, [entries, searchQuery, filterTag, sortBy]);

  const groupedEntries = useMemo(() => {
    const grouped = filteredAndSortedEntries.reduce((acc, entry) => {
      const date = new Date(entry.date || entry.createdAt).toLocaleDateString(
        i18n.language === 'ru' ? 'ru-RU' : 'en-US',
        { day: 'numeric', month: 'long', year: 'numeric' }
      );
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(entry);
      return acc;
    }, {} as Record<string, JournalEntry[]>);

    // Sort entries within each date group
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const timeA = new Date(a.date || a.createdAt).getTime();
        const timeB = new Date(b.date || b.createdAt).getTime();
        return timeB - timeA;
      });
    });

    // Sort date keys
    const sortedDateKeys = Object.keys(grouped).sort((dateA, dateB) => {
      const firstEntryA = grouped[dateA][0];
      const firstEntryB = grouped[dateB][0];
      const timeA = new Date(firstEntryA.date || firstEntryA.createdAt).getTime();
      const timeB = new Date(firstEntryB.date || firstEntryB.createdAt).getTime();
      return timeB - timeA;
    });

    const sortedGrouped: Record<string, JournalEntry[]> = {};
    sortedDateKeys.forEach(date => {
      sortedGrouped[date] = grouped[date];
    });

    return sortedGrouped;
  }, [filteredAndSortedEntries, i18n.language]);

  const stats = useMemo(() => {
    const totalEntries = entries.length;
    const thisMonth = new Date().getMonth();
    const thisMonthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date || entry.createdAt);
      return entryDate.getMonth() === thisMonth;
    }).length;

    return {
      totalEntries,
      thisMonthEntries,
    };
  }, [entries]);

  if (loading && entries.length === 0) {
    return (
      <div className={`${isModal ? 'fixed inset-0 z-50' : ''}`}>
        {isModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={onClose}
          />
        )}
        <div className={`${isModal ? 'fixed inset-4 bg-[color:var(--card-bg-color)] rounded-2xl shadow-2xl flex items-center justify-center' : 'p-4'}`}>
          <div className="text-white">{t('loading')}</div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex justify-between items-start mb-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white mb-1">{t('journal') || 'Дневник'}</h1>
          {stats.totalEntries > 0 && (
            <p className="text-sm text-[color:var(--text-secondary-color)]">
              {stats.totalEntries} {stats.totalEntries === 1 ? 'запись' : stats.totalEntries < 5 ? 'записи' : 'записей'}
            </p>
          )}
        </div>
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="text-[color:var(--text-secondary-color)] hover:text-white transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex-shrink-0 space-y-3 mb-4 overflow-x-hidden">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-4 py-2.5 pl-10 pr-8 border border-[color:var(--card-border-color)] focus:border-[color:var(--primary-color)] focus:outline-none transition-colors"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-[color:var(--text-secondary-color)] absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] p-1 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setSortBy(sortBy === 'date' ? 'recent' : 'date')}
            className="px-3 py-1.5 bg-[color:var(--card-bg-color)] text-[color:var(--text-secondary-color)] rounded-lg text-sm hover:text-white transition-colors flex items-center gap-2 border border-[color:var(--card-border-color)] shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            {sortBy === 'date' ? 'По дате' : 'Недавние'}
          </button>
          {filterTag && (
            <button
              onClick={() => setFilterTag(null)}
              className="px-3 py-1.5 bg-[color:var(--card-bg-color)] text-white rounded-lg text-sm hover:opacity-80 transition-opacity flex items-center gap-2 border border-[color:var(--card-border-color)] shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {filterTag}
            </button>
          )}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterTag === tag
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

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {filteredAndSortedEntries.length === 0 ? (
          <div className="text-center text-gray-400 mt-10 py-12">
            {searchQuery || filterTag ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>{t('no_results') || 'Ничего не найдено'}</p>
                <button
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg mb-2">{t('no_entries') || 'У вас пока нет записей в дневнике.'}</p>
                <p className="text-sm">{t('click_new_entry') || 'Нажмите кнопку ниже, чтобы добавить первую.'}</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-5 pb-4">
            {Object.keys(groupedEntries).map(date => (
              <div key={date}>
                <div className="mb-3">
                  <div className="inline-block bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] rounded-full px-5 py-2">
                    <h3 className="text-xs font-semibold text-[color:var(--text-secondary-color)] uppercase tracking-wider">
                      {date}
                    </h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {groupedEntries[date].map((entry: JournalEntry) => (
                    <div
                      key={entry._id}
                      className="bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] rounded-lg p-3 cursor-pointer hover:border-[color:var(--primary-color)]/50 transition-colors"
                      onClick={() => openModal(entry)}
                    >
                      {entry.title && (
                        <h4 className="font-semibold text-[color:var(--text-color)] text-sm mb-1.5 leading-tight">
                          {entry.title}
                        </h4>
                      )}
                      <p className="text-[color:var(--text-secondary-color)] text-xs leading-relaxed whitespace-pre-wrap break-words line-clamp-3 mb-2">
                        {entry.content.length > 200
                          ? `${entry.content.substring(0, 200)}...`
                          : entry.content}
                      </p>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mb-2">
                          {entry.tags.map(tag => (
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
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>
                            {new Date(entry.date || entry.createdAt).toLocaleTimeString(
                              i18n.language === 'ru' ? 'ru-RU' : 'en-US',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(entry);
                          }}
                          className="text-[color:var(--text-secondary-color)] hover:text-red-400 transition-colors p-1"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {isModal && (
        <button
          onClick={() => openModal()}
          className="absolute bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-[color:var(--primary-color)] shadow-lg flex items-center justify-center transition-transform duration-150 active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );

  if (isModal) {
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
        {isModalOpen && (
          <JournalEntryModal
            isOpen={isModalOpen}
            onClose={closeModal}
            entry={editingEntry}
            onSuccess={() => {
              closeModal();
              fetchEntries();
            }}
            onEntriesChange={(updatedEntries) => {
              setEntries(updatedEntries);
              onEntriesUpdate?.(updatedEntries);
            }}
          />
        )}
        <GenericConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onConfirm={confirmDelete}
          title={t('confirm_delete')}
          message={t('confirm_delete_entry') || 'Вы уверены, что хотите удалить эту запись?'}
        />
      </>
    );
  }

  return (
    <div>
      {content}
      {isModalOpen && (
        <JournalEntryModal
          isOpen={isModalOpen}
          onClose={closeModal}
          entry={editingEntry}
          onSuccess={() => {
            closeModal();
            fetchEntries();
          }}
          onEntriesChange={(updatedEntries) => {
            setEntries(updatedEntries);
            onEntriesUpdate?.(updatedEntries);
          }}
        />
      )}
      <GenericConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={t('confirm_delete')}
        message={t('confirm_delete_entry') || 'Вы уверены, что хотите удалить эту запись?'}
      />
    </div>
  );
};

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: JournalEntry | null;
  onSuccess: () => void;
  onEntriesChange?: (entries: JournalEntry[]) => void;
}

const JournalEntryModal = ({ isOpen, onClose, entry, onSuccess, onEntriesChange }: JournalEntryModalProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (entry) {
      setTitle(entry.title || '');
      setContent(entry.content || '');
      setTags(entry.tags || []);
    } else {
      setTitle('');
      setContent('');
      setTags([]);
    }
    setTagInput('');
  }, [entry, isOpen]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!content.trim()) return;

    setSaving(true);
    try {
      if (entry) {
        // Update existing entry
        await api.patch(`/journal/${entry._id}`, {
          title: title.trim() || undefined,
          content: content.trim(),
          tags: tags.length > 0 ? tags : undefined,
        });
        if (onEntriesChange) {
          const allEntries = await api.get('/journal');
          onEntriesChange(allEntries.data);
        }
      } else {
        // Create new entry
        await api.post('/journal', {
          title: title.trim() || undefined,
          content: content.trim(),
          tags: tags.length > 0 ? tags : undefined,
          date: new Date().toISOString(),
        });
        if (onEntriesChange) {
          const allEntries = await api.get('/journal');
          onEntriesChange(allEntries.data);
        }
      }
      onSuccess();
    } catch (error: any) {
      console.error('Failed to save entry', error);
      const errorMessage = 
        error.response?.data?.message || 
        error.message || 
        t('save_error') || 
        'Не удалось сохранить запись';
      console.error('Error details:', error.response?.data);
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--card-bg-color)] rounded-2xl p-6 w-full max-w-md border border-[color:var(--card-border-color)] shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[color:var(--text-color)]">
            {entry ? t('edit_entry') || 'Редактировать запись' : t('new_entry') || 'Новая запись'}
          </h2>
          <button onClick={onClose} className="text-[color:var(--text-secondary-color)] hover:text-[color:var(--text-color)] transition-colors p-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-2">
              {t('title') || 'Заголовок'} (необязательно)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('title_placeholder') || 'Заголовок записи...'}
              className="w-full bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-4 py-2 border border-[color:var(--card-border-color)] focus:border-[color:var(--primary-color)] focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-2">
              {t('content') || 'Содержание'} *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('content_placeholder') || 'Напишите ваши мысли...'}
              className="w-full bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-4 py-3 border border-[color:var(--card-border-color)] focus:border-[color:var(--primary-color)] focus:outline-none resize-none"
              rows={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-2">
              Теги (необязательно)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Добавить тег..."
                className="flex-1 max-w-[200px] bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-3 py-2 border border-[color:var(--card-border-color)] focus:border-[color:var(--primary-color)] focus:outline-none transition-colors text-sm"
              />
              <button
                onClick={handleAddTag}
                className="w-10 h-10 bg-[color:var(--primary-color)] text-white rounded-lg hover:opacity-80 transition-opacity flex items-center justify-center shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-[color:var(--card-bg-color)] text-[color:var(--text-secondary-color)] rounded-lg text-sm border border-[color:var(--card-border-color)]"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-white transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 bg-[color:var(--card-bg-color)] text-[color:var(--text-color)] rounded-lg px-4 py-2 hover:opacity-80 transition-opacity font-medium border border-[color:var(--card-border-color)]"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim() || saving}
            className="flex-1 bg-[color:var(--primary-color)] text-white rounded-lg px-4 py-2 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity font-medium"
          >
            {saving ? t('saving') || 'Сохранение...' : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JournalView;
