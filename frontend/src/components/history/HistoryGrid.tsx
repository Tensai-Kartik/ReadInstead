import React, { useState } from 'react';
import { Search, Play, Calendar, HelpCircle, Trash2 } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ConfirmModal } from '../common/ConfirmModal';
import { getDynamicVideoDuration } from '../../lib/utils';
import { ProcessedVideo } from '../../types';

export interface HistoryGridProps {
  videos: ProcessedVideo[];
  onSelectVideo: (video: ProcessedVideo) => void;
  onDeleteVideo?: (videoId: string) => void;
  onNewVideoClick?: () => void;
}

function formatCleanTitle(title: string): string {
  if (!title) return 'Educational Masterclass';
  const cleaned = title.replace(/\s*\([a-zA-Z0-9_-]{6,}\)/g, '').trim();
  if (cleaned.toLowerCase() === 'educational video' || !cleaned) {
    return 'Educational Masterclass';
  }
  return cleaned;
}

export const HistoryGrid: React.FC<HistoryGridProps> = ({
  videos,
  onSelectVideo,
  onDeleteVideo,
  onNewVideoClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.channel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const confirmDelete = () => {
    if (deletingVideoId && onDeleteVideo) {
      onDeleteVideo(deletingVideoId);
      setDeletingVideoId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Learning History
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Access all your previously processed videos, summaries, and practice questions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-primary-500"
            />
          </div>
          {onNewVideoClick && (
            <Button size="sm" onClick={onNewVideoClick}>
              + New Video
            </Button>
          )}
        </div>
      </div>

      {/* Grid of processed videos */}
      {filteredVideos.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <p className="text-sm font-semibold text-gray-500">No videos found matching your search query.</p>
          {onNewVideoClick && (
            <Button size="sm" onClick={onNewVideoClick} className="mt-2">
              Summarize a Video
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((video) => (
            <Card
              key={video.id}
              hoverEffect
              className="p-4 flex flex-col justify-between gap-4 group"
            >
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-black">
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-mono font-semibold backdrop-blur-sm">
                  {getDynamicVideoDuration(video)}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400 truncate max-w-[200px]">
                    {video.channel || 'Educational Video'}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                    {getDynamicVideoDuration(video)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-snug">
                  {formatCleanTitle(video.title)}
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {video.processed_at}
                  </span>
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" /> {video.questions.length} Questions
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-border-dark">
                <Button
                  size="sm"
                  onClick={() => onSelectVideo(video)}
                  leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                  className="w-full font-bold"
                >
                  Open Study Guide
                </Button>

                {onDeleteVideo && (
                  <button
                    onClick={() => setDeletingVideoId(video.id)}
                    className="p-2 ml-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Warning Modal */}
      <ConfirmModal
        isOpen={!!deletingVideoId}
        title="Remove Video from Learning History?"
        description="This will remove this video entry from your learning history dashboard. The cached transcript and AI summary will remain stored for database re-use."
        confirmText="Yes, Remove"
        onConfirm={confirmDelete}
        onClose={() => setDeletingVideoId(null)}
      />
    </div>
  );
};
