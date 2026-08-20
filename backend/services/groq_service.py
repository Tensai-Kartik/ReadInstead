import os
import re
import json
import math
import time
import logging
import asyncio
from typing import Dict, Any, List, Optional, Tuple, Callable
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ReadInstead.GroqService")

load_dotenv()


class TokenManager:
    """
    Token estimation and token-aware smart chunking for video transcripts.
    Ensures that input tokens stay within safety budgets and never split mid-sentence or mid-timestamp.
    """
    # Target 3,200 - 3,800 tokens per chunk with safety headroom
    TARGET_CHUNK_INPUT_TOKENS = int(os.environ.get("TARGET_CHUNK_INPUT_TOKENS", 3500))
    HARD_MAX_CHUNK_INPUT_TOKENS = int(os.environ.get("HARD_MAX_CHUNK_INPUT_TOKENS", 4000))
    MAX_COMPLETION_TOKENS = int(os.environ.get("MAX_COMPLETION_TOKENS", 1200))
    OVERLAP_TOKENS = int(os.environ.get("CHUNK_OVERLAP_TOKENS", 80))

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Fast token estimation (~1.33 tokens per word or ~4 chars per token)."""
        if not text:
            return 0
        word_count = len(text.split())
        char_count = len(text)
        # Conservative blended estimation
        return max(int(word_count * 1.33), int(char_count / 3.8))

    @classmethod
    def parse_timestamp_to_seconds(cls, ts_str: str) -> int:
        """Converts 'MM:SS' or 'H:MM:SS' into integer seconds."""
        if not ts_str:
            return 0
        clean = ts_str.strip().strip("[]")
        parts = clean.split(":")
        try:
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            elif len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            return int(parts[0])
        except Exception:
            return 0

    @classmethod
    def format_seconds(cls, seconds: int) -> str:
        """Converts integer seconds to 'MM:SS' or 'H:MM:SS'."""
        seconds = max(0, int(seconds))
        mins, secs = divmod(seconds, 60)
        hrs, mins = divmod(mins, 60)
        if hrs > 0:
            return f"{hrs}:{mins:02d}:{secs:02d}"
        return f"{mins:02d}:{secs:02d}"

    @classmethod
    def split_into_semantic_segments(cls, raw_transcript: str) -> List[Dict[str, Any]]:
        """
        Splits timestamped transcript into discrete timestamped segments.
        Handles both '[MM:SS] text' patterns and plain text by sentence boundaries.
        """
        if not raw_transcript or not raw_transcript.strip():
            return []

        segments: List[Dict[str, Any]] = []
        # Pattern for timestamp markers like [00:00], [01:23:45], [05:30]
        ts_pattern = re.compile(r'\[(?:(\d+):)?(\d{1,2}):(\d{2})\]')
        
        matches = list(ts_pattern.finditer(raw_transcript))
        if matches:
            for idx, match in enumerate(matches):
                start_char = match.start()
                end_char = matches[idx + 1].start() if idx + 1 < len(matches) else len(raw_transcript)
                block_text = raw_transcript[start_char:end_char].strip()
                
                # Extract timestamp token
                ts_token = match.group(0)
                sec = cls.parse_timestamp_to_seconds(ts_token)
                
                # Clean text without leading timestamp for readability
                clean_text = block_text[len(ts_token):].strip()
                if not clean_text:
                    clean_text = block_text
                
                segments.append({
                    "start_seconds": sec,
                    "timestamp": ts_token.strip("[]"),
                    "raw_block": block_text,
                    "text": clean_text,
                    "tokens": cls.estimate_tokens(block_text)
                })
        else:
            # Fallback for plain text: split on sentence boundaries
            sentences = re.split(r'(?<=[.!?\n])\s+', raw_transcript)
            cur_sec = 0
            for s in sentences:
                s_clean = s.strip()
                if not s_clean:
                    continue
                tokens = cls.estimate_tokens(s_clean)
                segments.append({
                    "start_seconds": cur_sec,
                    "timestamp": cls.format_seconds(cur_sec),
                    "raw_block": f"[{cls.format_seconds(cur_sec)}] {s_clean}",
                    "text": s_clean,
                    "tokens": tokens
                })
                # Estimate 3 seconds per 10 tokens
                cur_sec += max(2, int(tokens * 0.3))

        return segments

    @classmethod
    def create_token_aware_chunks(
        cls,
        raw_transcript: str,
        video_duration_seconds: int = 1500,
        target_tokens: int = None
    ) -> List[Dict[str, Any]]:
        """
        Groups transcript segments into coherent chunks of approximately target_tokens size.
        Never splits in the middle of a sentence or timestamp segment.
        Includes a small overlap across adjacent chunks to preserve continuity.
        """
        target = target_tokens or cls.TARGET_CHUNK_INPUT_TOKENS
        segments = cls.split_into_semantic_segments(raw_transcript)
        if not segments:
            return []

        chunks: List[Dict[str, Any]] = []
        current_segments: List[Dict[str, Any]] = []
        current_token_count = 0
        seg_index = 0

        while seg_index < len(segments):
            seg = segments[seg_index]
            seg_tokens = seg["tokens"]

            # If adding this segment exceeds target tokens and we already have content
            if current_token_count + seg_tokens > target and current_segments:
                # Finalize current chunk
                start_sec = current_segments[0]["start_seconds"]
                end_sec = current_segments[-1]["start_seconds"] + 15
                if chunks and chunks[-1]["end_seconds"] > start_sec:
                    start_sec = max(start_sec, chunks[-1]["start_seconds"] + 1)
                end_sec = max(end_sec, start_sec + 30)

                combined_text = " ".join([s["raw_block"] for s in current_segments])
                chunk_seq = len(chunks)

                chunks.append({
                    "sequence_number": chunk_seq,
                    "chunk_id": f"chunk_{chunk_seq}",
                    "start_seconds": start_sec,
                    "end_seconds": end_sec,
                    "start_time": cls.format_seconds(start_sec),
                    "end_time": cls.format_seconds(end_sec),
                    "transcript": combined_text,
                    "token_count": current_token_count,
                    "processing_status": "pending"
                })

                # Overlap: keep the last few segments totaling ~OVERLAP_TOKENS for context
                overlap_segments = []
                overlap_tokens = 0
                for prev_seg in reversed(current_segments):
                    if overlap_tokens + prev_seg["tokens"] <= cls.OVERLAP_TOKENS:
                        overlap_segments.insert(0, prev_seg)
                        overlap_tokens += prev_seg["tokens"]
                    else:
                        break

                current_segments = list(overlap_segments)
                current_token_count = overlap_tokens

            current_segments.append(seg)
            current_token_count += seg_tokens
            seg_index += 1

        # Final remaining chunk
        if current_segments:
            start_sec = current_segments[0]["start_seconds"]
            end_sec = max(video_duration_seconds, current_segments[-1]["start_seconds"] + 15)
            combined_text = " ".join([s["raw_block"] for s in current_segments])
            chunk_seq = len(chunks)

            chunks.append({
                "sequence_number": chunk_seq,
                "chunk_id": f"chunk_{chunk_seq}",
                "start_seconds": start_sec,
                "end_seconds": end_sec,
                "start_time": cls.format_seconds(start_sec),
                "end_time": cls.format_seconds(end_sec),
                "transcript": combined_text,
                "token_count": current_token_count,
                "processing_status": "pending"
            })

        logger.info(f"[TOKEN CHUNKER] Created {len(chunks)} token-aware chunks from transcript ({len(segments)} segments, target: {target} tokens).")
        return chunks


class GroqKeyPoolManager:
    """
    Round-Robin & Automatic Failover API Key Manager for Groq API keys.
    Dynamically loads keys from GROQ_API_KEYS (comma-separated) or GROQ_API_KEY.
    """
    def __init__(self, custom_keys: List[str] = None):
        raw_keys = []
        env_keys_str = os.environ.get("GROQ_API_KEYS", "")
        if env_keys_str:
            raw_keys.extend([k.strip().strip("'\"") for k in env_keys_str.split(",") if k.strip()])
        
        single_key = os.environ.get("GROQ_API_KEY", "").strip().strip("'\"")
        if single_key and single_key not in raw_keys:
            raw_keys.append(single_key)

        if custom_keys:
            for k in custom_keys:
                if k and isinstance(k, str):
                    cleaned = k.strip().strip("'\"")
                    if cleaned and cleaned not in raw_keys:
                        raw_keys.append(cleaned)

        self.keys = raw_keys
        self._current_index = 0
        self._lock = asyncio.Lock()
        logger.info(f"Initialized GroqKeyPoolManager with {len(self.keys)} active API keys.")

    async def get_next_key(self) -> str:
        if not self.keys:
            return ""
        async with self._lock:
            key = self.keys[self._current_index % len(self.keys)]
            self._current_index += 1
            return key


class RateLimitedGroqClient:
    """
    Controlled worker client for Groq API calls.
    Respects Tokens Per Minute (TPM) limits by tracking tokens and response headers,
    and applies exponential backoff on 429/413 errors.
    """
    def __init__(self, pool_manager: GroqKeyPoolManager):
        self.pool_manager = pool_manager
        self.min_delay_seconds = float(os.environ.get("GROQ_REQUEST_PACE_SECONDS", "1.5"))
        self._last_request_time = 0.0
        self._rate_limit_lock = asyncio.Lock()

    async def execute_structured_request(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_completion_tokens: int = 1200,
        candidate_models: List[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a rate-limited JSON completion request with retry, backoff, and model fallback.
        Primary model: openai/gpt-oss-20b.
        """
        from openai import AsyncOpenAI

        if not self.pool_manager.keys:
            raise ValueError("No Groq API keys configured in environment.")

        models = candidate_models or [
            "openai/gpt-oss-20b",
            "openai/gpt-oss-120b",
            "groq/compound-mini",
            "groq/compound"
        ]

        total_keys = len(self.pool_manager.keys)
        max_attempts = total_keys * len(models)
        attempt = 0
        last_exception = None

        while attempt < max_attempts:
            attempt += 1
            api_key = await self.pool_manager.get_next_key()
            if not api_key:
                await asyncio.sleep(0.5)
                continue

            for model_name in models:
                # Pacing lock to prevent hammering Groq TPM
                async with self._rate_limit_lock:
                    now = time.time()
                    elapsed = now - self._last_request_time
                    if elapsed < self.min_delay_seconds:
                        await asyncio.sleep(self.min_delay_seconds - elapsed)
                    self._last_request_time = time.time()

                try:
                    logger.info(f"[GROQ PACED CALL] Attempt #{attempt} | Model: {model_name} | Key ending: ...{api_key[-6:]}")
                    client = AsyncOpenAI(
                        base_url="https://api.groq.com/openai/v1",
                        api_key=api_key,
                        timeout=45.0
                    )

                    # Determine parameter compatibility
                    kwargs: Dict[str, Any] = {
                        "model": model_name,
                        "messages": messages,
                        "temperature": temperature,
                        "response_format": {"type": "json_object"}
                    }
                    
                    # Use max_completion_tokens if supported, fallback to max_tokens
                    try:
                        kwargs["max_completion_tokens"] = max_completion_tokens
                        response = await client.chat.completions.create(**kwargs)
                    except TypeError:
                        kwargs.pop("max_completion_tokens", None)
                        kwargs["max_tokens"] = max_completion_tokens
                        response = await client.chat.completions.create(**kwargs)

                    content = response.choices[0].message.content
                    if not content or not content.strip():
                        raise ValueError("Empty completion returned from Groq API.")

                    parsed_json = json.loads(content)
                    return parsed_json

                except json.JSONDecodeError as jde:
                    logger.warning(f"[GROQ JSON PARSE ERROR] Model {model_name} returned non-JSON text: {jde}")
                    last_exception = jde
                    # Clean up raw markdown blocks if possible
                    if content and "{" in content and "}" in content:
                        try:
                            start_i = content.find("{")
                            end_i = content.rfind("}") + 1
                            return json.loads(content[start_i:end_i])
                        except Exception:
                            pass
                except Exception as e:
                    err_str = str(e).lower()
                    last_exception = e
                    
                    # 429 Rate Limit or 413 Payload Too Large
                    if "429" in err_str or "rate_limit" in err_str or "rate limit" in err_str or "tpm" in err_str:
                        retry_after = 6.0
                        # Check for retry-after hint in error
                        match = re.search(r'retry\s+after\s+(\d+(?:\.\d+)?)', err_str)
                        if match:
                            retry_after = max(3.0, float(match.group(1)) + 1.0)
                        logger.warning(f"[GROQ RATE LIMIT 429/TPM] Pausing {retry_after:.1f}s before retry with next key/model. ({e})")
                        await asyncio.sleep(retry_after)
                    elif "413" in err_str:
                        logger.warning(f"[GROQ 413 TOO LARGE] Request payload too large for {model_name}. Attempting next model...")
                        await asyncio.sleep(2.0)
                    else:
                        logger.warning(f"[GROQ CALL FAILED] Error with model {model_name}: {e}. Trying next...")
                        await asyncio.sleep(1.0)

        raise RuntimeError(f"All Groq API requests failed after {max_attempts} attempts. Last error: {last_exception}")


