export interface RecurringTransaction {
  amount: number;
  frequency: string;
  startDate: string;
}

export interface Goal {
  _id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  createdAt: string;
  icon?: string;
  isCompleted?: boolean;
  notes?: string;
  recurringTransaction?: RecurringTransaction;
}

export interface Achievement {
  _id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
}

export interface User {
  _id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  photoUrl?: string;
  achievements: Achievement[];
  completedLessons: Lesson[];
  completedCourses: string[]; // Array of Course IDs
  points: number;
  badges: string[];
  friends: User[];
  goals: Goal[];
  currency?: string;
  language?: string;
}

export interface Lesson {
  _id: string;
  title: string;
  content: string;
  quiz?: {
    question: string;
    options: string[];
    correctAnswer: number;
  };
}

export type Category = 'Новичок' | 'Средний' | 'Продвинутый';


export interface Course {
  _id: string;
  title: string;
  description: string;
  category: Category;
  lessons: Lesson[];
}

export interface Budget {
  _id: string;
  name: string;
  amount: number;
  category: string;
  period: 'weekly' | 'monthly';
}

export interface PiggyBank {
  _id: string;
  amount: number;
}

export interface Transaction {
  _id: string;
  amount: number;
  type: 'deposit' | 'withdraw' | 'income' | 'expense';
  category: string;
  date: string;
  description?: string;
  goal?: Goal;
  createdAt?: string;
  /** Как операция изменила кошелёк. */
  walletEffect?: 'debit' | 'credit';
}

export interface TransactionCategory {
  _id: string;
  name: string;
  kind: 'expense' | 'income' | 'both';
  description?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface JournalEntry {
  _id: string;
  content: string;
  title?: string;
  tags?: string[];
  date: string;
  createdAt: string;
  user: string;
}

export interface TaskReminderSlot {
  fireAt: string;
  sentAt?: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'open' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  dueAt?: string;
  reminders: TaskReminderSlot[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}