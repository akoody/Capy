import { useState } from 'react';
import { Lesson } from '../types';
import { useAcademy } from '../context/AcademyContext';

interface LessonViewProps {
  lesson: Lesson;
  onBack: () => void;
}

// Simple markdown to HTML for newlines
const renderContent = (content: string) => {
  return content.split('\n').map((line, index) => (
    <p key={index} className="mb-4">{line}</p>
  ));
};

const LessonView = ({ lesson, onBack }: LessonViewProps) => {
  const { user, completeLesson } = useAcademy();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);

  const handleComplete = async () => {
    await completeLesson(lesson._id);
  };

  const handleQuizSubmit = () => {
    setShowResult(true);
    if (lesson.quiz && selectedAnswer === lesson.quiz.correctAnswer) {
      setQuizCorrect(true);
    }
  };

  const isCompleted = user?.completedLessons.some(l => l._id === lesson._id);

  return (
    <section id="lesson-section">
      <button onClick={onBack} className="text-[color:var(--primary-color)] mb-4">← Назад к урокам</button>
      <h2 className="text-2xl font-bold text-white mb-6">{lesson.title}</h2>
      <div className="prose prose-invert text-white">
        {renderContent(lesson.content)}
      </div>

      {lesson.quiz && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-white mb-4">Тест</h3>
          <p className="mb-4 text-white">{lesson.quiz.question}</p>
          <div className="space-y-2">
            {lesson.quiz.options.map((option, index) => (
              <button 
                key={index}
                onClick={() => setSelectedAnswer(index)}
                className={`w-full text-left p-4 rounded-lg border ${selectedAnswer === index ? 'border-[color:var(--primary-color)] bg-[color:var(--primary-color)]/10' : 'border-[color:var(--card-border-color)] bg-[color:var(--card-bg-color)]'}`}
                disabled={showResult}
              >
                {option}
              </button>
            ))}
          </div>
          {!showResult && (
            <button onClick={handleQuizSubmit} className="mt-4 w-full bg-[color:var(--primary-color)] text-white p-3 rounded-lg font-bold hover:opacity-90 transition-opacity">Проверить</button>
          )}
          {showResult && (
            <div className={`mt-4 p-4 rounded-lg ${quizCorrect ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {quizCorrect ? (
                <p>Правильно!</p>
              ) : (
                <p>Неправильно. Попробуйте еще раз.</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        {isCompleted ? (
          <p className="text-center text-green-500">✓ Урок пройден</p>
        ) : (
          <button 
            onClick={handleComplete}
            className="w-full bg-[color:var(--primary-color)] text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            disabled={lesson.quiz && !quizCorrect}
          >
            Отметить как пройденный
          </button>
        )}
      </div>
    </section>
  );
};

export default LessonView;
