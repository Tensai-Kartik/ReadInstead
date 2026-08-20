# ReadInstead — Learn More. Watch Less. ⚡

<p align="center">
  <img src="frontend/public/assets/logo.png" alt="ReadInstead Banner" width="180" />
</p>

<p align="center">
  <strong>Transform long YouTube courses, video lectures, and MP4 recordings into structured executive summaries, key takeaways, chapter timelines, active recall flashcards, and grounded Q&A.</strong>
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

### 3. Start Development Servers

You can start both frontend & backend concurrently with a single command from the project root:
```bash
npm run dev
```

Or run them individually in separate terminals:
```bash
# Terminal 1: Frontend (http://localhost:5173)
npm run frontend

# Terminal 2: Backend (http://localhost:8000)
npm run backend
```


---

## ☁️ Live Production Deployment

### 1. Deploy the Backend (Render / Railway / Fly.io / Docker)
The FastAPI backend runs the Python processing pipeline, Whisper transcription, Groq LLM streaming, and Supabase vector queries.

#### Option A: Deploy on Render (Recommended & Free)
1. Push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New + ➔ Web Service** and select your repository.
3. Configure:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add the backend environment variables (`GROQ_API_KEYS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DATABASE_URL`).
5. Click **Create Web Service**. Copy your live backend URL (e.g. `https://readinstead-backend.onrender.com`).

#### Option B: Deploy with Docker / Railway
A pre-configured [`backend/Dockerfile`](file:///c:/Users/Kartik/Desktop/Project/ReadInstead/backend/Dockerfile) and [`backend/Procfile`](file:///c:/Users/Kartik/Desktop/Project/ReadInstead/backend/Procfile) are included for 1-click Docker and Railway deployments.

---

### 2. Deploy the Frontend (Vercel)
1. Import the repository into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `./` or `frontend/` (pre-configured `vercel.json` included).
3. In **Project Settings ➔ Environment Variables**, add:
   - `VITE_SUPABASE_URL`: `https://vrlkshomkjhxpnyqhrip.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `sb_publishable_bMQUJqORvjJV7YRcClohfg_x0hlr9Lt`
   - `VITE_BACKEND_URL`: Your live backend URL from Step 1 (e.g., `https://readinstead-backend.onrender.com`)
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
