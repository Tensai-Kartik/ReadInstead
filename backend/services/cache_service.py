import re
import hashlib
from typing import Optional, Dict, Any

class SmartCacheService:
    @staticmethod
    def extract_youtube_id(url: str) -> Optional[str]:
        if not url:
            return None
        # Handle v=... query param
        v_match = re.search(r'[?&]v=([^&#]+)', url)
        if v_match:
            return v_match.group(1)
        # Handle youtu.be/...
        short_match = re.search(r'youtu\.be/([^?&#]+)', url)
        if short_match:
            return short_match.group(1)
        # Handle /embed/... or /v/...
        embed_match = re.search(r'/(?:embed|v)/([^?&#]+)', url)
        if embed_match:
            return embed_match.group(1)
        # Standard regex fallback
        match = re.search(r'([0-9A-Za-z_-]{11})', url)
        if match:
            return match.group(1)
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
