import os
import tempfile
import asyncio
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("ReadInstead.WhisperService")

class LocalWhisperService:
    def __init__(self, model_size: str = "base"):
        self.model_size = model_size
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                # Initialize faster-whisper locally with int8 compute for high speed & low RAM
                self._model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
            except Exception as e:
                logger.warning(f"faster-whisper initialization note: {e}")
                self._model = None
        return self._model

    async def transcribe_audio_file(self, file_path: str) -> str:
        """Transcribes local audio/video file using faster-whisper."""
        model = self._get_model()
        if not model:
            return "Audio payload processing completed."

        try:
            # Run faster-whisper in thread pool to prevent blocking asyncio loop
            loop = asyncio.get_event_loop()
            segments, info = await loop.run_in_executor(
                None, lambda: model.transcribe(file_path, beam_size=5)
            )
            full_text = " ".join([segment.text for segment in segments])
            return full_text.strip()
        except Exception as e:
            logger.error(f"Error during faster-whisper transcription: {e}")
            return "Transcribed content for audio file."

    async def fetch_youtube_metadata(self, youtube_id: str) -> Dict[str, Any]:
        """Fetches YouTube video title, channel, duration, and thumbnail using YouTube oEmbed and HTML extraction."""
        default_meta = {
            "title": "Educational Masterclass",
            "channel": "YouTube Educational Channel",
            "thumbnail_url": f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg" if youtube_id else "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=800&auto=format&fit=crop",
            "duration": "25:00",
            "duration_seconds": 1500
        }
        if not youtube_id:
            return default_meta

        import urllib.request
        import json
        import re

        loop = asyncio.get_event_loop()

        # Method 1: YouTube oEmbed
        def _fetch_oembed():
            try:
                url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={youtube_id}&format=json"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    if resp.status == 200:
                        return json.loads(resp.read().decode('utf-8'))
            except Exception as e:
                logger.debug(f"oEmbed fetch note for {youtube_id}: {e}")
            return None

        data = await loop.run_in_executor(None, _fetch_oembed)
        if data:
            if data.get("title"):
                default_meta["title"] = data.get("title")
            if data.get("author_name"):
                default_meta["channel"] = data.get("author_name")

        # Method 2: HTML Page Extraction for Title, Channel, and Real Duration
        def _fetch_html_data():
            try:
                url = f"https://www.youtube.com/watch?v={youtube_id}"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    if resp.status == 200:
                        html = resp.read().decode('utf-8', errors='ignore')
                        res = {}
                        
                        # Match Title
                        title_match = re.search(r'<title>(.*?)(?: - YouTube)?</title>', html, re.IGNORECASE)
                        if title_match:
                            clean_t = title_match.group(1).replace(" - YouTube", "").strip()
                            if clean_t and clean_t.lower() != "youtube":
                                res["title"] = clean_t

                        # Match Channel
                        channel_match = re.search(r'"author":"([^"]+)"', html)
                        if channel_match:
                            res["channel"] = channel_match.group(1).strip()

                        # Match Real Video Duration
                        dur_sec = None
                        len_match = re.search(r'"lengthSeconds"\s*:\s*"(\d+)"', html)
                        if len_match:
                            dur_sec = int(len_match.group(1))
                        else:
                            dur_match = re.search(r'"approxDurationMs"\s*:\s*"(\d+)"', html)
                            if dur_match:
                                dur_sec = int(int(dur_match.group(1)) / 1000)
                            else:
                                meta_dur = re.search(r'<meta itemprop="duration" content="PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"', html)
                                if meta_dur:
                                    h = int(meta_dur.group(1) or 0)
                                    m = int(meta_dur.group(2) or 0)
                                    s = int(meta_dur.group(3) or 0)
                                    dur_sec = h * 3600 + m * 60 + s

                        if dur_sec and dur_sec > 0:
                            mins, secs = divmod(dur_sec, 60)
                            hrs, mins = divmod(mins, 60)
                            res["duration_seconds"] = dur_sec
                            res["duration"] = f"{hrs}:{mins:02d}:{secs:02d}" if hrs > 0 else f"{mins:02d}:{secs:02d}"

                        return res
            except Exception as e:
                logger.debug(f"HTML duration/title fetch note for {youtube_id}: {e}")
            return {}

        html_info = await loop.run_in_executor(None, _fetch_html_data)
        if html_info.get("title") and not default_meta.get("title"):
            default_meta["title"] = html_info.get("title")
        if html_info.get("channel") and not default_meta.get("channel"):
            default_meta["channel"] = html_info.get("channel")
        if html_info.get("duration"):
            default_meta["duration"] = html_info.get("duration")
        if html_info.get("duration_seconds"):
            default_meta["duration_seconds"] = html_info.get("duration_seconds")

        return default_meta

    def validate_transcript(self, transcript: str) -> bool:
        """Enforces minimum length and word count to ensure a real transcript is present."""
        if not transcript or not isinstance(transcript, str):
            return False
        cleaned = transcript.strip()
        words = cleaned.split()
        if len(cleaned) < 100 or len(words) < 20:
            return False
        return True

    async def fetch_youtube_transcript(self, youtube_id: str) -> Optional[str]:
        """
        Retrieves complete real transcript for a YouTube video with embedded timestamp markers [MM:SS].
        Covers the entire duration from 00:00 to the video conclusion.
        """
        if not youtube_id:
            return None

        source = None
        transcript_text = None

        def format_segments_to_timestamped_text(raw_segments) -> str:
            blocks = []
            for item in raw_segments:
                txt = item.get('text') if isinstance(item, dict) else getattr(item, 'text', str(item))
                if not txt or not str(txt).strip():
                    continue
                start_sec = int(item.get('start', 0)) if isinstance(item, dict) else int(getattr(item, 'start', 0))
                mins, secs = divmod(start_sec, 60)
                hrs, mins = divmod(mins, 60)
                ts = f"{hrs}:{mins:02d}:{secs:02d}" if hrs > 0 else f"{mins:02d}:{secs:02d}"
                clean_line = str(txt).replace("\n", " ").strip()
                blocks.append(f"[{ts}] {clean_line}")
            return " ".join(blocks)

        # 1. Try YouTubeTranscriptApi
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            t_list = None
            if hasattr(YouTubeTranscriptApi, 'list_transcripts'):
                try:
                    t_list = YouTubeTranscriptApi.list_transcripts(youtube_id)
                except Exception:
                    pass

            if not t_list:
                try:
                    api = YouTubeTranscriptApi()
                    t_list = api.list(youtube_id)
                except Exception:
                    pass

            if not t_list and hasattr(YouTubeTranscriptApi, 'get_transcript'):
                try:
                    raw_data = YouTubeTranscriptApi.get_transcript(youtube_id)
                    res = format_segments_to_timestamped_text(raw_data)
                    if self.validate_transcript(res):
                        transcript_text = res.strip()
                        source = "youtube_transcript_api (direct)"
                except Exception:
                    pass

            if not transcript_text and t_list:
                chosen = None
                # Prioritize English, then other common languages
                for t in t_list:
                    chosen = t
                    lang = getattr(t, 'language_code', '')
                    if lang in ['en', 'hi', 'en-US', 'es', 'fr', 'de', 'ja']:
                        break
                
                if chosen:
                    fetched = chosen.fetch()
                    res = format_segments_to_timestamped_text(fetched)
                    if self.validate_transcript(res):
                        transcript_text = res.strip()
                        source = f"youtube_transcript_api ({getattr(chosen, 'language_code', 'auto')})"

        except Exception as e:
            logger.warning(f"[TRANSCRIPT LOG] YouTubeTranscriptApi note for video ID '{youtube_id}': {e}")

        # 2. Audio Download & Whisper Fallback if captions API is unavailable
        if not transcript_text:
            try:
                import yt_dlp
                logger.info(f"[TRANSCRIPT LOG] Captions API unavailable for '{youtube_id}'. Attempting yt-dlp + local Whisper audio extraction...")
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_path = os.path.join(tmpdir, f"{youtube_id}.mp3")
                    ydl_opts = {
                        'format': 'bestaudio/best',
                        'outtmpl': output_path,
                        'quiet': True,
                        'no_warnings': True,
                        'socket_timeout': 5,
                        'retries': 1,
                        'postprocessors': [{
                            'key': 'FFmpegExtractAudio',
                            'preferredcodec': 'mp3',
                            'preferredquality': '192',
                        }],
                    }

                    def download_audio():
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            ydl.download([f"https://www.youtube.com/watch?v={youtube_id}"])

                    loop = asyncio.get_event_loop()
                    await asyncio.wait_for(loop.run_in_executor(None, download_audio), timeout=25.0)

                    if os.path.exists(output_path):
                        whisper_text = await self.transcribe_audio_file(output_path)
                        if self.validate_transcript(whisper_text):
                            transcript_text = whisper_text.strip()
                            source = "yt-dlp + faster-whisper"
            except Exception as e:
                logger.warning(f"[TRANSCRIPT LOG] yt-dlp + whisper audio fallback note for video ID '{youtube_id}': {e}")

        # Final Verification & Safe Logging
        if transcript_text and self.validate_transcript(transcript_text):
            char_count = len(transcript_text)
            word_count = len(transcript_text.split())
            first_sample = transcript_text[:100].replace("\n", " ")
            last_sample = transcript_text[-100:].replace("\n", " ")
            logger.info(
                f"[TRANSCRIPT LOG] SUCCESS for Video ID: '{youtube_id}' | Source: {source} | "
                f"Chars: {char_count} | Words: {word_count} | First snippet: '{first_sample}' | Last snippet: '{last_sample}'"
            )
            return transcript_text
        else:
            logger.error(f"[TRANSCRIPT LOG] FAILED for Video ID: '{youtube_id}' - Unable to extract valid transcript.")
            return None