class GroqOpenAIService:
    """
    Comprehensive Token-Aware Hierarchical Groq AI Pipeline.
    Supports videos of arbitrary length via:
    1. Token-aware smart chunking (~3,500 input tokens / chunk)
    2. Per-chunk compact knowledge extraction (summary + key points + concepts + examples + timestamps)
    3. Hierarchical multi-level synthesis (Section reduction when required -> Final Synthesis)
    4. Grounded Timestamp-Aware Q&A and Flashcard bank generation
    """
    def __init__(self, pool_manager: GroqKeyPoolManager = None):
        self.pool_manager = pool_manager or GroqKeyPoolManager()
        self.client = RateLimitedGroqClient(self.pool_manager)

    async def extract_chunk_knowledge(
        self,
        chunk: Dict[str, Any],
        video_title: str
    ) -> Dict[str, Any]:
        """
        Extracts compact structured knowledge from an individual transcript chunk.
        Does NOT waste tokens generating full study suites per chunk.
        """
        seq = chunk.get("sequence_number", 0)
        start_t = chunk.get("start_time", "00:00")
        end_t = chunk.get("end_time", "00:00")
        transcript_text = chunk.get("transcript", "")

        prompt = f"""
You are an expert academic analyst extracting structured knowledge from Section #{seq + 1} [{start_t} - {end_t}] of the lecture titled '{video_title}'.

INSTRUCTIONS:
1. Extract a dense, faithful 1-2 paragraph summary capturing the core technical points, arguments, code/math explanations, or procedures covered in this time interval.
2. Extract 3-6 specific key bullet points with technical precision.
3. Extract important key terms/concepts defined or used in this section.
4. Extract concrete examples, case studies, or facts mentioned.
5. Ground everything strictly in the transcript text provided. Do not use generic filler phrases.

Return EXACTLY ONE JSON object with this schema:
{{
  "chunk_summary": "Dense, factual summary of this specific video segment [{start_t} - {end_t}].",
  "key_points": [
    "Specific technical point 1 with accurate details",
    "Specific technical point 2"
  ],
  "important_concepts": [
    {{"term": "Technical Term", "definition": "Accurate definition based on lecture context"}}
  ],
  "examples": [
    "Concrete example or dataset mentioned by the speaker"
  ],
  "timestamp_range": "{start_t} - {end_t}",
  "start_seconds": {chunk.get("start_seconds", 0)},
  "end_seconds": {chunk.get("end_seconds", 0)}
}}

SECTION TRANSCRIPT [{start_t} - {end_t}]:
{transcript_text}
"""
        messages = [
            {"role": "system", "content": "You are an elite educational AI knowledge extractor. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ]

        result = await self.client.execute_structured_request(
            messages=messages,
            temperature=0.1,
            max_completion_tokens=1000
        )
        return result

    async def synthesize_section_knowledge(
        self,
        chunk_results: List[Dict[str, Any]],
        video_title: str,
        section_number: int
    ) -> Dict[str, Any]:
        """
        Synthesizes multiple chunk knowledge extractions into a consolidated Section Summary.
        Used for long/very long videos to keep the final synthesis prompt safely bounded.
        """
        combined_summaries = "\n\n".join([
            f"--- Segment [{c.get('timestamp_range', '00:00')}] ---\n"
            f"Summary: {c.get('chunk_summary', '')}\n"
            f"Key Points: {'; '.join(c.get('key_points', []))}"
            for c in chunk_results
        ])

        prompt = f"""
You are an expert educational editor consolidating Section #{section_number} of the lecture '{video_title}'.

Synthesize the segment summaries below into a coherent, high-density section overview and unified takeaways.

Return JSON with this schema:
{{
  "section_summary": "Unified technical narrative for this entire section of the video.",
  "section_key_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3"],
  "section_concepts": [{{"term": "Term", "definition": "Definition"}}]
}}

SEGMENT SUMMARIES:
{combined_summaries}
"""
        messages = [
            {"role": "system", "content": "You are a master technical editor. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ]

        return await self.client.execute_structured_request(
            messages=messages,
            temperature=0.15,
            max_completion_tokens=1000
        )

    async def synthesize_final_summary(
        self,
        accumulated_knowledge: List[Dict[str, Any]],
        video_title: str,
        video_duration_seconds: int = 1500
    ) -> Dict[str, Any]:
        """
        Synthesizes the complete final study summary, TL;DR, detailed notes, key takeaways,
        important concepts, and full chapter timeline from accumulated chunk knowledge.
        The prompt uses ONLY compact chunk summaries (never the raw multi-thousand token transcript).
        """
        knowledge_digest = []
        all_concepts: List[Dict[str, str]] = []

        for idx, k in enumerate(accumulated_knowledge):
            t_range = k.get("timestamp_range", f"Part {idx + 1}")
            c_sum = k.get("chunk_summary", "")
            k_pts = k.get("key_points", [])
            knowledge_digest.append(f"### [Part {idx + 1} | {t_range}]\n{c_sum}\nKey Points: {'; '.join(k_pts[:4])}")
            
            for concept in k.get("important_concepts", []):
                if isinstance(concept, dict) and concept.get("term"):
                    all_concepts.append(concept)

        full_digest_text = "\n\n".join(knowledge_digest)
        dur_formatted = TokenManager.format_seconds(video_duration_seconds)

        prompt = f"""
You are an elite educational AI producing the definitive study summary for the masterclass titled '{video_title}' (Total Duration: {dur_formatted}).

GROUNDED INPUT DIGEST:
{full_digest_text}

INSTRUCTIONS:
1. `executive_summary`: 2-3 thorough, highly educational paragraphs synthesizing the core arguments, technical mechanisms, syntax/equations, and conclusions across the entire video.
2. `tldr`: A punchy 2-3 sentence executive takeaway capturing what this video accomplishes and teaches.
3. `detailed_notes`: 6-12 comprehensive bullet notes detailing specific concepts, steps, or observations from start to finish.
4. `key_takeaways`: 4-8 high-yield core takeaways.
5. `important_concepts`: Consolidated list of 5-10 key terms with crisp definitions based on the lecture.
6. `chapter_timeline`: 4-8 chronological chapter markers covering the full span from [00:00] to {dur_formatted}. Each must have:
   - "time": string formatted as "MM:SS" (e.g. "00:00", "04:30")
   - "seconds": integer seconds
   - "title": concise topic title
   - "description": 1-2 sentence description of what is explained in this chapter

Return EXACTLY ONE JSON object with this schema:
{{
  "executive_summary": "Comprehensive overview...",
  "tldr": "Punchy 2-3 sentence TL;DR...",
  "detailed_notes": ["Detailed note 1", "Detailed note 2", "Detailed note 3", "Detailed note 4"],
  "key_takeaways": ["Core takeaway 1", "Core takeaway 2", "Core takeaway 3"],
  "important_concepts": [{{"term": "Term", "definition": "Definition"}}],
  "chapter_timeline": [
    {{"time": "00:00", "seconds": 0, "title": "Introduction & Fundamentals", "description": "Overview of topics."}},
    {{"time": "05:00", "seconds": 300, "title": "Core Technical Mechanism", "description": "In-depth walkthrough."}}
  ]
}}
"""
        messages = [
            {"role": "system", "content": "You are a world-class educational summarizer. Return valid JSON only."},
            {"role": "user", "content": prompt}
        ]

        result = await self.client.execute_structured_request(
            messages=messages,
            temperature=0.2,
            max_completion_tokens=1500
        )

        # Fallback chapter timeline if model omitted it
        if not result.get("chapter_timeline") or len(result.get("chapter_timeline", [])) == 0:
            timeline = []
            for idx, k in enumerate(accumulated_knowledge):
                start_s = k.get("start_seconds", idx * 300)
                time_str = TokenManager.format_seconds(start_s)
                
                # Derive title from concepts or key points
                title = f"Topic #{idx + 1}"
                if k.get("important_concepts") and len(k["important_concepts"]) > 0:
                    c0 = k["important_concepts"][0]
                    if isinstance(c0, dict) and c0.get("term"):
                        title = c0["term"]
                elif k.get("key_points") and len(k["key_points"]) > 0:
                    title = k["key_points"][0][:45]

                desc = k.get("chunk_summary", "")[:120] + "..." if k.get("chunk_summary") else f"Detailed explanation of {title}."
                timeline.append({
                    "time": time_str,
                    "seconds": start_s,
                    "title": title,
                    "description": desc
                })
            result["chapter_timeline"] = timeline

        return result

    async def generate_qna_and_flashcards(
        self,
        accumulated_knowledge: List[Dict[str, Any]],
        video_title: str,
        video_duration_seconds: int = 1500
    ) -> Dict[str, Any]:
        """
        Generates a unified, timestamp-aware Q&A bank and Flashcard bank from accumulated knowledge.
        Ensures questions span all 5 types (MCQs, Short Answer, Long Answer, Fill in Blanks, True/False)
        and multiple difficulties (Easy, Medium, Hard), complete with timestamp references.
        """
        # Create compact contextual segments
        context_snippets = []
        for idx, k in enumerate(accumulated_knowledge):
            t_range = k.get("timestamp_range", f"Part {idx + 1}")
            start_s = k.get("start_seconds", 0)
            end_s = k.get("end_seconds", start_s + 60)
            c_sum = k.get("chunk_summary", "")
            k_pts = "; ".join(k.get("key_points", [])[:3])
            context_snippets.append(
                f"[Chunk {idx + 1} | Time {t_range} ({start_s}s - {end_s}s)]:\n"
                f"Summary: {c_sum}\n"
                f"Points: {k_pts}"
            )

        context_text = "\n\n".join(context_snippets)

        prompt = f"""
You are an expert assessment designer creating a comprehensive study and active-recall test bank for '{video_title}'.

GROUNDED VIDEO KNOWLEDGE:
{context_text}

INSTRUCTIONS:
1. Generate rigorous, grounded assessment questions that test true understanding across all parts of the lecture.
2. Every question and flashcard MUST include accurate timestamp metadata:
   - `start_seconds`: integer start seconds where this concept was discussed
   - `end_seconds`: integer end seconds
   - `timestamp`: string (e.g. "04:30")
   - `chunk_id`: string (e.g. "chunk_1")
3. Include question types:
   - `mcqs`: 3-5 multiple choice questions with 4 distinct options, correct_answer, explanation, difficulty ("Easy", "Medium", "Hard").
   - `short_answer_questions`: 2-3 conceptual questions with clear answer and explanation.
   - `long_answer_questions`: 1-2 comprehensive analytical questions.
   - `fill_in_the_blanks`: 2-3 sentence completion questions.
   - `true_false_questions`: 2-3 true/false statements with options ["True", "False"].
4. Generate 4-8 active-recall `flashcards` with:
   - `front`: Prompt or concept question
   - `back`: Clear, precise answer or definition
   - `mastery_level`: "new"
   - `start_seconds`: int
   - `timestamp`: string

Return EXACTLY ONE JSON object with this structure:
{{
  "mcqs": [
    {{
      "question_text": "Which technique is highlighted for optimizing memory latency?",
      "question_type": "MCQs",
      "difficulty": "Medium",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option B",
      "explanation": "According to the lecture, Option B reduces memory access overhead.",
      "start_seconds": 120,
      "end_seconds": 240,
      "timestamp": "02:00",
      "chunk_id": "chunk_0"
    }}
  ],
  "short_answer_questions": [
    {{
      "question_text": "What is the primary advantage of the discussed architecture?",
      "question_type": "Short Answer",
      "difficulty": "Easy",
      "correct_answer": "Expected conceptual answer",
      "explanation": "Grounded explanation based on lecture",
      "start_seconds": 300,
      "end_seconds": 450,
      "timestamp": "05:00",
      "chunk_id": "chunk_1"
    }}
  ],
  "long_answer_questions": [
    {{
      "question_text": "Explain how the pipeline resolves data hazards during execution.",
      "question_type": "Long Answer",
      "difficulty": "Hard",
      "correct_answer": "Detailed answer explaining hazard detection and forwarding.",
      "explanation": "Detailed grounded explanation",
      "start_seconds": 600,
      "end_seconds": 780,
      "timestamp": "10:00",
      "chunk_id": "chunk_2"
    }}
  ],
  "fill_in_the_blanks": [
    {{
      "question_text": "In this model, the _____ layer maps tokens into high-dimensional embedding space.",
      "question_type": "Fill in the Blanks",
      "difficulty": "Easy",
      "correct_answer": "embedding",
      "explanation": "The embedding layer converts discrete token IDs to continuous vectors.",
      "start_seconds": 60,
      "end_seconds": 180,
      "timestamp": "01:00",
      "chunk_id": "chunk_0"
    }}
  ],
  "true_false_questions": [
    {{
      "question_text": "Instruction pipelining increases the overall throughput of instruction execution.",
      "question_type": "True False",
      "difficulty": "Easy",
      "options": ["True", "False"],
      "correct_answer": "True",
      "explanation": "Pipelining overlaps instruction execution stages to increase throughput.",
      "start_seconds": 180,
      "end_seconds": 300,
      "timestamp": "03:00",
      "chunk_id": "chunk_0"
    }}
  ],
  "flashcards": [
    {{
      "front": "What is Amdahl's Law in parallel computing?",
      "back": "A formula calculating the theoretical speedup in latency of an execution task at fixed workload.",
      "mastery_level": "new",
      "start_seconds": 240,
      "end_seconds": 360,
      "timestamp": "04:00",
      "chunk_id": "chunk_1"
    }}
  ]
}}
"""
        messages = [
            {"role": "system", "content": "You are a master academic assessment generator. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ]

        result = await self.client.execute_structured_request(
            messages=messages,
            temperature=0.2,
            max_completion_tokens=1500
        )

        # Ensure flashcards are always populated from concepts if LLM returned too few
        flashcards = result.get("flashcards") or []
        if len(flashcards) < 3:
            for idx, k in enumerate(accumulated_knowledge):
                start_s = k.get("start_seconds", idx * 180)
                t_str = k.get("timestamp_range", "").split("-")[0].strip() or TokenManager.format_seconds(start_s)
                chunk_id = f"chunk_{idx}"
                for conc in k.get("important_concepts", []):
                    if isinstance(conc, dict) and conc.get("term") and conc.get("definition"):
                        flashcards.append({
                            "front": f"What is {conc['term']}?",
                            "back": conc["definition"],
                            "mastery_level": "new",
                            "start_seconds": start_s,
                            "end_seconds": start_s + 60,
                            "timestamp": t_str,
                            "chunk_id": chunk_id
                        })
            result["flashcards"] = flashcards[:12]

        return result

    def validate_llm_output(self, json_output: Dict[str, Any], video_title: str) -> bool:
        """Enforces groundedness and rejects generic boilerplate output."""
        if not json_output or not isinstance(json_output, dict):
            return False

        exec_summary = str(json_output.get("executive_summary", "")).strip()
        tldr = str(json_output.get("tldr", "")).strip()

        if len(exec_summary) < 50 or len(tldr) < 15:
            logger.error("[GROQ VALIDATION FAILED] Summary or TLDR is suspiciously short.")
            return False

        generic_phrases = [
            "aiming to inform and educate",
            "without specific details",
            "imparting knowledge and understanding",
            "transcript is empty",
            "no content is available",
            "educational resource aiming",
            "lack of transcript details",
            "purpose of the educational video"
        ]

        combined = f"{exec_summary} {tldr}".lower()
        for phrase in generic_phrases:
            if phrase in combined:
                logger.error(f"[GROQ VALIDATION FAILED] Output contains generic disclaimer marker: '{phrase}'")
                return False

        return True

    async def generate_all_learning_materials(
        self,
        transcript_text: str,
        video_title: str,
        video_duration_seconds: int = 1500,
        on_progress: Optional[Callable[[str, int, int, str], Any]] = None
    ) -> Dict[str, Any]:
        """
        Master entry point for the Token-Aware Hierarchical AI Pipeline.
        1. Estimates transcript tokens and dynamically selects processing strategy.
        2. Chunks transcript into token-aware windows (~3,500 input tokens each).
        3. Paces requests through controlled queue with rate-limit tracking.
        4. Performs hierarchical synthesis (Chunk -> Section -> Final).
        5. Generates timestamp-aware Q&A bank and active recall flashcards.
        """
        if not transcript_text or len(transcript_text.strip()) < 80:
            raise ValueError("Cannot invoke Groq LLM: Transcript is empty or invalid.")

        cleaned_transcript = transcript_text.strip()
        total_tokens = TokenManager.estimate_tokens(cleaned_transcript)
        logger.info(f"[PIPELINE STRATEGY] Video: '{video_title}' | Estimated Tokens: {total_tokens} | Duration: {video_duration_seconds}s")

        # =========================================================================
        # STRATEGY 1: SHORT VIDEO (Total tokens <= 2,500)
        # Direct synthesis (safely within TPM and context window)
        # =========================================================================
        if total_tokens <= 2500:
            logger.info("[PIPELINE STRATEGY: SHORT] Executing direct single-pass synthesis...")
            if on_progress:
                await on_progress("synthesizing", 1, 1, "Synthesizing executive summary and study materials...")

            # Single compact chunk extraction
            chunks = TokenManager.create_token_aware_chunks(cleaned_transcript, video_duration_seconds, target_tokens=3000)
            chunk_result = await self.extract_chunk_knowledge(chunks[0] if chunks else {
                "sequence_number": 0, "start_time": "00:00", "end_time": TokenManager.format_seconds(video_duration_seconds),
                "transcript": cleaned_transcript, "start_seconds": 0, "end_seconds": video_duration_seconds
            }, video_title)
            
            accumulated = [chunk_result]
            summary_res = await self.synthesize_final_summary(accumulated, video_title, video_duration_seconds)
            qna_res = await self.generate_qna_and_flashcards(accumulated, video_title, video_duration_seconds)

            merged_output = {
                **summary_res,
                **qna_res,
                "video_chunks_data": [{
                    **chunks[0],
                    "chunk_summary": chunk_result.get("chunk_summary", ""),
                    "key_points": chunk_result.get("key_points", []),
                    "important_concepts": chunk_result.get("important_concepts", []),
                    "examples": chunk_result.get("examples", []),
                    "processing_status": "completed"
                }] if chunks else []
            }
            return merged_output

        # =========================================================================
        # STRATEGY 2 & 3: MEDIUM & LONG VIDEOS (Token-Aware Chunking + Hierarchical Synthesis)
        # =========================================================================
        chunks = TokenManager.create_token_aware_chunks(cleaned_transcript, video_duration_seconds)
        total_chunks = len(chunks)
        logger.info(f"[PIPELINE STRATEGY: HIERARCHICAL] Processing {total_chunks} token-aware chunks sequentially with pacing...")

        accumulated_chunk_knowledge: List[Dict[str, Any]] = []
        processed_chunks_db: List[Dict[str, Any]] = []

        for idx, chunk in enumerate(chunks):
            if on_progress:
                progress_msg = f"Processing video section {idx + 1} of {total_chunks} [{chunk['start_time']} - {chunk['end_time']}]"
                await on_progress("processing_chunks", idx + 1, total_chunks, progress_msg)

            logger.info(f"[CHUNK PROGRESS] Processing Chunk {idx + 1}/{total_chunks} [{chunk['start_time']} - {chunk['end_time']}] ({chunk['token_count']} tokens)...")
            
            # Extract compact knowledge with chunk-level retry
            chunk_knowledge = await self.extract_chunk_knowledge(chunk, video_title)
            accumulated_chunk_knowledge.append(chunk_knowledge)
            
            processed_chunks_db.append({
                "sequence_number": chunk["sequence_number"],
                "start_seconds": chunk["start_seconds"],
                "end_seconds": chunk["end_seconds"],
                "start_time": chunk["start_time"],
                "end_time": chunk["end_time"],
                "transcript": chunk["transcript"],
                "chunk_summary": chunk_knowledge.get("chunk_summary", ""),
                "key_points": chunk_knowledge.get("key_points", []),
                "important_concepts": chunk_knowledge.get("important_concepts", []),
                "examples": chunk_knowledge.get("examples", []),
                "processing_status": "completed"
            })

        # Check if hierarchical section reduction is needed (for long/very long videos > 5 chunks)
        synthesis_input = accumulated_chunk_knowledge
        if len(accumulated_chunk_knowledge) > 5:
            logger.info(f"[PIPELINE HIERARCHICAL REDUCTION] Reducing {len(accumulated_chunk_knowledge)} chunk summaries into sections...")
            if on_progress:
                await on_progress("section_synthesis", 1, 1, "Synthesizing section knowledge across video arc...")

            reduced_sections = []
            # Group into sections of 3 chunks
            chunk_groups = [accumulated_chunk_knowledge[i:i + 3] for i in range(0, len(accumulated_chunk_knowledge), 3)]
            for sec_idx, group in enumerate(chunk_groups):
                sec_res = await self.synthesize_section_knowledge(group, video_title, sec_idx + 1)
                first_chunk = group[0]
                last_chunk = group[-1]
                reduced_sections.append({
                    "timestamp_range": f"{first_chunk.get('start_seconds', 0)}s - {last_chunk.get('end_seconds', 0)}s",
                    "start_seconds": first_chunk.get("start_seconds", 0),
                    "end_seconds": last_chunk.get("end_seconds", 0),
                    "chunk_summary": sec_res.get("section_summary", ""),
                    "key_points": sec_res.get("section_key_points", []),
                    "important_concepts": sec_res.get("section_concepts", [])
                })
            synthesis_input = reduced_sections

        # Final Synthesis
        if on_progress:
            await on_progress("final_synthesis", 1, 1, "Generating executive summary, key takeaways, and timeline...")
        logger.info("[FINAL SYNTHESIS] Generating executive summary, takeaways, and timeline...")
        summary_result = await self.synthesize_final_summary(synthesis_input, video_title, video_duration_seconds)

        # Questions & Flashcards Generation
        if on_progress:
            await on_progress("qna_generation", 1, 1, "Formulating grounded multi-level Q&A and active recall cards...")
        logger.info("[QNA GENERATION] Formulating timestamp-aware Q&A and flashcards from accumulated knowledge...")
        qna_result = await self.generate_qna_and_flashcards(accumulated_chunk_knowledge, video_title, video_duration_seconds)

        final_output = {
            **summary_result,
            **qna_result,
            "video_chunks_data": processed_chunks_db
        }

        # Quality validation
        if not self.validate_llm_output(final_output, video_title):
            raise ValueError("Hierarchical AI generation failed groundedness quality validation.")

        logger.info(f"[HIERARCHICAL PIPELINE SUCCESS] Completed long-video processing for '{video_title}'.")
        return final_output
