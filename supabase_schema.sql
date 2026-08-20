-- ReadInstead AI SaaS Normalized Idempotent Database Schema
-- Safe to re-run multiple times in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. PROFILES TABLE (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to auto-confirm email for new user accounts on Supabase
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = NEW.id AND email_confirmed_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();

-- 2. VIDEOS TABLE (Normalized unique video entity with status locking & hash caching)
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id TEXT UNIQUE,
  file_hash TEXT UNIQUE,
  title TEXT NOT NULL,
  youtube_url TEXT,
  duration TEXT DEFAULT '00:00',
  duration_seconds INT DEFAULT 0,
  channel TEXT DEFAULT 'Educational Content',
  thumbnail_url TEXT,
  processing_status TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  pipeline_version TEXT DEFAULT 'v2_hierarchical',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by YouTube ID and SHA-256 File Hash
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON public.videos(youtube_id);
CREATE INDEX IF NOT EXISTS idx_videos_file_hash ON public.videos(file_hash);

-- 3. TRANSCRIPTS TABLE
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID UNIQUE NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  clean_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUMMARIES TABLE
CREATE TABLE IF NOT EXISTS public.summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID UNIQUE NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  executive_summary TEXT NOT NULL,
  tldr TEXT NOT NULL,
  detailed_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  important_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  chapter_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. QUESTIONS TABLE (Adaptive Q&A)
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('MCQs', 'Short Answer', 'Long Answer', 'Fill in the Blanks', 'True False')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_video_id ON public.questions(video_id);

-- 6. FLASHCARDS TABLE
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  mastery_level TEXT CHECK (mastery_level IN ('new', 'learning', 'mastered')) DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_video_id ON public.flashcards(video_id);

-- 7. NOTES TABLE (User-specific video notes)
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_video_note UNIQUE (video_id, user_id)
);

-- 8. HISTORY TABLE (User -> Video mapping)
CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  last_opened_at TIMESTAMPTZ DEFAULT NOW(),
  completion_percentage INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_video_history UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_history_user_id ON public.history(user_id);

-- Row Level Security (RLS) Enablement
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policy Helper Blocks
DO $$ 
BEGIN
  -- Videos Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public videos are viewable by everyone' AND tablename = 'videos') THEN
    CREATE POLICY "Public videos are viewable by everyone" ON public.videos FOR SELECT USING (true);
  END IF;

  -- Transcripts Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public transcripts are viewable by everyone' AND tablename = 'transcripts') THEN
    CREATE POLICY "Public transcripts are viewable by everyone" ON public.transcripts FOR SELECT USING (true);
  END IF;

  -- Summaries Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public summaries are viewable by everyone' AND tablename = 'summaries') THEN
    CREATE POLICY "Public summaries are viewable by everyone" ON public.summaries FOR SELECT USING (true);
  END IF;

  -- Questions Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public questions are viewable by everyone' AND tablename = 'questions') THEN
    CREATE POLICY "Public questions are viewable by everyone" ON public.questions FOR SELECT USING (true);
  END IF;

  -- Flashcards Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public flashcards are viewable by everyone' AND tablename = 'flashcards') THEN
    CREATE POLICY "Public flashcards are viewable by everyone" ON public.flashcards FOR SELECT USING (true);
  END IF;

  -- Notes Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own notes' AND tablename = 'notes') THEN
    CREATE POLICY "Users can manage their own notes" ON public.notes FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- History Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own history' AND tablename = 'history') THEN
    CREATE POLICY "Users can manage their own history" ON public.history FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- Profiles Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can manage their own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
  END IF;
END $$;

-- 9. QUIZ ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  accuracy NUMERIC(5,2) NOT NULL,
  difficulty TEXT DEFAULT 'All',
  answers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_video ON public.quiz_attempts(user_id, video_id);

