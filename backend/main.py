import os
import re
import tempfile
import logging
import asyncio
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from services.whisper_service import LocalWhisperService
from services.groq_service import GroqOpenAIService, GroqKeyPoolManager
from services.cache_service import SmartCacheService
from services.supabase_db import SupabaseDatabaseService
from services.rag_service import RAGService
from services.translation_service import TranslationService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ReadInstead.MainAPI")

app = FastAPI(
    title="ReadInstead AI SaaS Production Backend",
    description="FastAPI service with local faster-whisper, RAG Video Chat, Round-Robin Groq Key Pool, Multilingual support, and Supabase database persistence.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

whisper_service = LocalWhisperService(model_size="base")
db_service = SupabaseDatabaseService()
groq_key_manager = GroqKeyPoolManager()

class ProcessUrlRequest(BaseModel):
    url: str = Field(..., description="YouTube URL or valid HTTP video link")
    user_id: Optional[str] = Field(None, description="User ID associated with history")
    groq_api_key: Optional[str] = Field(None, description="Optional custom Groq API key override")
    force_refresh: Optional[bool] = Field(False, description="Force re-processing of video ignoring cache")

def is_incomplete_payload(payload: Dict[str, Any]) -> bool:
    if not payload or not isinstance(payload, dict):
        return True
    
    video = payload.get("video") or {}
    title = video.get("title", "")
    if "Educational Video (" in title or title == "Educational Video":
        return True

    # Invalidate legacy single-shot pipeline cache if not v2_hierarchical
    if video.get("pipeline_version") != "v2_hierarchical":
        logger.info(f"[CACHE VERSION CHECK] Video ID '{video.get('id')}' has legacy version '{video.get('pipeline_version')}'. Re-processing with v2_hierarchical.")
        return True

    summary = payload.get("summary") or {}
    exec_summary = summary.get("executive_summary", "")
    tldr = summary.get("tldr", "")
    
    generic_markers = [
        "aiming to inform and educate",
        "without specific details",
        "imparting knowledge and understanding",
        "comprehensive educational study transcript",
        "transcript is empty",
        "transcript content is missing",
        "impossible to provide",
        "no content is available",
        "educational resource"
    ]
    combined_text = f"{exec_summary} {tldr}".lower()
    for marker in generic_markers:
        if marker in combined_text:
            return True

    questions = payload.get("questions") or []
    flashcards = payload.get("flashcards") or []

    if len(questions) < 2 or len(flashcards) < 2:
        return True

    return False

class QuizAttemptRequest(BaseModel):
    video_id: str
    user_id: Optional[str] = None
    score: int
    total_questions: int
    accuracy: float
    difficulty: Optional[str] = "All"
    answers_json: List[Dict[str, Any]] = []

class RAGChatRequest(BaseModel):
    video_id: str
    query: str
    video_title: Optional[str] = "Educational Video"
    user_id: Optional[str] = None
    context_hint: Optional[str] = None

class TranslationRequest(BaseModel):
    video_id: str
    target_language: str = "es"
    summary_data: Dict[str, Any]

class SaveNoteRequest(BaseModel):
    video_id: str
    content: str
    user_id: Optional[str] = None

@app.get("/", status_code=status.HTTP_200_OK)
def root_endpoint():
    return {
        "status": "healthy",
        "service": "ReadInstead AI SaaS API",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    return {
        "status": "healthy",
        "service": "ReadInstead Backend",
        "engine": "faster-whisper + Groq OpenAI RAG",
        "active_keys_count": len(groq_key_manager.keys),
        "database": "Supabase Production PostgreSQL (ReadInstead)",
        "caching": "Active (YouTube ID + SHA-256 + Translations)"
    }

@app.post("/api/process-url-stream")
async def process_url_stream_endpoint(req: ProcessUrlRequest):
    async def event_generator():
        clean_url = req.url.strip() if req.url else ""
        if not clean_url:
            yield f"data: {json.dumps({'type': 'error', 'step_id': 1, 'message': 'URL field is required.'})}\n\n"
            return

        youtube_id = SmartCacheService.extract_youtube_id(clean_url)
        logger.info(f"[STREAM PIPELINE] Starting URL stream for '{clean_url}' (YouTube ID: {youtube_id})")

        try:
            # STEP 1: Downloading Video / Metadata & Cache Check
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 1, 'status': 'in_progress', 'progress': 5, 'message': 'Checking cache and fetching video metadata...'})}\n\n"
            
            if youtube_id and not req.force_refresh:
                existing_video = await db_service.get_video_by_youtube_id(youtube_id)
                if existing_video and existing_video.get("processing_status") == "completed":
                    payload = await db_service.fetch_complete_video_payload(existing_video["id"])
                    if payload and not is_incomplete_payload(payload):
                        logger.info(f"[STREAM CACHE HIT] Reusing verified cached payload for '{youtube_id}'")
                        if req.user_id:
                            await db_service.create_history_record(req.user_id, existing_video["id"])
                        
                        for s_id in range(1, 9):
                            yield f"data: {json.dumps({'type': 'progress', 'step_id': s_id, 'status': 'completed', 'progress': int((s_id / 8) * 100), 'message': 'Loaded from verified cache'})}\n\n"
                            await asyncio.sleep(0.03)

                        yield f"data: {json.dumps({'type': 'complete', 'progress': 100, 'data': payload})}\n\n"
                        return
                    else:
                        logger.info(f"[STREAM CACHE INVALIDATED] Stale payload detected for '{youtube_id}'. Re-processing...")
                        await db_service.delete_video_by_youtube_id(youtube_id)

            meta = await whisper_service.fetch_youtube_metadata(youtube_id) if youtube_id else {
                "title": f"Educational Video ({clean_url})",
                "channel": "Web Video Source",
                "thumbnail_url": "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=800&auto=format&fit=crop",
                "duration": "25:00"
            }
            video_title = meta.get("title", "Educational Video")
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 1, 'status': 'completed', 'progress': 15, 'message': f'Metadata retrieved: {video_title[:40]}...'})}\n\n"

            # STEP 2: Extracting Audio
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 2, 'status': 'in_progress', 'progress': 20, 'message': 'Connecting to audio stream and caption tracks...'})}\n\n"
            await asyncio.sleep(0.15)
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 2, 'status': 'completed', 'progress': 30, 'message': 'Audio stream resolved'})}\n\n"

            # STEP 3: Generating Transcript
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 3, 'status': 'in_progress', 'progress': 35, 'message': 'Extracting speech tokens & transcript...'})}\n\n"
            
            transcript = None
            if youtube_id:
                transcript = await whisper_service.fetch_youtube_transcript(youtube_id)
            else:
                transcript = f"Transcript content for video URL: {clean_url}"

            if not transcript or not whisper_service.validate_transcript(transcript):
                yield f"data: {json.dumps({'type': 'error', 'step_id': 3, 'message': 'Unable to obtain a transcript for this video.'})}\n\n"
                return

            word_count = len(transcript.split())
            duration_sec = meta.get("duration_seconds", 1500)
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 3, 'status': 'completed', 'progress': 45, 'message': f'Transcript verified ({word_count} words)'})}\n\n"

            # STEP 4: Token-Aware Smart Chunking
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 4, 'status': 'in_progress', 'progress': 50, 'message': 'Splitting into token-aware semantic windows (~3,500 tokens/chunk)...'})}\n\n"
            from services.groq_service import TokenManager
            chunks_preview = TokenManager.create_token_aware_chunks(transcript, duration_sec)
            total_sections = max(1, len(chunks_preview))
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 4, 'status': 'completed', 'progress': 58, 'message': f'Prepared {total_sections} section(s) with boundary alignment'})}\n\n"

            # STEP 5: Generating Summary & Chunk Processing
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 5, 'status': 'in_progress', 'progress': 60, 'message': f'Processing {total_sections} video section(s) with Groq AI...'})}\n\n"
            
            pool = GroqKeyPoolManager([req.groq_api_key]) if req.groq_api_key else groq_key_manager
            service = GroqOpenAIService(pool_manager=pool)
            
            # Setup async queue for streaming progress from GroqOpenAIService
            progress_queue = asyncio.Queue()
            async def progress_hook(stage: str, curr: int, total: int, msg: str):
                await progress_queue.put((stage, curr, total, msg))

            # Run LLM generation in background task while draining progress messages
            gen_task = asyncio.create_task(
                service.generate_all_learning_materials(
                    transcript,
                    video_title,
                    video_duration_seconds=duration_sec,
                    on_progress=progress_hook
                )
            )

            while not gen_task.done():
                try:
                    stage, curr, total, msg = await asyncio.wait_for(progress_queue.get(), timeout=0.25)
                    if stage == "processing_chunks":
                        pct = int(60 + (curr / total) * 18)
                        yield f"data: {json.dumps({'type': 'progress', 'step_id': 5, 'status': 'in_progress', 'progress': pct, 'message': msg})}\n\n"
                    elif stage in ["section_synthesis", "final_synthesis"]:
                        yield f"data: {json.dumps({'type': 'progress', 'step_id': 5, 'status': 'in_progress', 'progress': 79, 'message': msg})}\n\n"
                    elif stage == "qna_generation":
                        yield f"data: {json.dumps({'type': 'progress', 'step_id': 6, 'status': 'in_progress', 'progress': 84, 'message': msg})}\n\n"
                except asyncio.TimeoutError:
                    pass

            llm_output = await gen_task
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 5, 'status': 'completed', 'progress': 80, 'message': 'Executive summary and timeline generated'})}\n\n"

            # STEP 6: Creating Questions
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 6, 'status': 'in_progress', 'progress': 82, 'message': 'Formulating adaptive multi-level questions...'})}\n\n"
            all_questions = (
                llm_output.get("mcqs", []) +
                llm_output.get("short_answer_questions", []) +
                llm_output.get("long_answer_questions", []) +
                llm_output.get("fill_in_the_blanks", []) +
                llm_output.get("true_false_questions", [])
            )
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 6, 'status': 'completed', 'progress': 90, 'message': f'Generated {len(all_questions)} adaptive questions with timestamps'})}\n\n"

            # STEP 7: Creating Flashcards
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 7, 'status': 'in_progress', 'progress': 92, 'message': 'Building active recall flashcards...'})}\n\n"
            flashcards = llm_output.get("flashcards", [])
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 7, 'status': 'completed', 'progress': 95, 'message': f'Created {len(flashcards)} flashcards'})}\n\n"

            # STEP 8: Saving Results
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 8, 'status': 'in_progress', 'progress': 96, 'message': 'Persisting to database & indexing RAG chunks...'})}\n\n"
            
            video_data = {
                "youtube_id": youtube_id,
                "title": video_title,
                "youtube_url": clean_url,
                "duration": meta.get("duration", "25:00"),
                "duration_seconds": duration_sec,
                "channel": meta.get("channel", "YouTube Masterclass"),
                "thumbnail_url": meta.get("thumbnail_url", f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg" if youtube_id else "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=800&auto=format&fit=crop"),
                "processing_status": "completed",
                "pipeline_version": "v2_hierarchical"
            }

            saved_video = await db_service.save_complete_video_payload(video_data, transcript, llm_output, req.user_id)
            rag_chunks = RAGService.chunk_transcript(transcript, duration_sec)
            video_id = saved_video.get("id", "temp_vid")
            await db_service.save_transcript_chunks(video_id, rag_chunks)

            yield f"data: {json.dumps({'type': 'progress', 'step_id': 8, 'status': 'completed', 'progress': 100, 'message': 'Indexed into knowledge base'})}\n\n"

            final_payload = {
                "video": saved_video,
                "summary": {
                    "executive_summary": llm_output.get("executive_summary", ""),
                    "tldr": llm_output.get("tldr", ""),
                    "detailed_notes": llm_output.get("detailed_notes", []),
                    "key_takeaways": llm_output.get("key_takeaways", []),
                    "important_concepts": llm_output.get("important_concepts", []),
                    "chapter_timeline": llm_output.get("chapter_timeline", [])
                },
                "questions": all_questions,
                "flashcards": flashcards
            }

            yield f"data: {json.dumps({'type': 'complete', 'progress': 100, 'data': final_payload})}\n\n"

        except Exception as e:
            logger.error(f"[STREAM PIPELINE ERROR] {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/process-url", status_code=status.HTTP_200_OK)
async def process_url_endpoint(req: ProcessUrlRequest):
    if not req.url or not req.url.strip():
        logger.error("[PIPELINE STEP 0] Failed: URL field is required.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL field is required."
        )

    clean_url = req.url.strip()
    youtube_id = SmartCacheService.extract_youtube_id(clean_url)
    logger.info(f"[PIPELINE STEP 1] Processing URL: '{clean_url}' | Extracted YouTube ID: '{youtube_id}'")

    try:
        # 1. SMART CACHING CHECK WITH INCOMPLETE PAYLOAD REPLACEMENT
        if youtube_id and not req.force_refresh:
            existing_video = await db_service.get_video_by_youtube_id(youtube_id)
            if existing_video and existing_video.get("processing_status") == "completed":
                payload = await db_service.fetch_complete_video_payload(existing_video["id"])
                if payload and not is_incomplete_payload(payload):
                    logger.info(f"[PIPELINE STEP 1] [CACHE HIT SUCCESS] Reusing verified cached payload for YouTube ID: '{youtube_id}'")
                    if req.user_id:
                        await db_service.create_history_record(req.user_id, existing_video["id"])
                    return payload
                else:
                    logger.info(f"[PIPELINE STEP 1] [CACHE INVALIDATED] Stale/incomplete payload detected for '{youtube_id}'. Purging and re-processing...")
                    await db_service.delete_video_by_youtube_id(youtube_id)

        # 2. FETCH REAL YOUTUBE METADATA & TRANSCRIPT
        meta = await whisper_service.fetch_youtube_metadata(youtube_id) if youtube_id else {
            "title": f"Educational Video ({clean_url})",
            "channel": "Web Video Source",
            "thumbnail_url": "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=800&auto=format&fit=crop",
            "duration": "25:00"
        }
        video_title = meta["title"]
        logger.info(f"[PIPELINE STEP 2] Metadata retrieved: Title='{video_title}' | Channel='{meta.get('channel')}'")

        # 3. VERIFY TRANSCRIPT BEFORE CALLING GROQ
        transcript = None
        if youtube_id:
            transcript = await whisper_service.fetch_youtube_transcript(youtube_id)
        else:
            transcript = f"Transcript content for video URL: {clean_url}"

        if not transcript or not whisper_service.validate_transcript(transcript):
            logger.error(f"[PIPELINE STEP 3] [TRANSCRIPT FAILURE] Unable to obtain valid transcript for '{youtube_id}'. Aborting pipeline before AI generation.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to obtain a transcript for this video."
            )

        char_count = len(transcript)
        word_count = len(transcript.split())
        logger.info(f"[PIPELINE STEP 3] Transcript validated! Length: {char_count} chars, {word_count} words.")

        # 4. HIERARCHICAL GROQ LLM PROCESSING
        pool = GroqKeyPoolManager([req.groq_api_key]) if req.groq_api_key else groq_key_manager
        service = GroqOpenAIService(pool_manager=pool)

        duration_sec = meta.get("duration_seconds", 1500)
        logger.info(f"[PIPELINE STEP 4] Requesting Groq LLM hierarchical structured response for '{video_title}' (Duration: {duration_sec}s)...")
        llm_output = await service.generate_all_learning_materials(transcript, video_title, video_duration_seconds=duration_sec)
        logger.info(f"[PIPELINE STEP 4] Groq LLM response received and quality validated.")

        video_data = {
            "youtube_id": youtube_id,
            "title": video_title,
            "youtube_url": clean_url,
            "duration": meta.get("duration", "25:00"),
            "duration_seconds": duration_sec,
            "channel": meta.get("channel", "YouTube Masterclass"),
            "thumbnail_url": meta.get("thumbnail_url", f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg" if youtube_id else "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=800&auto=format&fit=crop"),
            "processing_status": "completed",
            "pipeline_version": "v2_hierarchical"
        }

        # 5. PERSIST TO SUPABASE POSTGRESQL DATABASE
        saved_video = await db_service.save_complete_video_payload(video_data, transcript, llm_output, req.user_id)

        # 6. CHUNK TRANSCRIPT & SAVE FOR RAG
        chunks = RAGService.chunk_transcript(transcript, duration_sec)
        video_id = saved_video.get("id", "temp_vid")
        await db_service.save_transcript_chunks(video_id, chunks)

        all_questions = (
            llm_output.get("mcqs", []) +
            llm_output.get("short_answer_questions", []) +
            llm_output.get("long_answer_questions", []) +
            llm_output.get("fill_in_the_blanks", []) +
            llm_output.get("true_false_questions", [])
        )

        logger.info(f"[PIPELINE STEP 5] Save completed! Output: {len(all_questions)} questions, {len(llm_output.get('flashcards', []))} flashcards.")

        return {
            "video": saved_video,
            "summary": {
                "executive_summary": llm_output.get("executive_summary", ""),
                "tldr": llm_output.get("tldr", ""),
                "detailed_notes": llm_output.get("detailed_notes", []),
                "key_takeaways": llm_output.get("key_takeaways", []),
                "important_concepts": llm_output.get("important_concepts", []),
                "chapter_timeline": llm_output.get("chapter_timeline", [])
            },
            "questions": all_questions,
            "flashcards": llm_output.get("flashcards", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[PIPELINE CRITICAL ERROR] Pipeline execution failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the video URL: {str(e)}"
        )

@app.post("/api/process-file-stream")
async def process_file_stream_endpoint(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    groq_api_key: Optional[str] = Form(None)
):
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid video file upload is required."
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum permitted threshold of 50MB."
        )

    filename = file.filename

    async def file_event_generator():
        try:
            # STEP 1: Uploading & Checksum
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 1, 'status': 'in_progress', 'progress': 10, 'message': 'Computing file checksum & checking cache...'})}\n\n"
            
            file_hash = SmartCacheService.compute_sha256_bytes(content)
            existing_video = await db_service.get_video_by_file_hash(file_hash)
            if existing_video and existing_video.get("processing_status") == "completed":
                payload = await db_service.fetch_complete_video_payload(existing_video["id"])
                if user_id:
                    await db_service.create_history_record(user_id, existing_video["id"])
                if payload and not is_incomplete_payload(payload):
                    for s_id in range(1, 9):
                        yield f"data: {json.dumps({'type': 'progress', 'step_id': s_id, 'status': 'completed', 'progress': int((s_id / 8) * 100), 'message': 'Loaded from cache'})}\n\n"
                        await asyncio.sleep(0.03)
                    yield f"data: {json.dumps({'type': 'complete', 'progress': 100, 'data': payload})}\n\n"
                    return

            yield f"data: {json.dumps({'type': 'progress', 'step_id': 1, 'status': 'completed', 'progress': 15, 'message': f'Loaded file: {filename}'})}\n\n"

            # STEP 2: Extracting Audio
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 2, 'status': 'in_progress', 'progress': 20, 'message': 'Extracting audio stream from MP4 file...'})}\n\n"
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            yield f"data: {json.dumps({'type': 'progress', 'step_id': 2, 'status': 'completed', 'progress': 30, 'message': 'Audio stream extracted'})}\n\n"

            # STEP 3: Generating Transcript
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 3, 'status': 'in_progress', 'progress': 35, 'message': 'Running faster-whisper acoustic tokenization...'})}\n\n"
            try:
                transcript = await whisper_service.transcribe_audio_file(tmp_path)
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

            if not transcript or not whisper_service.validate_transcript(transcript):
                yield f"data: {json.dumps({'type': 'error', 'step_id': 3, 'message': 'Unable to transcribe uploaded video file.'})}\n\n"
                return

            word_count = len(transcript.split())
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 3, 'status': 'completed', 'progress': 45, 'message': f'Transcribed {word_count} words'})}\n\n"

            # STEP 4: Token-Aware Smart Chunking
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 4, 'status': 'in_progress', 'progress': 50, 'message': 'Splitting into token-aware semantic windows (~3,500 tokens/chunk)...'})}\n\n"
            from services.groq_service import TokenManager
            chunks_preview = TokenManager.create_token_aware_chunks(transcript, 930)
            total_sections = max(1, len(chunks_preview))
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 4, 'status': 'completed', 'progress': 58, 'message': f'Prepared {total_sections} section(s)'})}\n\n"

            # STEP 5: Generating Summary
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 5, 'status': 'in_progress', 'progress': 60, 'message': f'Processing {total_sections} section(s) with Groq AI...'})}\n\n"
            pool = GroqKeyPoolManager([groq_api_key]) if groq_api_key else groq_key_manager
            service = GroqOpenAIService(pool_manager=pool)
            
            progress_queue = asyncio.Queue()
            async def progress_hook(stage: str, curr: int, total: int, msg: str):
                await progress_queue.put((stage, curr, total, msg))

            gen_task = asyncio.create_task(
                service.generate_all_learning_materials(
                    transcript,
                    filename or "Uploaded MP4 Video",
                    video_duration_seconds=930,
                    on_progress=progress_hook
                )
            )

            while not gen_task.done():
                try:
                    stage, curr, total, msg = await asyncio.wait_for(progress_queue.get(), timeout=0.25)
                    if stage == "processing_chunks":
                        pct = int(60 + (curr / total) * 18)
                        yield f"data: {json.dumps({'type': 'progress', 'step_id': 5, 'status': 'in_progress', 'progress': pct, 'message': msg})}\n\n"
                    elif stage in ["section_synthesis", "final_synthesis"]:
                        yield f"data: {json.dumps({'type': 'progress', 'step_id': 5, 'status': 'in_progress', 'progress': 79, 'message': msg})}\n\n"
                    elif stage == "qna_generation":
                        yield f"data: {json.dumps({'type': 'progress', 'step_id': 6, 'status': 'in_progress', 'progress': 84, 'message': msg})}\n\n"
                except asyncio.TimeoutError:
                    pass

            llm_output = await gen_task
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 5, 'status': 'completed', 'progress': 80, 'message': 'Executive summary generated'})}\n\n"

            # STEP 6: Creating Questions
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 6, 'status': 'in_progress', 'progress': 82, 'message': 'Generating adaptive multi-level questions...'})}\n\n"
            all_questions = (
                llm_output.get("mcqs", []) +
                llm_output.get("short_answer_questions", []) +
                llm_output.get("long_answer_questions", []) +
                llm_output.get("fill_in_the_blanks", []) +
                llm_output.get("true_false_questions", [])
            )
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 6, 'status': 'completed', 'progress': 90, 'message': f'Generated {len(all_questions)} questions with timestamps'})}\n\n"

            # STEP 7: Creating Flashcards
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 7, 'status': 'in_progress', 'progress': 92, 'message': 'Building active recall flashcards...'})}\n\n"
            flashcards = llm_output.get("flashcards", [])
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 7, 'status': 'completed', 'progress': 95, 'message': f'Created {len(flashcards)} flashcards'})}\n\n"

            # STEP 8: Saving Results
            yield f"data: {json.dumps({'type': 'progress', 'step_id': 8, 'status': 'in_progress', 'progress': 96, 'message': 'Persisting to database & indexing RAG chunks...'})}\n\n"
            video_data = {
                "file_hash": file_hash,
                "title": filename or "Uploaded Video",
                "duration": "15:30",
                "duration_seconds": 930,
                "channel": "Uploaded MP4 File",
                "thumbnail_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop",
                "processing_status": "completed",
                "pipeline_version": "v2_hierarchical"
            }
            saved_video = await db_service.save_complete_video_payload(video_data, transcript, llm_output, user_id)
            chunks = RAGService.chunk_transcript(transcript, 930)
            video_id = saved_video.get("id", "temp_vid")
            await db_service.save_transcript_chunks(video_id, chunks)

            yield f"data: {json.dumps({'type': 'progress', 'step_id': 8, 'status': 'completed', 'progress': 100, 'message': 'Knowledge base indexed'})}\n\n"

            final_payload = {
                "video": saved_video,
                "summary": {
                    "executive_summary": llm_output.get("executive_summary", ""),
                    "tldr": llm_output.get("tldr", ""),
                    "detailed_notes": llm_output.get("detailed_notes", []),
                    "key_takeaways": llm_output.get("key_takeaways", []),
                    "important_concepts": llm_output.get("important_concepts", []),
                    "chapter_timeline": llm_output.get("chapter_timeline", [])
                },
                "questions": all_questions,
                "flashcards": flashcards
            }

            yield f"data: {json.dumps({'type': 'complete', 'progress': 100, 'data': final_payload})}\n\n"

        except Exception as e:
            logger.error(f"[FILE STREAM ERROR] {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(file_event_generator(), media_type="text/event-stream")

@app.post("/api/process-file", status_code=status.HTTP_200_OK)
async def process_mp4_file(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    groq_api_key: Optional[str] = Form(None)
):
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid video file upload is required."
        )

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes)."
            )

        # Security: File size limit check (50 MB)
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum permitted threshold of 50MB."
            )

        file_hash = SmartCacheService.compute_sha256_bytes(content)

        # 1. SMART CACHING CHECK (SHA-256 Hash)
        existing_video = await db_service.get_video_by_file_hash(file_hash)
        if existing_video:
            if existing_video.get("processing_status") == "completed":
                logger.info(f"[CACHE HIT] Reusing cached MP4 file hash: {file_hash}")
                payload = await db_service.fetch_complete_video_payload(existing_video["id"])
                if user_id:
                    await db_service.create_history_record(user_id, existing_video["id"])
                if payload and not is_incomplete_payload(payload):
                    return payload

        # Save to temp file for local faster-whisper
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            transcript = await whisper_service.transcribe_audio_file(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        pool = GroqKeyPoolManager([groq_api_key]) if groq_api_key else groq_key_manager
        service = GroqOpenAIService(pool_manager=pool)
        
        # HIERARCHICAL LLM REQUEST
        llm_output = await service.generate_all_learning_materials(transcript, file.filename or "Uploaded MP4 Video", video_duration_seconds=930)

        video_data = {
            "file_hash": file_hash,
            "title": file.filename or "Uploaded Video",
            "duration": "15:30",
            "duration_seconds": 930,
            "channel": "Uploaded MP4 File",
            "thumbnail_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop",
            "processing_status": "completed",
            "pipeline_version": "v2_hierarchical"
        }

        # 2. SAVE TO SUPABASE POSTGRESQL DATABASE
        saved_video = await db_service.save_complete_video_payload(video_data, transcript, llm_output, user_id)

        # 3. CHUNK TRANSCRIPT & SAVE FOR RAG
        chunks = RAGService.chunk_transcript(transcript, 930)
        video_id = saved_video.get("id", "temp_vid")
        await db_service.save_transcript_chunks(video_id, chunks)

        return {
            "video": saved_video,
            "summary": {
                "executive_summary": llm_output.get("executive_summary", ""),
                "tldr": llm_output.get("tldr", ""),
                "detailed_notes": llm_output.get("detailed_notes", []),
                "key_takeaways": llm_output.get("key_takeaways", []),
                "important_concepts": llm_output.get("important_concepts", []),
                "chapter_timeline": llm_output.get("chapter_timeline", [])
            },
            "questions": (
                llm_output.get("mcqs", []) +
                llm_output.get("short_answer_questions", []) +
                llm_output.get("long_answer_questions", []) +
                llm_output.get("fill_in_the_blanks", []) +
                llm_output.get("true_false_questions", [])
            ),
            "flashcards": llm_output.get("flashcards", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing MP4 file upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the MP4 video file: {str(e)}"
        )

@app.post("/api/quiz-attempt", status_code=status.HTTP_200_OK)
async def record_quiz_attempt(req: QuizAttemptRequest):
    attempt_payload = {
        "video_id": req.video_id,
        "user_id": req.user_id,
        "score": req.score,
        "total_questions": req.total_questions,
        "accuracy": req.accuracy,
        "difficulty": req.difficulty,
        "answers_json": req.answers_json
    }
    result = await db_service.save_quiz_attempt(attempt_payload)
    return {"status": "success", "attempt": result}

@app.get("/api/quiz-attempts/{video_id}", status_code=status.HTTP_200_OK)
async def get_quiz_attempts(video_id: str, user_id: Optional[str] = None):
    attempts = await db_service.get_quiz_attempts(video_id, user_id)
    return {"attempts": attempts}

@app.post("/api/chat-with-video", status_code=status.HTTP_200_OK)
async def chat_with_video(req: RAGChatRequest):
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query string is required.")

    # 1. Fetch video_chunks or transcript_chunks, full transcript & video metadata from database
    video_record = await db_service.get_video_record(req.video_id) or {}
    full_transcript = await db_service.get_video_transcript(req.video_id)
    raw_v_chunks = await db_service.get_video_chunks(req.video_id)
    
    # Calculate duration seconds
    dur_sec = video_record.get("duration_seconds") or 765
    chunks = []
    
    if raw_v_chunks:
        for c in raw_v_chunks:
            chunk_content = c.get("transcript") or c.get("chunk_summary") or ""
            chunks.append({
                "sequence_number": c.get("sequence_number", 0),
                "chunk_index": c.get("sequence_number", 0),
                "start_seconds": c.get("start_seconds", 0),
                "end_seconds": c.get("end_seconds", 0),
                "start_time": c.get("start_time", "00:00"),
                "end_time": c.get("end_time", "00:00"),
                "content": chunk_content,
                "keywords": [re.sub(r'[^\w]', '', w).lower() for w in chunk_content.split() if len(w) > 3][:20]
            })
    else:
        chunks = await db_service.get_transcript_chunks(req.video_id)
    
    if not chunks:
        if full_transcript and len(full_transcript.strip()) > 50:
            chunks = RAGService.chunk_transcript(full_transcript, dur_sec)
        elif req.context_hint and len(req.context_hint.strip()) > 50:
            chunks = RAGService.chunk_transcript(req.context_hint, dur_sec)
        else:
            payload = await db_service.fetch_complete_video_payload(req.video_id)
            if payload and payload.get("summary"):
                s = payload["summary"]
                notes_str = " ".join(s.get("detailed_notes", []))
                takeaways_str = " ".join(s.get("key_takeaways", []))
                concepts_str = " ".join([f"{c.get('term')}: {c.get('definition')}" for c in s.get("important_concepts", [])])
                full_context = f"{s.get('executive_summary', '')} {s.get('tldr', '')} {notes_str} {takeaways_str} {concepts_str}"
                chunks = RAGService.chunk_transcript(full_context, dur_sec)
            else:
                chunks = RAGService.chunk_transcript(f"Detailed study content and concepts for video '{req.video_title}'.", dur_sec)

    # Save user question to chat history (non-blocking)
    try:
        await db_service.save_chat_message(req.video_id, "user", req.query, req.user_id)
    except Exception as e:
        logger.warning(f"Error saving user message to history: {e}")

    # 2. Perform Hybrid Temporal + Semantic RAG query
    rag_result = await RAGService.answer_question(
        query=req.query,
        video_title=video_record.get("title") or req.video_title or "Educational Video",
        chunks=chunks,
        pool_manager=groq_key_manager,
        full_transcript=full_transcript,
        video_metadata=video_record
    )

    # Save assistant response to chat history (non-blocking)
    try:
        await db_service.save_chat_message(
            req.video_id,
            "assistant",
            rag_result.get("answer", ""),
            req.user_id,
            rag_result.get("sources", [])
        )
    except Exception as e:
        logger.warning(f"Error saving assistant message to history: {e}")

    return rag_result

@app.get("/api/chat-history/{video_id}", status_code=status.HTTP_200_OK)
async def get_chat_history(video_id: str, user_id: Optional[str] = None):
    history = await db_service.get_chat_history(video_id, user_id)
    return {"history": history}

@app.post("/api/translate", status_code=status.HTTP_200_OK)
@app.post("/api/translate-summary", status_code=status.HTTP_200_OK)
async def translate_summary_endpoint(req: TranslationRequest):
    if req.target_language == "en":
        return {"summary": req.summary_data, "cached": True}

    # 1. Check DB Cache
    cached = await db_service.get_translation(req.video_id, req.target_language)
    if cached:
        logger.info(f"[TRANSLATION CACHE HIT] Language: {req.target_language}")
        return {"summary": cached, "cached": True}

    # 2. Translate via LLM
    translated = await TranslationService.translate_summary(
        req.summary_data,
        req.target_language,
        groq_key_manager
    )

    # 3. Cache result
    await db_service.save_translation(req.video_id, req.target_language, translated)

    return {"summary": translated, "cached": False}

@app.get("/api/video-status/{video_id}", status_code=status.HTTP_200_OK)
async def check_video_status(video_id: str):
    payload = await db_service.fetch_complete_video_payload(video_id)
    if payload and payload.get("video"):
        return {
            "video_id": video_id,
            "status": payload["video"].get("processing_status", "completed"),
            "payload": payload
        }
    return {"video_id": video_id, "status": "processing"}

@app.get("/api/videos", status_code=status.HTTP_200_OK)
@app.get("/api/history", status_code=status.HTTP_200_OK)
async def get_all_videos_endpoint(user_id: Optional[str] = None):
    """Returns all completed video summaries and study materials stored in Supabase."""
    videos = await db_service.fetch_all_videos(user_id)
    return {"videos": videos}

@app.delete("/api/videos/{video_id}", status_code=status.HTTP_200_OK)
async def delete_video_endpoint(video_id: str):
    """Deletes a video and all associated study materials from Supabase."""
    success = await db_service.delete_video(video_id)
    if success:
        return {"status": "success", "message": f"Video {video_id} deleted."}
    else:
        return {"status": "error", "message": "Failed to delete video."}

@app.post("/api/save-note", status_code=status.HTTP_200_OK)
async def save_note_endpoint(req: SaveNoteRequest):
    """Saves user personal study notes for a video into Supabase."""
    success = await db_service.save_user_note(req.video_id, req.content, req.user_id)
    return {"status": "success" if success else "error"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

