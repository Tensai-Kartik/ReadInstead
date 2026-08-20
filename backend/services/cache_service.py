import re
import hashlib
from typing import Optional, Dict, Any

class SmartCacheService:
    @staticmethod
    def extract_youtube_id(url: str) -> Optional[str]:
        """
        Robust YouTube Video ID extractor supporting all YouTube URL variations:
        - https://www.youtube.com/watch?v=VIDEO_ID
        - https://youtu.be/VIDEO_ID
        - https://www.youtube.com/shorts/VIDEO_ID
        - https://www.youtube.com/live/VIDEO_ID
        - https://www.youtube.com/embed/VIDEO_ID
        - https://m.youtube.com/watch?v=VIDEO_ID
        - Bare 11-char ID
        """
        if not url or not isinstance(url, str):
            return None
        
        clean_url = url.strip()

        # If it's already a clean 11-character YouTube video ID
        if re.fullmatch(r'[a-zA-Z0-9_-]{11}', clean_url):
            return clean_url

        # Patterns for YouTube URLs
        patterns = [
            r'(?:v=|\/v\/|embed\/|shorts\/|live\/|youtu\.be\/|\/e\/)([a-zA-Z0-9_-]{11})',
            r'[?&]v=([a-zA-Z0-9_-]{11})',
            r'^([a-zA-Z0-9_-]{11})$',
        ]

        for pattern in patterns:
            match = re.search(pattern, clean_url)
            if match:
                vid_id = match.group(1)
                # Ignore common words that match 11 chars
                if vid_id.lower() not in ['watch_videos', 'subscription']:
                    return vid_id

        return None

    @staticmethod
    def compute_sha256_bytes(content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    @staticmethod
    def compute_sha256_file(file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(65536), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
