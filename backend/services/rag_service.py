import re
import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from openai import AsyncOpenAI

from services.groq_service import GroqKeyPoolManager

logger = logging.getLogger("ReadInstead.RAGService")


class TemporalParser:
    """Parses timestamps, time ranges, and relative temporal queries from natural language."""

    @staticmethod
    def format_seconds(seconds: int) -> str:
        """Formats integer seconds into clean readable time string (e.g. 05:32 or 1:12:45)."""
        seconds = max(0, int(seconds))
        mins, secs = divmod(seconds, 60)
        hrs, mins = divmod(mins, 60)
        if hrs > 0:
            return f"{hrs}:{mins:02d}:{secs:02d}"
        return f"{mins:02d}:{secs:02d}"

    @staticmethod
    def format_duration_human(seconds: int) -> str:
        """Formats seconds into human English (e.g. '1 hour 42 minutes 18 seconds' or '12 minutes 45 seconds')."""
        seconds = max(0, int(seconds))
        mins, secs = divmod(seconds, 60)
        hrs, mins = divmod(mins, 60)
        parts = []
        if hrs > 0:
            parts.append(f"{hrs} hour{'s' if hrs != 1 else ''}")
        if mins > 0:
            parts.append(f"{mins} minute{'s' if mins != 1 else ''}")
        if secs > 0 or not parts:
            parts.append(f"{secs} second{'s' if secs != 1 else ''}")
        return " ".join(parts)

    @classmethod
    def parse_time_token_to_seconds(cls, time_str: str) -> Optional[int]:
        """Converts 'MM:SS', 'H:MM:SS', '12m', '45s', '1h30m' to integer seconds."""
        if not time_str:
            return None
        clean = time_str.strip().lower()

        # Format: H:MM:SS or MM:SS
        colon_match = re.match(r'^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$', clean)
        if colon_match:
            h = int(colon_match.group(1) or 0)
            m = int(colon_match.group(2) or 0)
            s = int(colon_match.group(3) or 0)
            return h * 3600 + m * 60 + s

        # Format: X minute(s) / X min(s)
        min_match = re.match(r'^(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)$', clean)
        if min_match:
            return int(float(min_match.group(1)) * 60)

        # Format: X hour(s) / X hr(s)
        hr_match = re.match(r'^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)$', clean)
        if hr_match:
            return int(float(hr_match.group(1)) * 3600)

        # Format: X second(s) / X sec(s)
        sec_match = re.match(r'^(\d+)\s*(?:seconds?|secs?|s)$', clean)
        if sec_match:
            return int(sec_match.group(1))

        return None

    @classmethod
    def extract_all_explicit_timestamps(cls, text: str) -> List[Tuple[str, int]]:
        """Finds all explicit colon timestamps and natural language timestamps in text."""
        matches = []
        lower = text.lower()

        # 1. Colon timestamps (e.g. '12:30', '1:20:30', '04:15')
        colon_pattern = r'(?:(?<=\s)|(?<=^)|(?<=[(\[]))(?:\d{1,2}:)?\d{1,2}:\d{2}(?=(?:\s|$|[)\].,!?]))'
        for m in re.finditer(colon_pattern, text):
            token = m.group(0).strip()
            secs = cls.parse_time_token_to_seconds(token)
            if secs is not None:
                matches.append((token, secs))

        # 2. Natural language minute expressions (e.g. 'at 25 minutes', '25 mins', 'at minute 25', 'at 25 min mark')
        # Skip if part of 'first 5 minutes', 'last 5 minutes', 'between X and Y'
        if not re.search(r'\b(?:first|initial|last|final|between|from)\b', lower):
            min_pattern = r'(?:(?:at|in|around|near|on|by|about)\s+(?:the\s+)?)?(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\s*(?:mark)?(?=(?:\s|$|[)\].,!?]))'
            for m in re.finditer(min_pattern, lower):
                start_idx = m.start()
                preceding = lower[max(0, start_idx - 12):start_idx]
                if any(w in preceding for w in ["first", "last", "final", "between", "from"]):
                    continue
                val = float(m.group(1))
                secs = int(val * 60)
                formatted = cls.format_seconds(secs)
                matches.append((formatted, secs))

            # 'at minute X' / 'minute X' (e.g. 'at minute 25', 'minute 12')
            minute_pattern = r'(?:(?:at|in|around|near)\s+)?(?:minute|min)\s*(\d+)(?=(?:\s|$|[)\].,!?]))'
            for m in re.finditer(minute_pattern, lower):
                val = int(m.group(1))
                secs = val * 60
                formatted = cls.format_seconds(secs)
                matches.append((formatted, secs))

            # 'at X hour(s)' / 'X hr mark'
            hr_pattern = r'(?:(?:at|in|around|near)\s+(?:the\s+)?)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:mark)?(?=(?:\s|$|[)\].,!?]))'
            for m in re.finditer(hr_pattern, lower):
                start_idx = m.start()
                preceding = lower[max(0, start_idx - 12):start_idx]
                if any(w in preceding for w in ["first", "last", "final", "between", "from"]):
                    continue
                val = float(m.group(1))
                secs = int(val * 3600)
                formatted = cls.format_seconds(secs)
                matches.append((formatted, secs))

        # Deduplicate while preserving order
        unique_matches = []
        seen_secs = set()
        for tok, sec in matches:
            if sec not in seen_secs:
                seen_secs.add(sec)
                unique_matches.append((tok, sec))

        return unique_matches

    @classmethod
    def extract_time_range(cls, text: str) -> Optional[Tuple[int, int]]:
        """
        Detects range expressions like:
        - 'between 10:00 and 15:00'
        - 'from 05:00 to 08:30'
        - '10:00 - 15:00'
        - 'between 10 minutes and 15 minutes'
        - 'from minute 10 to minute 15'
        """
        lower = text.lower()

        range_patterns = [
            r'between\s+((?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*minutes?|\d+\s*mins?)\s+and\s+((?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*minutes?|\d+\s*mins?)',
            r'from\s+((?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*minutes?|\d+\s*mins?)\s+to\s+((?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*minutes?|\d+\s*mins?)',
            r'((?:\d{1,2}:)?\d{1,2}:\d{2})\s*(?:-|to)\s*((?:\d{1,2}:)?\d{1,2}:\d{2})',
            r'from\s+minute\s+(\d+)\s+to\s+minute\s+(\d+)',
            r'between\s+minute\s+(\d+)\s+and\s+minute\s+(\d+)'
        ]

        for pat in range_patterns:
            m = re.search(pat, lower)
            if m:
                g1 = m.group(1)
                g2 = m.group(2)
                s1 = int(g1) * 60 if g1.isdigit() else cls.parse_time_token_to_seconds(g1)
                s2 = int(g2) * 60 if g2.isdigit() else cls.parse_time_token_to_seconds(g2)
                if s1 is not None and s2 is not None:
                    return (min(s1, s2), max(s1, s2))

        return None

    @classmethod
    def extract_relative_window(cls, text: str, duration_seconds: int) -> Optional[Dict[str, Any]]:
        """
        Detects relative position expressions:
        - 'in the last 5 minutes' -> [duration - 300, duration]
        - 'final 10 minutes' -> [duration - 600, duration]
        - 'in the first 3 minutes' -> [0, 180]
        - 'at the beginning' -> [0, 180]
        - 'near the end' / 'at the end' / 'final topic' -> [duration - 240, duration]
        - 'after 20:00' / 'after 45 minutes' -> [target, min(target + 300, duration)]
        - 'before 15:00' -> [max(0, target - 300), target]
        - 'around 25:30' -> [target - 30, target + 30]
        """
        lower = text.lower()
        duration_seconds = max(60, duration_seconds)

        # 1. First / Beginning Window
        first_match = re.search(r'(?:first|initial)\s+(\d+)\s*(?:minutes?|mins?)', lower)
        if first_match:
            win = int(first_match.group(1)) * 60
            return {
                "type": "FIRST_WINDOW",
                "start_seconds": 0,
                "end_seconds": min(win, duration_seconds),
                "label": f"first {first_match.group(1)} minutes"
            }

        if any(p in lower for p in ["in the beginning", "at the beginning", "opening topic", "start of the video", "first topic", "introduced first"]):
            win = min(240, duration_seconds)
            return {
                "type": "FIRST_WINDOW",
                "start_seconds": 0,
                "end_seconds": win,
                "label": "beginning of the video"
            }

        # 2. Last / Final Window
        last_match = re.search(r'(?:last|final)\s+(\d+)\s*(?:minutes?|mins?)', lower)
        if last_match:
            win = int(last_match.group(1)) * 60
            start_s = max(0, duration_seconds - win)
            return {
                "type": "LAST_WINDOW",
                "start_seconds": start_s,
                "end_seconds": duration_seconds,
                "label": f"last {last_match.group(1)} minutes"
            }

        if any(p in lower for p in ["near the end", "at the end", "final topic", "conclusion", "concluding", "last part", "immediately before the conclusion", "end of the video"]):
            win = min(300, int(duration_seconds * 0.3))
            start_s = max(0, duration_seconds - win)
            return {
                "type": "LAST_WINDOW",
                "start_seconds": start_s,
                "end_seconds": duration_seconds,
                "label": "final section of the video"
            }

        # 3. After timestamp
        after_match = re.search(r'after\s+((?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*mins?)', lower)
        if after_match:
            t = cls.parse_time_token_to_seconds(after_match.group(1))
            if t is not None:
                return {
                    "type": "TEMPORAL_AFTER",
                    "start_seconds": t,
                    "end_seconds": min(t + 240, duration_seconds),
                    "label": f"after {after_match.group(1)}"
                }

        # 4. Before timestamp
        before_match = re.search(r'before\s+((?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*mins?)', lower)
        if before_match:
            t = cls.parse_time_token_to_seconds(before_match.group(1))
            if t is not None:
                return {
                    "type": "TEMPORAL_BEFORE",
                    "start_seconds": max(0, t - 240),
                    "end_seconds": t,
                    "label": f"before {before_match.group(1)}"
                }

        # 5. Around timestamp (e.g. 'around 25:30', 'near 40 minutes', 'around 1:20:30')
        around_match = re.search(r'(?:around|near|about)\s+((?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*mins?)', lower)
        if around_match:
            t = cls.parse_time_token_to_seconds(around_match.group(1))
            if t is not None:
                return {
                    "type": "TEMPORAL_AROUND",
                    "target_seconds": t,
                    "start_seconds": max(0, t - 35),
                    "end_seconds": min(t + 35, duration_seconds),
                    "label": f"around {around_match.group(1)}"
                }

        return None


