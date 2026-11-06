import { useState, useEffect } from 'react';
import { Goal } from '../types';
import api from '../services/api';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  onSuccess: () => void;
}

const NotesModal = ({ isOpen, onClose, goal, onSuccess }: NotesModalProps) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (goal) {
      setNotes(goal.notes || '');
    }
  }, [goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal) return;

    setLoading(true);
    setError('');

    try {
      await api.patch(`/goals/${goal._id}/notes`, { notes });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update notes', err);
      setError('Failed to update notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNotes('');
    setError('');
    onClose();
  };

  if (!isOpen || !goal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50" onClick={handleClose}>
      <div className="bg-[color:var(--card-bg-color)] rounded-2xl p-6 w-full max-w-md border border-[color:var(--card-border-color)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-4">
          <div className="text-2xl mr-3">{goal.icon || '🎯'}</div>
          <div>
            <h3 className="text-xl font-bold text-white">Заметки к цели</h3>
            <p className="text-sm text-[color:var(--text-secondary-color)]">{goal.name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="notes" className="block text-sm font-medium text-[color:var(--text-secondary-color)] mb-2">
              Ваши заметки
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Добавьте заметки к вашей цели..."
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] resize-none"
              rows={6}
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-black/20 text-gray-300 rounded-lg hover:bg-black/30 transition-colors"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[color:var(--primary-color)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default NotesModal;
