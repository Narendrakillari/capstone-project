export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizResponse {
  topic: string;
  questions: QuizQuestion[];
}

export interface RecommendedLesson {
  topic: string;
  subject: string;
  grade: string;
  duration: string;
  videoUrl?: string;
  keyPoints?: string[];
  quizQuestion?: string;
  quizOptions?: string[];
  correctAnswerIndex?: number;
}

export interface WorkspaceResponse {
  topic: string;
  subject: string;
  grade: string;
  videoUrl: string;
  keyPoints: string[];
  quizQuestion: string | null;
  quizOptions: string[];
  correctAnswerIndex: number;
  relatedTopics: string[];
  videoSummary: string;
  recommendedLessons: RecommendedLesson[];
  streakDays: number;
  levelXP: number;
}

export interface BookmarkItem {
  id: number;
  type: 'video' | 'keypoint' | 'mindmap' | 'question';
  title: string;
  topic: string;
  category: string;
  contentSnippet: string;
}

export interface DetailedUserStats {
  total_quizzes: number;
  average_score: number;
  total_xp: number;
  topics_explored: number;
  subject_breakdown: { [key: string]: number };
}

export interface HistoryItem {
  title: string;
  score: number;
  date: string;
}
