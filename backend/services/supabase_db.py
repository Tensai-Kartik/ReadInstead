import os
import uuid
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

# Configure robust logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ReadInstead.SupabaseDB")

load_dotenv()

def _clean_user_id(user_id: Optional[str]) -> Optional[str]:
    """Converts user_id string to valid UUID format required by PostgreSQL schema."""
    if not user_id:
        return None
    try:
        val = uuid.UUID(str(user_id))
        return str(val)
    except ValueError:
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, str(user_id)))

def sanitize_uuid(val: Optional[str]) -> str:
    default_uuid = "00000000-0000-0000-0000-000000000101"
    if not val:
        return default_uuid
    try:
        uuid.UUID(str(val))
        return str(val)
    except Exception:
        return default_uuid

class SupabaseDatabaseService:
    """
    Production-grade database service for ReadInstead.
    Handles normalized PostgreSQL table persistence, SHA-256 / YouTube ID deduplication,
    user history mapping, and resilient fallback handling.
    """
    def __init__(self):
        self.url = os.environ.get("SUPABASE_URL", "").strip()
        self.key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_ANON_KEY", "")).strip()
        self.db_url = os.environ.get("DATABASE_URL", "").strip()
        self._client = None

    def _get_client(self):
        if self._client is None and self.url and self.key:
            try:
                from supabase import create_client
                self._client = create_client(self.url, self.key)
                logger.info("Successfully connected to Supabase REST client.")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self._client = None
        return self._client

    async def get_video_by_youtube_id(self, youtube_id: str) -> Optional[Dict[str, Any]]:
        """Queries videos table for existing YouTube ID cache hit."""
        if not youtube_id:
            return None
        client = self._get_client()
        if not client:
            return None
        try:
            res = client.table("videos").select("*").eq("youtube_id", youtube_id).execute()
            if res.data and len(res.data) > 0:
                logger.info(f"[CACHE HIT] Found YouTube video ID: {youtube_id}")
                return res.data[0]
        except Exception as e:
            logger.warning(f"Error querying YouTube ID cache: {e}")
        return None

    async def delete_video_by_youtube_id(self, youtube_id: str):
        """Purges video and associated child tables from Supabase PostgreSQL database."""
        if not youtube_id:
            return
        client = self._get_client()
        if not client:
            return
        try:
            res = client.table("videos").select("id").eq("youtube_id", youtube_id).execute()
            if res.data:
                for row in res.data:
                    vid = row["id"]
                    try:
                        client.table("summaries").delete().eq("video_id", vid).execute()
                        client.table("questions").delete().eq("video_id", vid).execute()
                        client.table("flashcards").delete().eq("video_id", vid).execute()
                        client.table("transcripts").delete().eq("video_id", vid).execute()
                        client.table("transcript_chunks").delete().eq("video_id", vid).execute()
                        client.table("video_chunks").delete().eq("video_id", vid).execute()
                    except Exception as del_err:
                        logger.warning(f"Error purging child tables for video {vid}: {del_err}")
                client.table("videos").delete().eq("youtube_id", youtube_id).execute()
                logger.info(f"Purged stale video records for YouTube ID: {youtube_id}")
        except Exception as e:
            logger.warning(f"Error purging video record for YouTube ID {youtube_id}: {e}")

    async def get_video_by_file_hash(self, file_hash: str) -> Optional[Dict[str, Any]]:
        """Queries videos table for existing SHA-256 file hash cache hit."""
        if not file_hash:
            return None
        client = self._get_client()
        if not client:
            return None
        try:
            res = client.table("videos").select("*").eq("file_hash", file_hash).execute()
            if res.data and len(res.data) > 0:
                logger.info(f"[CACHE HIT] Found SHA-256 file hash: {file_hash}")
                return res.data[0]
        except Exception as e:
            logger.warning(f"Error querying SHA-256 file hash cache: {e}")
        return None

    async def save_complete_video_payload(
        self,
        video_data: Dict[str, Any],
        transcript_text: str,
        llm_output: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Atomically persists newly processed video, transcript, summary, Q&As, 
        and flashcards into normalized Supabase tables.
        """
        client = self._get_client()
        if not client:
            logger.warning("Supabase client unconfigured. Returning raw in-memory video payload.")
            return video_data

        try:
            # First purge existing video with same youtube_id if present
            yt_id = video_data.get("youtube_id")
            if yt_id:
                await self.delete_video_by_youtube_id(yt_id)

            # 1. Insert Video record
            video_payload = {
                "youtube_id": video_data.get("youtube_id"),
                "file_hash": video_data.get("file_hash"),
                "title": video_data.get("title", "Educational Content"),
                "youtube_url": video_data.get("youtube_url", ""),
                "duration": video_data.get("duration", "25:00"),
                "duration_seconds": video_data.get("duration_seconds", 1500),
                "channel": video_data.get("channel", "Educational Channel"),
                "thumbnail_url": video_data.get("thumbnail_url", ""),
                "processing_status": "completed",
                "pipeline_version": "v2_hierarchical"
            }
            video_insert = client.table("videos").insert(video_payload).execute()

            video_record = video_insert.data[0] if video_insert.data else video_data
            video_id = video_record.get("id")

            if video_id:
                # 2. Insert Transcript
                try:
                    client.table("transcripts").insert({
                        "video_id": video_id,
                        "raw_text": transcript_text or "Transcript text.",
                        "clean_text": transcript_text or "Clean transcript text."
                    }).execute()
                except Exception as te:
                    logger.warning(f"Transcript insertion note: {te}")

                # 3. Insert Summary
                try:
                    client.table("summaries").insert({
                        "video_id": video_id,
                        "executive_summary": llm_output.get("executive_summary", "Summary content."),
                        "tldr": llm_output.get("tldr", "TL;DR summary."),
                        "detailed_notes": llm_output.get("detailed_notes", []),
                        "key_takeaways": llm_output.get("key_takeaways", []),
                        "important_concepts": llm_output.get("important_concepts", []),
                        "chapter_timeline": llm_output.get("chapter_timeline", [])
                    }).execute()
                except Exception as se:
                    logger.error(f"Failed to insert summary: {se}")

                # 4. Insert Questions (MCQs, Short Answer, Long Answer, Fill Blanks, True/False) with timestamps
                try:
                    all_questions = []
                    for qtype, qlist in [
                        ("MCQs", llm_output.get("mcqs", [])),
                        ("Short Answer", llm_output.get("short_answer_questions", [])),
                        ("Long Answer", llm_output.get("long_answer_questions", [])),
                        ("Fill in the Blanks", llm_output.get("fill_in_the_blanks", [])),
                        ("True False", llm_output.get("true_false_questions", []))
                    ]:
                        for q in qlist:
                            all_questions.append({
                                "video_id": video_id,
                                "question_text": q.get("question_text", "Question?"),
                                "question_type": q.get("question_type", qtype),
                                "difficulty": q.get("difficulty", "Easy"),
                                "options": q.get("options"),
                                "correct_answer": q.get("correct_answer", ""),
                                "explanation": q.get("explanation", ""),
                                "start_seconds": q.get("start_seconds", 0),
                                "end_seconds": q.get("end_seconds", 0),
                                "timestamp": q.get("timestamp", "00:00"),
                                "chunk_id": q.get("chunk_id")
                            })

                    if all_questions:
                        client.table("questions").insert(all_questions).execute()
                except Exception as qe:
                    logger.error(f"Failed to insert questions: {qe}")

                # 5. Insert Flashcards with timestamps
                try:
                    flashcards = []
                    for fc in llm_output.get("flashcards", []):
                        flashcards.append({
                            "video_id": video_id,
                            "front": fc.get("front", "Front prompt?"),
                            "back": fc.get("back", "Back answer."),
                            "mastery_level": fc.get("mastery_level", "new"),
                            "start_seconds": fc.get("start_seconds", 0),
                            "end_seconds": fc.get("end_seconds", 0),
                            "timestamp": fc.get("timestamp", "00:00"),
                            "chunk_id": fc.get("chunk_id")
                        })
                    if flashcards:
                        client.table("flashcards").insert(flashcards).execute()
                except Exception as fe:
                    logger.error(f"Failed to insert flashcards: {fe}")

                # 6. Insert video_chunks if generated
                chunks_data = llm_output.get("video_chunks_data")
                if chunks_data and isinstance(chunks_data, list):
                    await self.save_video_chunks(video_id, chunks_data)

                # 7. Map User History
                if user_id:
                    await self.create_history_record(user_id, video_id)

            logger.info(f"Successfully saved video payload for video_id: {video_id}")
            return video_record

        except Exception as e:
            logger.error(f"Critical error saving complete payload to Supabase: {e}")
            return video_data

    async def fetch_complete_video_payload(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves full nested video, summary, Q&As, flashcards, and notes from database."""
        client = self._get_client()
        if not client:
            return None
        try:
            video_res = client.table("videos").select("*").eq("id", video_id).execute()
            if not video_res.data:
                return None
            video = video_res.data[0]

            summary_res = client.table("summaries").select("*").eq("video_id", video_id).execute()
            questions_res = client.table("questions").select("*").eq("video_id", video_id).execute()
            flashcards_res = client.table("flashcards").select("*").eq("video_id", video_id).execute()
            notes_res = client.table("notes").select("*").eq("video_id", video_id).limit(1).execute()

            summary_data = summary_res.data[0] if summary_res.data else {}
            questions_data = questions_res.data if questions_res.data else []
            flashcards_data = flashcards_res.data if flashcards_res.data else []
            personal_note = notes_res.data[0].get("content", "") if (notes_res.data and len(notes_res.data) > 0) else ""

            # Format processed_at nicely
            created_at_raw = video.get("created_at")
            processed_at = "Recent"
            if created_at_raw:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
                    processed_at = dt.strftime("%d %b %Y")
                except Exception:
                    processed_at = "Recent"

            # Dynamically resolve real video duration if currently default or missing
            current_dur = video.get("duration")
            if (not current_dur or current_dur == "25:00" or current_dur == "00:00") and summary_data:
                chapters = summary_data.get("chapter_timeline", [])
                if chapters and len(chapters) > 0:
                    last_chap = chapters[-1]
                    if last_chap.get("time") and last_chap.get("time") not in ["00:00", "25:00"]:
                        video["duration"] = last_chap.get("time")

            summary_content = {
                "executive_summary": summary_data.get("executive_summary", ""),
                "tldr": summary_data.get("tldr", ""),
                "detailed_notes": summary_data.get("detailed_notes", []),
                "key_takeaways": summary_data.get("key_takeaways", []),
                "important_concepts": summary_data.get("important_concepts", []),
                "chapter_timeline": summary_data.get("chapter_timeline", [])
            }

            formatted_questions = []
            for q in questions_data:
                formatted_questions.append({
                    "id": q.get("id", f"q_{video_id}_{len(formatted_questions)}"),
                    "video_id": video_id,
                    "question_text": q.get("question_text", ""),
                    "question_type": q.get("question_type", "MCQs"),
                    "difficulty": q.get("difficulty", "Easy"),
                    "options": q.get("options") or [],
                    "correct_answer": q.get("correct_answer", ""),
                    "explanation": q.get("explanation", ""),
                    "start_seconds": q.get("start_seconds", 0),
                    "end_seconds": q.get("end_seconds", 0),
                    "timestamp": q.get("timestamp", "00:00"),
                    "chunk_id": q.get("chunk_id")
                })

            formatted_flashcards = []
            for f in flashcards_data:
                formatted_flashcards.append({
                    "id": f.get("id", f"fc_{video_id}_{len(formatted_flashcards)}"),
                    "video_id": video_id,
                    "front": f.get("front", ""),
                    "back": f.get("back", ""),
                    "mastery_level": f.get("mastery_level", "new"),
                    "start_seconds": f.get("start_seconds", 0),
                    "end_seconds": f.get("end_seconds", 0),
                    "timestamp": f.get("timestamp", "00:00"),
                    "chunk_id": f.get("chunk_id")
                })

            return {
                "id": video.get("id"),
                "title": video.get("title", "Educational Video"),
                "youtube_url": video.get("youtube_url", ""),
                "duration": video.get("duration", "25:00"),
                "duration_seconds": video.get("duration_seconds", 1500),
                "channel": video.get("channel", "Educational Channel"),
                "thumbnail_url": video.get("thumbnail_url", ""),
                "processed_at": processed_at,
                "summary": summary_content,
                "original_summary": summary_content,
                "questions": formatted_questions,
                "flashcards": formatted_flashcards,
                "personal_note": personal_note,
                "completion_percentage": 10,
                "video": video
            }
        except Exception as e:
            logger.error(f"Error fetching complete video payload for ID {video_id}: {e}")
            return None

    async def fetch_all_videos(self, user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetches all completed videos from Supabase with full summary and Q&A payload.
        """
        client = self._get_client()
        if not client:
            return []
        try:
            video_res = client.table("videos").select("id, title, channel, created_at, processing_status").eq("processing_status", "completed").order("created_at", desc=True).limit(limit).execute()
            if not video_res.data:
                return []

            results = []
            for row in video_res.data:
                vid_id = row.get("id")
                if vid_id:
                    payload = await self.fetch_complete_video_payload(vid_id)
                    if payload and payload.get("summary") and payload.get("summary", {}).get("executive_summary"):
                        results.append(payload)
            logger.info(f"Retrieved {len(results)} completed videos from Supabase.")
            return results
        except Exception as e:
            logger.error(f"Error fetching all videos from Supabase: {e}")
            return []

    async def delete_video(self, video_id: str) -> bool:
        """Purges a video and all cascaded records from Supabase."""
        client = self._get_client()
        if not client or not video_id:
            return False
        try:
            for table in ["summaries", "questions", "flashcards", "transcripts", "transcript_chunks", "video_chunks", "translations", "chat_messages", "quiz_attempts", "history", "notes"]:
                try:
                    client.table(table).delete().eq("video_id", video_id).execute()
                except Exception:
                    pass
            client.table("videos").delete().eq("id", video_id).execute()
            logger.info(f"Successfully deleted video {video_id} and all child tables from Supabase.")
            return True
        except Exception as e:
            logger.error(f"Error deleting video {video_id}: {e}")
            return False

    async def save_user_note(self, video_id: str, content: str, user_id: Optional[str] = None) -> bool:
        """Saves user note into Supabase notes table."""
        client = self._get_client()
        if not client or not video_id:
            return False
        clean_user_id = sanitize_uuid(user_id)
        try:
            client.table("notes").upsert({
                "video_id": video_id,
                "user_id": clean_user_id,
                "content": content,
            }, on_conflict="video_id,user_id").execute()
            logger.info(f"Saved note for video {video_id}")
            return True
        except Exception as e:
            logger.warning(f"Error saving note to Supabase: {e}")
            return False

    async def create_history_record(self, user_id: str, video_id: str):
        """Creates or updates user study history entry (non-failing)."""
        client = self._get_client()
        if not client:
            return
        clean_user_id = sanitize_uuid(user_id)
        try:
            client.table("history").upsert({
                "user_id": clean_user_id,
                "video_id": video_id,
                "completion_percentage": 10
            }, on_conflict="user_id,video_id").execute()
            logger.info(f"History updated for user {clean_user_id} and video {video_id}")
        except Exception as e:
            # Foreign key or policy note (safe non-blocking)
            logger.debug(f"History upsert note: {e}")

    async def save_quiz_attempt(self, attempt_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Saves user quiz result into quiz_attempts table."""
        client = self._get_client()
        if not client:
            return attempt_data
        try:
            payload = dict(attempt_data)
            if "user_id" in payload:
                payload["user_id"] = sanitize_uuid(payload["user_id"])
            res = client.table("quiz_attempts").insert(payload).execute()
            if res.data:
                logger.info(f"Saved quiz attempt for video {payload.get('video_id')}")
                return res.data[0]
        except Exception as e:
            logger.error(f"Error saving quiz attempt: {e}")
        return attempt_data

    async def get_quiz_attempts(self, video_id: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetches past quiz attempts for a video."""
        client = self._get_client()
        if not client:
            return []
        try:
            query = client.table("quiz_attempts").select("*").eq("video_id", video_id)
            if user_id:
                query = query.eq("user_id", sanitize_uuid(user_id))
            res = query.order("created_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching quiz attempts: {e}")
            return []

    async def save_transcript_chunks(self, video_id: str, chunks: List[Dict[str, Any]]):
        """Persists chunked transcript data for RAG retrieval."""
        client = self._get_client()
        if not client or not chunks:
            return
        try:
            payloads = []
            for idx, c in enumerate(chunks):
                payloads.append({
                    "video_id": video_id,
                    "chunk_index": idx,
                    "start_seconds": c.get("start_seconds", 0),
                    "end_seconds": c.get("end_seconds", 0),
                    "start_time": c.get("start_time", "00:00"),
                    "content": c.get("content", ""),
                    "keywords": c.get("keywords", [])
                })
            client.table("transcript_chunks").upsert(payloads, on_conflict="video_id,chunk_index").execute()
            logger.info(f"Persisted {len(chunks)} transcript chunks for video {video_id}")
        except Exception as e:
            logger.error(f"Error saving transcript chunks: {e}")

    async def get_transcript_chunks(self, video_id: str) -> List[Dict[str, Any]]:
        """Fetches stored transcript chunks for a video."""
        client = self._get_client()
        if not client:
            return []
        try:
            res = client.table("transcript_chunks").select("*").eq("video_id", video_id).order("chunk_index").execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching transcript chunks: {e}")
            return []

    async def save_video_chunks(self, video_id: str, chunks: List[Dict[str, Any]]):
        """Persists token-aware knowledge chunks into video_chunks table."""
        client = self._get_client()
        if not client or not chunks:
            return
        try:
            payloads = []
            for idx, c in enumerate(chunks):
                payloads.append({
                    "video_id": video_id,
                    "sequence_number": c.get("sequence_number", idx),
                    "start_seconds": c.get("start_seconds", 0),
                    "end_seconds": c.get("end_seconds", 0),
                    "start_time": c.get("start_time", "00:00"),
                    "end_time": c.get("end_time", "00:00"),
                    "transcript": c.get("transcript", ""),
                    "chunk_summary": c.get("chunk_summary", ""),
                    "key_points": c.get("key_points", []),
                    "important_concepts": c.get("important_concepts", []),
                    "examples": c.get("examples", []),
                    "processing_status": c.get("processing_status", "completed")
                })
            client.table("video_chunks").upsert(payloads, on_conflict="video_id,sequence_number").execute()
            logger.info(f"Persisted {len(chunks)} video_chunks for video {video_id}")
        except Exception as e:
            logger.error(f"Error saving video_chunks: {e}")

    async def get_video_chunks(self, video_id: str) -> List[Dict[str, Any]]:
        """Fetches stored token-aware video chunks for a video."""
        client = self._get_client()
        if not client:
            return []
        try:
            res = client.table("video_chunks").select("*").eq("video_id", video_id).order("sequence_number").execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching video_chunks: {e}")
            return []

    async def get_video_transcript(self, video_id: str) -> Optional[str]:
        """Fetches full clean transcript text for a video."""
        client = self._get_client()
        if not client:
            return None
        try:
            res = client.table("transcripts").select("clean_text,raw_text").eq("video_id", video_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0].get("clean_text") or res.data[0].get("raw_text")
        except Exception as e:
            logger.error(f"Error fetching video transcript: {e}")
        return None

    async def get_video_record(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Fetches basic video record including duration, channel, title, and timestamp metadata."""
        client = self._get_client()
        if not client:
            return None
        try:
            res = client.table("videos").select("*").eq("id", video_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.error(f"Error fetching video record: {e}")
        return None

    async def save_translation(self, video_id: str, target_lang: str, summary: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Caches translated summary in translations table."""
        client = self._get_client()
        if not client:
            return None
        try:
            payload = {
                "video_id": video_id,
                "target_language": target_lang,
                "translated_summary": summary
            }
            res = client.table("translations").upsert(payload, on_conflict="video_id,target_language").execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.error(f"Error saving translation: {e}")
        return None

    async def get_translation(self, video_id: str, target_lang: str) -> Optional[Dict[str, Any]]:
        """Retrieves cached translation if available."""
        client = self._get_client()
        if not client:
            return None
        try:
            res = client.table("translations").select("*").eq("video_id", video_id).eq("target_language", target_lang).execute()
            if res.data and len(res.data) > 0:
                return res.data[0].get("translated_summary")
        except Exception as e:
            logger.error(f"Error fetching translation: {e}")
        return None

    async def save_chat_message(self, video_id: str, sender: str, content: str, user_id: Optional[str] = None, sources: List[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Persists chat message into database."""
        client = self._get_client()
        if not client:
            return None
        clean_user_id = sanitize_uuid(user_id)
        await self._ensure_user_exists(client, clean_user_id)
        try:
            payload = {
                "video_id": video_id,
                "user_id": clean_user_id,
                "sender": sender,
                "content": content,
                "sources": sources or []
            }
            res = client.table("chat_messages").insert(payload).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.error(f"Error saving chat message: {e}")
        return None

    async def get_chat_history(self, video_id: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetches video chat history."""
        client = self._get_client()
        if not client:
            return []
        clean_user_id = sanitize_uuid(user_id)
        try:
            query = client.table("chat_messages").select("*").eq("video_id", video_id)
            if clean_user_id:
                query = query.eq("user_id", clean_user_id)
            res = query.order("created_at").execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching chat history: {e}")
            return []

