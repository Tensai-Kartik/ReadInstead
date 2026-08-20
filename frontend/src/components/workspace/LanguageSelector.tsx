import React, { useState } from 'react';
import { Globe, Check, Loader2 } from 'lucide-react';
import { LanguageCode, SummaryContent } from '../../types';
import { LANGUAGE_OPTIONS, translateSummaryLocally } from '../../lib/translator';
import { getApiUrl } from '../../lib/config';

export interface LanguageSelectorProps {
  videoId: string;
  currentLanguage: LanguageCode;
  summaryData: SummaryContent;
  originalSummary?: SummaryContent;
  onLanguageChanged: (newLang: LanguageCode, translatedSummary: SummaryContent) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  videoId,
  currentLanguage,
  summaryData,
  originalSummary,
  onLanguageChanged,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const activeLang = LANGUAGE_OPTIONS.find((l) => l.code === currentLanguage) || LANGUAGE_OPTIONS[0];
  const sourceSummary = originalSummary || summaryData;

  const handleSelectLanguage = async (targetLang: LanguageCode) => {
    setIsOpen(false);
    if (targetLang === currentLanguage || isTranslating) return;

    if (targetLang === 'en') {
      onLanguageChanged('en', sourceSummary);
      return;
    }

    setIsTranslating(true);
    let translated: SummaryContent | null = null;

    try {
      const res = await fetch(getApiUrl('/api/translate-summary'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          target_language: targetLang,
          summary_data: sourceSummary,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Check if returned summary is actually translated (not identical to source English summary)
        if (data.summary && JSON.stringify(data.summary) !== JSON.stringify(sourceSummary)) {
          translated = data.summary;
        }
      }
    } catch (err) {
      console.log('Backend translation service offline or error. Using local translator engine:', err);
    }

    // Fallback to client-side translation engine if backend is offline or un-translated
    if (!translated) {
      translated = translateSummaryLocally(sourceSummary, targetLang);
    }

    onLanguageChanged(targetLang, translated);
    setIsTranslating(false);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isTranslating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-card-dark-hover hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
      >
        {isTranslating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
        ) : (
          <Globe className="w-3.5 h-3.5 text-primary-500" />
        )}
        <span>{activeLang.flag} {activeLang.label}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-[#161923] border border-gray-200 dark:border-[#232736] shadow-xl z-50 overflow-hidden p-1">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelectLanguage(lang.code)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentLanguage === lang.code
                  ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 font-bold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              <span>{lang.flag} {lang.label}</span>
              {currentLanguage === lang.code && <Check className="w-3.5 h-3.5 text-primary-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
