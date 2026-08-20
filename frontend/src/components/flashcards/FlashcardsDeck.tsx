import React, { useState } from 'react';
import { Layers, Sparkles, CheckCircle2, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ProcessedVideo, Flashcard } from '../../types';
import { FlashcardsSection } from '../workspace/FlashcardsSection';

export interface FlashcardsDeckProps {
  videos: ProcessedVideo[];
  onSelectVideo: (video: ProcessedVideo) => void;
}

export const FlashcardsDeck: React.FC<FlashcardsDeckProps> = ({ videos, onSelectVideo }) => {
  const [selectedVideoId, setSelectedVideoId] = useState<string>(videos[0]?.id || '');
  const selectedVideo = videos.find((v) => v.id === selectedVideoId) || videos[0];

  const allFlashcards: Flashcard[] = videos.flatMap((v) => v.flashcards);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Flashcards Deck Workspace
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Review flashcards using spaced repetition recall for maximum learning retention.
        </p>
      </div>

      {/* Select Deck Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {videos.map((video) => (
          <button
            key={video.id}
            onClick={() => setSelectedVideoId(video.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all border ${
              video.id === selectedVideoId
                ? 'bg-primary-600 text-white border-primary-600 shadow-soft-sm'
                : 'bg-white dark:bg-card-dark text-gray-700 dark:text-gray-300 border-gray-200 dark:border-border-dark hover:bg-gray-50'
            }`}
          >
            {video.title} ({video.flashcards.length})
          </button>
        ))}
      </div>

      {/* Main Flashcard Interactive Player */}
      {selectedVideo && selectedVideo.flashcards.length > 0 ? (
        <FlashcardsSection flashcards={selectedVideo.flashcards} />
      ) : (
        <Card className="p-12 text-center text-gray-400">
          No flashcards available for this video.
        </Card>
      )}
    </div>
  );
};