-- 10. TRANSCRIPT CHUNKS TABLE (RAG Store)
CREATE TABLE IF NOT EXISTS public.transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  start_seconds INT DEFAULT 0,
  end_seconds INT DEFAULT 0,
  start_time TEXT DEFAULT '00:00',
  content TEXT NOT NULL,
  keywords JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_video_chunk UNIQUE (video_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_video_id ON public.transcript_chunks(video_id);

-- 11. TRANSLATIONS TABLE (Cached Translations)
CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL,
  translated_summary JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_video_language UNIQUE (video_id, target_language)
);

-- 12. CHAT MESSAGES TABLE (AI Assistant Chat History)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  sender TEXT CHECK (sender IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_video_id ON public.chat_messages(video_id);

-- Row Level Security for New Tables
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public transcript_chunks are viewable by everyone' AND tablename = 'transcript_chunks') THEN
    CREATE POLICY "Public transcript_chunks are viewable by everyone" ON public.transcript_chunks FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public translations are viewable by everyone' AND tablename = 'translations') THEN
    CREATE POLICY "Public translations are viewable by everyone" ON public.translations FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own quiz_attempts' AND tablename = 'quiz_attempts') THEN
    CREATE POLICY "Users can manage their own quiz_attempts" ON public.quiz_attempts FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own chat_messages' AND tablename = 'chat_messages') THEN
    CREATE POLICY "Users can manage their own chat_messages" ON public.chat_messages FOR ALL USING (true);
  END IF;
END $$;

-- 13. VIDEO CHUNKS TABLE (Token-Aware Hierarchical Knowledge & Temporal RAG Store)
CREATE TABLE IF NOT EXISTS public.video_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  sequence_number INT NOT NULL,
  start_seconds INT DEFAULT 0,
  end_seconds INT DEFAULT 0,
  start_time TEXT DEFAULT '00:00',
  end_time TEXT DEFAULT '00:00',
  transcript TEXT NOT NULL,
  chunk_summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  important_concepts JSONB DEFAULT '[]'::jsonb,
  examples JSONB DEFAULT '[]'::jsonb,
  processing_status TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_video_chunk_sequence UNIQUE (video_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_video_chunks_video_id ON public.video_chunks(video_id);
CREATE INDEX IF NOT EXISTS idx_video_chunks_seq ON public.video_chunks(video_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_video_chunks_time ON public.video_chunks(video_id, start_seconds, end_seconds);

ALTER TABLE public.video_chunks ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public video_chunks are viewable by everyone' AND tablename = 'video_chunks') THEN
    CREATE POLICY "Public video_chunks are viewable by everyone" ON public.video_chunks FOR SELECT USING (true);
  END IF;
END $$;

-- Safe column migrations for existing tables
DO $$
BEGIN
  -- Add pipeline_version to videos if not present
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='videos' AND column_name='pipeline_version') THEN
    ALTER TABLE public.videos ADD COLUMN pipeline_version TEXT DEFAULT 'v2_hierarchical';
  END IF;

  -- Add temporal fields to questions if not present
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='start_seconds') THEN
    ALTER TABLE public.questions ADD COLUMN start_seconds INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='end_seconds') THEN
    ALTER TABLE public.questions ADD COLUMN end_seconds INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='timestamp') THEN
    ALTER TABLE public.questions ADD COLUMN timestamp TEXT DEFAULT '00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='chunk_id') THEN
    ALTER TABLE public.questions ADD COLUMN chunk_id TEXT;
  END IF;

  -- Add temporal fields to flashcards if not present
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flashcards' AND column_name='start_seconds') THEN
    ALTER TABLE public.flashcards ADD COLUMN start_seconds INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flashcards' AND column_name='end_seconds') THEN
    ALTER TABLE public.flashcards ADD COLUMN end_seconds INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flashcards' AND column_name='timestamp') THEN
    ALTER TABLE public.flashcards ADD COLUMN timestamp TEXT DEFAULT '00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flashcards' AND column_name='chunk_id') THEN
    ALTER TABLE public.flashcards ADD COLUMN chunk_id TEXT;
  END IF;
END $$;


