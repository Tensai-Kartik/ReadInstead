import json
import logging
from typing import Dict, Any
from services.groq_service import GroqKeyPoolManager

logger = logging.getLogger("ReadInstead.TranslationService")

LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "hi": "Hindi",
    "ja": "Japanese"
}

class TranslationService:
    @classmethod
    async def translate_summary(
        cls,
        summary_data: Dict[str, Any],
        target_lang: str,
        pool_manager: GroqKeyPoolManager
    ) -> Dict[str, Any]:
        """
        Translates summary content into the requested target language using Groq LLM.
        """
        lang_name = LANGUAGE_NAMES.get(target_lang, target_lang.capitalize())
        if target_lang == "en":
            return summary_data

        from openai import AsyncOpenAI

        if not pool_manager.keys:
            logger.warning("No Groq API keys found. Returning original summary.")
            return summary_data

        prompt = f"""
        You are a professional multilingual translator. Translate the following educational summary into {lang_name}.
        Keep the exact same JSON structure with all keys intact:
        - executive_summary
        - tldr
        - detailed_notes (array)
        - key_takeaways (array)
        - important_concepts (array of {{term, definition}})
        - chapter_timeline (array of {{time, seconds, title, description}})

        SUMMARY JSON TO TRANSLATE:
        {json.dumps(summary_data, ensure_ascii=False)}
        """

        attempts = 0
        max_attempts = len(pool_manager.keys)
        candidate_models = ["openai/gpt-oss-120b", "groq/compound-mini", "openai/gpt-oss-20b"]

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
                            {"role": "system", "content": f"You are a translator outputting valid JSON only in {lang_name}."},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"}
                    )
                    content = response.choices[0].message.content
                    if content:
                        translated_json = json.loads(content)
                        logger.info(f"Successfully translated summary to {lang_name} using model {model_id}")
                        return translated_json
                except Exception as e:
                    logger.warning(f"Translation key failed with model {model_id}: {e}. Trying next model/key...")

        return summary_data