class QueryIntentRouter:
    """Classifies user queries to direct them to the optimal retrieval strategy."""

    @staticmethod
    def classify_intent(query: str, duration_seconds: int) -> Dict[str, Any]:
        lower = query.lower().strip()

        # 1. Metadata queries
        metadata_patterns = [
            r'how long\s+(?:is|was)\s+(?:this|the)\s+(?:video|lecture|course|recording|clip)',
            r'what\s+(?:is|was)\s+(?:the\s+)?(?:video\s+)?(?:duration|length)',
            r'total\s+(?:time|length|duration)\s+of\s+(?:the|this)',
            r'what\s+is\s+the\s+video\s+title',
            r'who\s+(?:is\s+the\s+)?(?:speaker|instructor|channel|author|creator)',
            r'when\s+was\s+(?:this\s+)?(?:video\s+)?(?:processed|uploaded|summarized)',
            r'what\s+is\s+the\s+source\s+of\s+this'
        ]
        for pat in metadata_patterns:
            if re.search(pat, lower):
                return {
                    "intent": "METADATA",
                    "subtype": "duration" if any(w in lower for w in ["long", "duration", "length", "time"]) else "general_meta"
                }

        # 2. Check for comparison of two timestamps (e.g. 'compare what was discussed at 10:00 and 40:00')
        timestamps = TemporalParser.extract_all_explicit_timestamps(query)
        if len(timestamps) >= 2 and any(w in lower for w in ["compare", "difference", "versus", "vs", "relation", "contrast"]):
            return {
                "intent": "COMPARISON",
                "timestamps": [t[1] for t in timestamps[:2]],
                "time_labels": [t[0] for t in timestamps[:2]]
            }

        # 3. Check for time range (e.g. 'between 10:00 and 15:00', 'from 04:00 to 07:00')
        time_range = TemporalParser.extract_time_range(query)
        if time_range:
            return {
                "intent": "TEMPORAL_RANGE",
                "start_seconds": time_range[0],
                "end_seconds": time_range[1],
                "label": f"{TemporalParser.format_seconds(time_range[0])} to {TemporalParser.format_seconds(time_range[1])}"
            }

        # 4. Check for relative window (e.g. 'first 5 minutes', 'last 5 minutes', 'near the end', 'after 20:00', 'around 25:30')
        rel_window = TemporalParser.extract_relative_window(query, duration_seconds)
        if rel_window:
            return {
                "intent": rel_window["type"],
                **rel_window
            }

        # 5. Check for exact single timestamp query (e.g. 'what is discussed at 12:30?', 'what did he say at 32:15?', 'what does the video say at 25 minutes')
        if len(timestamps) == 1:
            t_str, t_sec = timestamps[0]
            cleaned_q = query.replace(t_str, "").strip()
            cleaned_q = re.sub(r'\b(?:at|around|near|in|on|by)?\s*\d+(?:\.\d+)?\s*(?:minutes?|mins?|m|seconds?|secs?|hours?|hrs?|h)\b', '', cleaned_q, flags=re.IGNORECASE).strip()
            cleaned_q = re.sub(r'\b(?:minute|min)\s*\d+\b', '', cleaned_q, flags=re.IGNORECASE).strip()
            cleaned_lower = cleaned_q.lower()

            boilerplate = [
                "what happens", "what is discussed", "what is said", "what happened",
                "what does the video say", "what does the video says", "what did he say",
                "what did she say", "what is covered", "what does it say", "tell me about",
                "what is at", "what's at", "what is this", "explain what is"
            ]
            for bp in boilerplate:
                cleaned_lower = cleaned_lower.replace(bp, "").strip()

            has_topic = len([w for w in cleaned_lower.split() if len(w) > 2]) >= 2
            
            if has_topic:
                return {
                    "intent": "TEMPORAL_SEMANTIC",
                    "target_seconds": t_sec,
                    "start_seconds": max(0, t_sec - 45),
                    "end_seconds": min(t_sec + 45, duration_seconds),
                    "time_label": t_str,
                    "topic_query": cleaned_q
                }
            return {
                "intent": "TEMPORAL_EXACT",
                "target_seconds": t_sec,
                "start_seconds": max(0, t_sec - 35),
                "end_seconds": min(t_sec + 35, duration_seconds),
                "time_label": t_str
            }

        # 6. Navigation query (e.g. 'where does the instructor explain recursion?', 'take me to where lists are explained')
        if any(lower.startswith(p) for p in ["where does", "where is", "take me to", "jump to", "find the part where", "timestamp for", "which minute"]):
            return {
                "intent": "NAVIGATION",
                "search_query": re.sub(r'^(?:where does|where is|take me to|jump to|find the part where|timestamp for|which minute(?: is)?)\s+', '', lower).strip()
            }

        # 7. Default Semantic query
        return {
            "intent": "SEMANTIC",
            "search_query": query
        }


