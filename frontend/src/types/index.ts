export type ThemeMode = 'light' | 'dark';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  study_hours: number;
  daily_goal_minutes: number;
  daily_goal_progress_minutes: number;
  completed_sessions: number;
  avg_session_duration_minutes: number;
}

export type SummaryType = 
  | 'executive' 
  | 'tldr' 
  | 'detailed' 
  | 'takeaways' 
  | 'concepts' 
  | 'timeline';

export type QuestionType = 
  | 'MCQs' 
  | 'Short Answer' 
  | 'Long Answer' 
  | 'Fill in the Blanks' 
  | 'True False';

export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface ChapterTimestamp {
  time: string;
  seconds: number;
  title: string;
  description: string;
}

export interface Question {
  id: string;
  video_id: string;
  question_text: string;
  question_type: QuestionType;
  difficulty: QuestionDifficulty;
  options?: string[];
  correct_answer: string;
  explanation: string;
  user_answer?: string;
  start_seconds?: number;
  end_seconds?: number;
  timestamp?: string;
  chunk_id?: string;
}

export interface Flashcard {
  id: string;
  video_id: string;
  front: string;
  back: string;
  mastery_level?: 'new' | 'learning' | 'mastered';
  start_seconds?: number;
  end_seconds?: number;
  timestamp?: string;
  chunk_id?: string;
}

export interface SummaryContent {
  executive_summary: string;
  tldr: string;
  detailed_notes: string[];
  key_takeaways: string[];
  important_concepts: { term: string; definition: string }[];
  chapter_timeline: ChapterTimestamp[];
}

export interface ProcessedVideo {
  id: string;
  user_id?: string;
  title: string;
  youtube_url: string;
  embed_url?: string;
  duration: string;
  duration_seconds: number;
  channel: string;
  thumbnail_url: string;
  processed_at: string;
  summary: SummaryContent;
  original_summary?: SummaryContent;
  translations?: Partial<Record<LanguageCode, SummaryContent>>;
  questions: Question[];
  flashcards: Flashcard[];
  personal_note?: string;
  completion_percentage?: number;
}

export interface ProcessingStep {
  id: number;
  label: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

export type NavTab = 
  | 'dashboard' 
  | 'new_video' 
  | 'history' 
  | 'notes' 
  | 'settings';

export interface QuizAttempt {
  id?: string;
  video_id: string;
  user_id?: string;
  score: number;
  total_questions: number;
  accuracy: number;
  difficulty: string;
  answers_json: {
    question_id: string;
    question_text: string;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
  }[];
  created_at?: string;
}

export interface RAGSource {
  time?: string;
  timestamp?: string;
  seconds?: number;
  start_seconds?: number;
  end_seconds?: number;
  snippet: string;
  retrieval_method?: string;
}

export interface RAGChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  sources?: RAGSource[];
  timestamp: string;
}

export type ExportFormat = 'pdf' | 'markdown' | 'txt';

export interface ExportOptions {
  includeSummary: boolean;
  includeTakeaways: boolean;
  includeQuestions: boolean;
  includeFlashcards: boolean;
  includeNotes: boolean;
}

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'hi' | 'ja';
