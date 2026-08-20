# ReadInstead — Learn More. Watch Less. ⚡

<p align="center">
  <img src="frontend/public/assets/logo.png" alt="ReadInstead Banner" width="180" />
</p>

<p align="center">
  <strong>Transform long YouTube courses, video lectures, and MP4 recordings into structured executive summaries, key takeaways, chapter timelines, active recall flashcards, and grounded Q&A.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#vercel-deployment">Deploy to Vercel</a> •
  <a href="#environment-variables">Environment Variables</a>
</p>

---

## ✨ Features

- **🚀 Token-Aware Hierarchical Pipeline**: Recursively summarizes dense transcripts of any length without token truncation or context loss.
- **⚡ Real-time SSE Progress Streaming**: Watch transcription, chunking, topic extraction, Q&A formulation, and RAG indexing progress live step-by-step.
- **💬 Grounded Video RAG Chat Assistant**: Chat directly with any processed video with verified timestamp citations that jump to exact moments in the playback.
- **🧠 Interactive Active Recall Quizzes**: Formats multiple-choice questions, true/false, fill-in-the-blanks, and short answers with immediate feedback and scoring.
- **📇 Smart Flashcards**: Digital flip-cards with spaced-repetition mastery status tracking (Learning, Mastered, New).
- **🌍 Multilingual Translation**: On-the-fly multi-language translation for international accessibility.
- **📝 Personal Study Notes Workspace**: Take custom Markdown notes alongside video playback and export comprehensive study guides in Markdown or JSON.
- **🔐 Supabase Authentication & Sync**: Seamless email auth, profile management, and database persistence.
- **🌓 Sleek Modern UI**: Premium dark/light themes with glassmorphic cards, dynamic charts, and responsive mobile drawers.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS, Framer Motion
- **Icons**: Lucide React
- **Charts**: Recharts (Study sessions & Duration trends)
- **Database / Auth Client**: `@supabase/supabase-js`

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **ASR (Speech-to-Text)**: Local `faster-whisper`
- **LLM Engine**: Groq Cloud (Llama 3.3 70B Versatile, Llama 3.1 8B Instant)
- **RAG & Key Rotation**: Key pool failover & semantic temporal search
- **Database**: Supabase PostgreSQL with `pgvector`

---

## 📐 Architecture

```mermaid
graph TD
    A[YouTube URL / MP4 File] --> B[FastAPI Backend]
    B --> C[yt-dlp Audio Extraction]
    C --> D[faster-whisper Acoustic Tokenization]
    D --> E[Token-Aware Smart Chunker ~3,500 tokens]
    E --> F[Groq LLM Key-Pool Rotation]
    F --> G[Hierarchical Synthesis & Grounded Q&A]
    G --> H[(Supabase Database & Vector Store)]
    H --> I[Vite React Frontend Workspace]
    I --> J[Summary, Video Player, Quiz & Flashcards, RAG Chat]
```

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/Tensai-Kartik/ReadInstead.git
cd ReadInstead
```

### 2. Configure Environment Variables
- Copy `frontend/.env.example` to `frontend/.env`
- Copy `backend/.env.example` to `backend/.env`
- Fill in your Supabase credentials and Groq API keys.

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Start Backend Server
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

---

## ☁️ Vercel Deployment

1. Import the repository into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `./` (the repository includes a pre-configured `vercel.json` and build scripts).
3. In **Project Settings ➔ Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
   - `VITE_BACKEND_URL`: Your hosted FastAPI Backend URL (or leave default for local testing)
4. Click **Deploy**.

---

## 🔑 Environment Variables Reference

### Frontend (`frontend/.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your_key
VITE_BACKEND_URL=http://localhost:8000
```

### Backend (`backend/.env`)
```env
GROQ_API_KEYS=gsk_key1,gsk_key2
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_key
SUPABASE_ANON_KEY=sb_publishable_your_key
DATABASE_URL=postgresql://postgres.your-project:password@aws-0-region.pooler.supabase.com:6543/postgres
```

---

## 📄 License

MIT License. Designed and engineered for high-performance learning.
