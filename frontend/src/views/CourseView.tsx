import { Course, Lesson } from '../types';
import { useAcademy } from '../context/AcademyContext';

interface CourseViewProps {
  course: Course;
  onLessonSelect: (lesson: Lesson) => void;
  onBack: () => void;
}

const CourseView = ({ course, onLessonSelect, onBack }: CourseViewProps) => {
  const { user } = useAcademy();
  const completedLessonIds = new Set(user?.completedLessons.map(l => l._id));

  return (
    <section id="course-section">
      <button onClick={onBack} className="text-[color:var(--accent-cyan)] mb-4">← Назад к курсам</button>
      <h2 className="text-2xl font-bold text-[color:var(--text-header)] mb-2">{course.title}</h2>
      <p className="text-[color:var(--text-secondary)] mb-6">{course.description}</p>
      <div className="space-y-3">
        {course.lessons.map((lesson, index) => {
          const isCompleted = completedLessonIds.has(lesson._id);
          return (
            <button 
              key={lesson._id} 
              onClick={() => onLessonSelect(lesson)}
              className="w-full text-left bg-white/5 p-4 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/10 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center">
                <span className={`text-2xl mr-4 ${isCompleted ? 'text-green-400' : 'text-[color:var(--accent-cyan)]'}`}>{index + 1}</span>
                <div>
                  <h3 className={`font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-[color:var(--text-main)]'}`}>{lesson.title}</h3>
                </div>
              </div>
              {isCompleted && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </section>
  );
};

export default CourseView;
