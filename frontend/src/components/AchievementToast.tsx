interface AchievementToastProps {
  name: string;
  isVisible: boolean;
}

const AchievementToast = ({ name, isVisible }: AchievementToastProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 right-4 bg-[color:var(--accent-gold)] text-black px-6 py-3 rounded-lg shadow-xl achievement-toast">
      <p><span className="font-bold">Достижение получено!</span> "{name}"</p>
    </div>
  );
};

export default AchievementToast;
