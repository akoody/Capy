interface IconPickerProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
}

export const goalIcons = ['✈️', '💻', '📱', '🚗', '🏠', '🎓', '🎁', '💼', '📈', '💡', '❤️', '🎉'];

const IconPicker = ({ selectedIcon, onSelect }: IconPickerProps) => {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-2">Иконка</label>
      <div className="flex flex-wrap gap-3">
        {goalIcons.map(icon => (
          <button
            key={icon}
            type="button"
            onClick={() => onSelect(icon)}
            className={`w-12 h-12 text-2xl rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-110 ${
              selectedIcon === icon ? 'bg-[color:var(--accent-color)] text-white scale-110 shadow-lg' : 'bg-black/20 hover:bg-black/30'
            }`}          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default IconPicker;