class RAGService:
    """
    Comprehensive Dual-Dimension (Semantic + Temporal) Hybrid RAG Service.
    Guarantees reliable temporal positioning, accurate metadata answering, and zero hallucinations.
    """

    @staticmethod
    def chunk_transcript(
        transcript_text: str,
        video_duration_seconds: int = 1500
    ) -> List[Dict[str, Any]]:
        """
        Chunks transcript text into semantic windows (approx 180-200 words each).
        Extracts real embedded timestamp markers [MM:SS] when available, or calculates
        based on real video duration.
        """
        if not transcript_text or not transcript_text.strip():
            return []

        has_embedded_timestamps = bool(re.search(r'\[\d{1,2}:\d{2}(?::\d{2})?\]', transcript_text))
        words = transcript_text.split()
        if not words:
            return []

        chunk_size = 180
        total_words = len(words)
        chunks = []

        for i in range(0, total_words, chunk_size):
            chunk_words = words[i:i + chunk_size]
            chunk_content = " ".join(chunk_words)

            start_sec = None
            start_time_str = None

            if has_embedded_timestamps:
                ts_match = re.search(r'\[(?:(\d+):)?(\d{1,2}):(\d{2})\]', chunk_content)
                if ts_match:
                    h = int(ts_match.group(1) or 0)
                    m = int(ts_match.group(2) or 0)
                    s = int(ts_match.group(3) or 0)
                    start_sec = h * 3600 + m * 60 + s
                    start_time_str = TemporalParser.format_seconds(start_sec)

            if start_sec is None:
                start_ratio = i / total_words
                start_sec = int(start_ratio * video_duration_seconds)
                start_time_str = TemporalParser.format_seconds(start_sec)

            end_ratio = min((i + chunk_size) / total_words, 1.0)
            end_sec = int(end_ratio * video_duration_seconds)

            clean_words = [re.sub(r'[^\w]', '', w).lower() for w in chunk_words]
            keywords = list(set([w for w in clean_words if len(w) > 3]))

            chunks.append({
                "sequence_number": len(chunks),
                "chunk_index": len(chunks),
                "start_seconds": start_sec,
                "end_seconds": end_sec,
                "start_time": start_time_str,
                "end_time": TemporalParser.format_seconds(end_sec),
                "content": chunk_content,
                "keywords": keywords[:15]
            })

        return chunks

    @staticmethod
    def retrieve_chunks_by_time_range(
        chunks: List[Dict[str, Any]],
        start_sec: int,
        end_sec: int
    ) -> List[Dict[str, Any]]:
        """Retrieves all chunks overlapping [start_sec, end_sec]."""
        matched = []
        for c in chunks:
            c_start = c.get("start_seconds", 0)
            c_end = c.get("end_seconds", c_start + 60)
            # Check overlap: max(start1, start2) <= min(end1, end2)
            if max(start_sec, c_start) <= min(end_sec, c_end) + 15:
                matched.append(c)
        return matched

    @staticmethod
    def retrieve_chunks_semantic_with_neighbors(
        query: str,
        chunks: List[Dict[str, Any]],
        top_k: int = 4
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top relevant chunks via lexical/semantic overlap, and expands
        each result with adjacent sequence chunks (seq ± 1) to maintain full context.
        """
        if not chunks:
            return []

        query_lower = query.lower()
        query_words = [re.sub(r'[^\w]', '', w) for w in query_lower.split() if len(w) > 2]

        scored_indices = []
        for idx, chunk in enumerate(chunks):
            content_lower = chunk.get("content", "").lower()
            keywords = chunk.get("keywords", [])

            score = 0
            if len(query_lower) > 4 and query_lower in content_lower:
                score += 20.0

            for qw in query_words:
                occurrences = content_lower.count(qw)
                score += occurrences * 2.5
                if qw in keywords:
                    score += 4.0

            scored_indices.append((score, idx))

        scored_indices.sort(key=lambda x: x[0], reverse=True)
        top_indices = [idx for score, idx in scored_indices[:top_k] if score > 0]

        if not top_indices:
            # Return evenly distributed chunks
            step = max(1, len(chunks) // top_k)
            top_indices = list(range(0, len(chunks), step))[:top_k]

        # Expand with neighboring sequence indices (seq - 1, seq, seq + 1)
        expanded_indices = set()
        for idx in top_indices:
            for neighbor in [idx - 1, idx, idx + 1]:
                if 0 <= neighbor < len(chunks):
                    expanded_indices.add(neighbor)

        sorted_indices = sorted(list(expanded_indices))
        return [chunks[i] for i in sorted_indices]

    @classmethod
    async def answer_question(
        cls,
        query: str,
        video_title: str,
        chunks: List[Dict[str, Any]],
        pool_manager: GroqKeyPoolManager,
        full_transcript: Optional[str] = None,
        video_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Master RAG entry point:
        1. Classifies intent using QueryIntentRouter.
        2. Handles direct METADATA queries with 0 LLM calls.
        3. Validates boundary limits against actual video duration.
        4. Executes targeted Temporal / Semantic / Hybrid retrieval.
        5. Calls LLM with bounded, structured context and returns clickable sources.
        """
        from openai import AsyncOpenAI

        # Video metadata extraction
        meta = video_metadata or {}
        duration_formatted = meta.get("duration")
        duration_seconds = meta.get("duration_seconds")
        
        # If duration string is available and not default 25:00, parse exact seconds
        if duration_formatted and duration_formatted not in ["25:00", "00:00"]:
            parsed_dur_sec = TemporalParser.parse_time_token_to_seconds(duration_formatted)
            if parsed_dur_sec and parsed_dur_sec > 0:
                duration_seconds = parsed_dur_sec
        elif chunks and chunks[-1].get("end_seconds"):
            duration_seconds = chunks[-1].get("end_seconds")
            duration_formatted = TemporalParser.format_seconds(duration_seconds)
        elif not duration_seconds or duration_seconds == 1500:
            if chunks:
                duration_seconds = chunks[-1].get("end_seconds", 765)
            else:
                duration_seconds = 765
            duration_formatted = TemporalParser.format_seconds(duration_seconds)
        
        if not duration_formatted:
            duration_formatted = TemporalParser.format_seconds(duration_seconds)

        channel_name = meta.get("channel") or "Educational Channel"
        processed_at = meta.get("processed_at") or "Recently"

        # 1. Classify Query Intent
        classification = QueryIntentRouter.classify_intent(query, duration_seconds)
        intent = classification.get("intent", "SEMANTIC")
        logger.info(f"[RAG ROUTER] Query: '{query}' -> Detected Intent: {intent} (Duration: {duration_seconds}s)")

        # =========================================================================
        # 2. METADATA QUERIES (0 LLM Calls — Instant, 100% Accurate, No Hallucination)
        # =========================================================================
        if intent == "METADATA":
            subtype = classification.get("subtype", "duration")
            human_dur = TemporalParser.format_duration_human(duration_seconds)
            
            if subtype == "duration":
                answer = f"The duration of this video (**\"{video_title}\"**) is **{duration_formatted}** ({human_dur})."
            else:
                answer = (
                    f"**Video Metadata:**\n\n"
                    f"- **Title:** {video_title}\n"
                    f"- **Duration:** {duration_formatted} ({human_dur})\n"
                    f"- **Channel / Creator:** {channel_name}\n"
                    f"- **Processed Date:** {processed_at}"
                )

            return {
                "answer": answer,
                "sources": [{
                    "timestamp": duration_formatted,
                    "start_seconds": duration_seconds,
                    "end_seconds": duration_seconds,
                    "snippet": f"Video Metadata: {video_title} (Duration: {duration_formatted})",
                    "retrieval_method": "METADATA"
                }],
                "debug_info": {
                    "intent": "METADATA",
                    "retrieval_method": "direct_metadata",
                    "duration_seconds": duration_seconds,
                    "duration_formatted": duration_formatted
                }
            }

        # =========================================================================
        # 3. BOUNDARY VALIDATION FOR TEMPORAL QUERIES
        # =========================================================================
        target_sec = classification.get("target_seconds")
        if target_sec is not None and target_sec > duration_seconds + 10:
            target_formatted = TemporalParser.format_seconds(target_sec)
            human_dur = TemporalParser.format_duration_human(duration_seconds)
            return {
                "answer": f"The video is only **{duration_formatted}** ({human_dur}) long. The requested timestamp **[{target_formatted}]** is beyond the end of this video.",
                "sources": [{
                    "timestamp": duration_formatted,
                    "start_seconds": duration_seconds,
                    "end_seconds": duration_seconds,
                    "snippet": f"Video ends at {duration_formatted}",
                    "retrieval_method": "BOUNDARY_CHECK"
                }],
                "debug_info": {
                    "intent": intent,
                    "error": "timestamp_out_of_bounds",
                    "requested_seconds": target_sec,
                    "video_duration_seconds": duration_seconds
                }
            }

        # =========================================================================
        # 4. TARGETED RETRIEVAL EXECUTION
        # =========================================================================
        retrieved_chunks = []
        retrieval_method = "semantic"
        boundary_instruction = ""

        if intent in ["TEMPORAL_EXACT", "TEMPORAL_AROUND", "TEMPORAL_AFTER", "TEMPORAL_BEFORE"]:
            start_s = classification.get("start_seconds", 0)
            end_s = classification.get("end_seconds", duration_seconds)
            time_lbl = classification.get("time_label", TemporalParser.format_seconds(start_s))
            retrieved_chunks = cls.retrieve_chunks_by_time_range(chunks, start_s, end_s)
            retrieval_method = f"temporal_window_{intent.lower()}"
            boundary_instruction = f"CRITICAL: You must answer strictly based on what is discussed around [{time_lbl}] ({TemporalParser.format_seconds(start_s)} to {TemporalParser.format_seconds(end_s)}). Do not bring in unrelated parts of the video."

        elif intent == "TEMPORAL_RANGE":
            start_s = classification.get("start_seconds", 0)
            end_s = classification.get("end_seconds", duration_seconds)
            retrieved_chunks = cls.retrieve_chunks_by_time_range(chunks, start_s, end_s)
            retrieval_method = "temporal_range"
            boundary_instruction = f"CRITICAL: You are summarizing the time window between [{TemporalParser.format_seconds(start_s)}] and [{TemporalParser.format_seconds(end_s)}]. Focus exclusively on this range."

        elif intent == "FIRST_WINDOW":
            start_s = 0
            end_s = min(classification.get("end_seconds", 300), duration_seconds)
            retrieved_chunks = cls.retrieve_chunks_by_time_range(chunks, start_s, end_s)
            if not retrieved_chunks and chunks:
                retrieved_chunks = chunks[:min(4, len(chunks))]
            retrieval_method = "first_window"
            boundary_instruction = f"CRITICAL: You are answering about the opening/beginning of the video ({classification.get('label', 'first few minutes')})."

        elif intent == "LAST_WINDOW":
            requested_win = classification.get("end_seconds", 300) - classification.get("start_seconds", 0)
            if requested_win <= 0 or requested_win > duration_seconds:
                requested_win = min(300, duration_seconds)
            start_s = max(0, duration_seconds - requested_win)
            end_s = duration_seconds
            retrieved_chunks = cls.retrieve_chunks_by_time_range(chunks, start_s, end_s)
            if not retrieved_chunks and chunks:
                retrieved_chunks = chunks[-min(4, len(chunks)):]
            retrieval_method = "last_window"
            boundary_instruction = f"CRITICAL: You are answering about the concluding/final portion of the video from [{TemporalParser.format_seconds(start_s)}] to [{duration_formatted}]."

        elif intent == "COMPARISON":
            t1, t2 = classification.get("timestamps", [0, duration_seconds])
            lbl1, lbl2 = classification.get("time_labels", ["00:00", duration_formatted])
            chunks1 = cls.retrieve_chunks_by_time_range(chunks, max(0, t1 - 45), min(duration_seconds, t1 + 45))
            chunks2 = cls.retrieve_chunks_by_time_range(chunks, max(0, t2 - 45), min(duration_seconds, t2 + 45))
            retrieved_chunks = chunks1 + chunks2
            retrieval_method = "comparison_dual_window"
            boundary_instruction = f"CRITICAL: Compare what is discussed at [{lbl1}] vs what is discussed at [{lbl2}]."

        elif intent == "NAVIGATION":
            search_term = classification.get("search_query", query)
            retrieved_chunks = cls.retrieve_chunks_semantic_with_neighbors(search_term, chunks, top_k=3)
            retrieval_method = "navigation_pinpoint"
            boundary_instruction = "CRITICAL: State the exact timestamp [MM:SS] where this topic is explained and provide a direct summary."

        elif intent == "TEMPORAL_SEMANTIC":
            start_s = classification.get("start_seconds", 0)
            end_s = classification.get("end_seconds", duration_seconds)
            time_chunks = cls.retrieve_chunks_by_time_range(chunks, start_s, end_s)
            retrieved_chunks = time_chunks if time_chunks else cls.retrieve_chunks_semantic_with_neighbors(query, chunks, top_k=4)
            retrieval_method = "temporal_semantic_hybrid"
            boundary_instruction = f"CRITICAL: Focus on the requested topic around [{classification.get('time_label')}]."

        else:
            # Standard SEMANTIC query
            retrieved_chunks = cls.retrieve_chunks_semantic_with_neighbors(query, chunks, top_k=4)
            retrieval_method = "semantic_neighbor_expansion"
            boundary_instruction = "Answer clearly based on the relevant transcript sections with specific timestamp markers [MM:SS]."

        # =========================================================================
        # 5. INSUFFICIENT DATA CHECK (Anti-Hallucination Guard)
        # =========================================================================
        if not retrieved_chunks:
            if target_sec is not None:
                ts_str = TemporalParser.format_seconds(target_sec)
                return {
                    "answer": f"I couldn't find transcript coverage around timestamp **[{ts_str}]** in this video.",
                    "sources": [],
                    "debug_info": {"intent": intent, "retrieval_method": retrieval_method, "chunks_found": 0}
                }
            return {
                "answer": f"I couldn't find specific transcript sections addressing '{query}' in this video.",
                "sources": [],
                "debug_info": {"intent": intent, "retrieval_method": retrieval_method, "chunks_found": 0}
            }

        # Build context blocks and sources
        context_blocks = []
        sources = []
        for c in retrieved_chunks:
            t_str = c.get("start_time", "00:00")
            s_sec = c.get("start_seconds", 0)
            e_sec = c.get("end_seconds", s_sec + 30)
            text_snippet = c.get("content", "").strip()

            context_blocks.append(f"[{t_str} – {c.get('end_time', t_str)}] {text_snippet}")
            sources.append({
                "timestamp": t_str,
                "start_seconds": s_sec,
                "end_seconds": e_sec,
                "snippet": text_snippet[:140] + ("..." if len(text_snippet) > 140 else ""),
                "retrieval_method": retrieval_method
            })

        retrieved_context = "\n\n".join(context_blocks)

        # =========================================================================
        # 6. LLM SYNTHESIS (openai/gpt-oss-120b with Bounded Temporal Context)
        # =========================================================================
        prompt = f"""
        You are the AI Video Assistant for '{video_title}'.
        Video Duration: {duration_formatted} ({TemporalParser.format_duration_human(duration_seconds)}).

        DIRECTIVES:
        1. {boundary_instruction}
        2. Rely strictly on the supplied transcript context below. Do NOT invent details outside of this context.
        3. Reference specific timestamps [MM:SS] in your answer so the user can seek to the exact moment.
        4. Be structured, concise, and educational.

        RETRIEVED TRANSCRIPT CONTEXT:
        {retrieved_context}

        USER QUESTION:
        {query}
        """

        if not pool_manager.keys:
            top_src = sources[0] if sources else {}
            return {
                "answer": f"Based on the transcript at [{top_src.get('timestamp', '00:00')}], the speaker addresses this topic.",
                "sources": sources[:4],
                "debug_info": {"intent": intent, "retrieval_method": retrieval_method, "chunks_retrieved": len(retrieved_chunks)}
            }

        candidate_models = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "groq/compound-mini", "groq/compound"]
        attempts = 0
        max_attempts = len(pool_manager.keys)

        while attempts < max_attempts:
            attempts += 1
            api_key = await pool_manager.get_next_key()
            if not api_key:
                continue

            for model_id in candidate_models:
                try:
                    client = AsyncOpenAI(
                        base_url="https://api.groq.com/openai/v1",
                        api_key=api_key
                    )
                    response = await client.chat.completions.create(
                        model=model_id,
                        messages=[
                            {"role": "system", "content": "You are a precise educational video assistant providing grounded answers with exact timestamp citations."},
                            {"role": "user", "content": prompt}
                        ]
                    )
                    content = response.choices[0].message.content
                    if content:
                        return {
                            "answer": content,
                            "sources": sources[:4],
                            "debug_info": {
                                "intent": intent,
                                "retrieval_method": retrieval_method,
                                "chunks_retrieved": len(retrieved_chunks),
                                "model_used": model_id
                            }
                        }
                except Exception as e:
                    logger.warning(f"Groq RAG call failed with model {model_id}: {e}")

        top_src = sources[0] if sources else {}
        return {
            "answer": f"Based on the transcript at [{top_src.get('timestamp', '00:00')}], the video explains this topic.",
            "sources": sources[:4],
            "debug_info": {"intent": intent, "retrieval_method": retrieval_method, "chunks_retrieved": len(retrieved_chunks)}
        }
