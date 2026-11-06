import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../services/api';
import { Course, User } from '../types';
import { waitForTelegramInitData } from '../utils/waitForTelegramInitData';

interface AcademyContextType {
  courses: Course[];
  user: User | null;
  loading: boolean;
  error: string | null;
  fetchAcademyData: () => void;
  completeLesson: (lessonId: string) => Promise<void>;
}

const AcademyContext = createContext<AcademyContextType | undefined>(undefined);

export const AcademyProvider = ({ children, userId }: { children: ReactNode, userId: string | null }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAcademyData = useCallback(async () => {
    setLoading(true);
    try {
      const coursesResponse = await api.get('/academy/courses');
      setCourses(coursesResponse.data);

      if (userId) {
        try {
          const userResponse = await api.get(`/users/id/${userId}`);
          setUser(userResponse.data);
        } catch (error: any) {
          if (error.response && error.response.status === 404) {
            setUser(null);
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch academy data", error);
      setError('Failed to fetch data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const completeLesson = async (lessonId: string) => {
    if (!user) return;
    try {
      await api.post(`/academy/lessons/complete`, { userId: user._id, lessonId });
      await fetchAcademyData(); // Refetch data after completing a lesson
    } catch (error) {
      console.error("Failed to complete lesson", error);
      // Optionally, set an error state to show in the UI
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canAuth = await waitForTelegramInitData();
      if (cancelled) return;
      if (!canAuth) {
        setLoading(false);
        setCourses([]);
        setError(null);
        return;
      }
      await fetchAcademyData();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, fetchAcademyData]);

  return (
    <AcademyContext.Provider value={{ courses, user, loading, error, fetchAcademyData, completeLesson }}>
      {children}
    </AcademyContext.Provider>
  );
};

export const useAcademy = () => {
  const context = useContext(AcademyContext);
  if (context === undefined) {
    throw new Error('useAcademy must be used within an AcademyProvider');
  }
  return context;
};
