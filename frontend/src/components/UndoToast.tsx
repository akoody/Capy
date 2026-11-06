interface UndoToastProps {
  message: string;
  onUndo: () => void;
  isVisible: boolean;
}

const UndoToast = ({ message, onUndo, isVisible }: UndoToastProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl flex items-center justify-between">
      <p>{message}</p>
      <button onClick={onUndo} className="ml-4 font-bold text-[color:var(--accent-color)]">Отмена</button>
    </div>
  );
};

export default UndoToast;
