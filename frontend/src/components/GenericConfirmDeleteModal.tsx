import { useTranslation } from 'react-i18next';

interface GenericConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const GenericConfirmDeleteModal = ({ isOpen, onClose, onConfirm, title, message }: GenericConfirmDeleteModalProps) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50" onClick={onClose}>
      <div className="bg-white/10 rounded-2xl p-6 w-full max-w-sm border border-red-500/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-2 text-red-400">{title}</h3>
        <p className="text-[color:var(--text-secondary)] mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-black/20 text-gray-300 rounded-lg hover:bg-black/30 transition-colors">{t('cancel')}</button>
          <button onClick={onConfirm} type="button" className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20">{t('delete')}</button>
        </div>
      </div>
    </div>
  );
};

export default GenericConfirmDeleteModal;
