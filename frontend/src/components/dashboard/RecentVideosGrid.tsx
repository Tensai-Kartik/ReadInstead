import React from 'react';
import { Play, Clock, HelpCircle, ArrowRight, Video, Sparkles } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { getDynamicVideoDuration } from '../../lib/utils';
import { ProcessedVideo } from '../../types';

export interface RecentVideosGridProps {
  videos: ProcessedVideo[];
  onSelectVideo: (video: ProcessedVideo) => void;
  onNewVideoClick: () => void;
}

function formatCleanTitle(title: string): string {
  if (!title) return 'Educational Masterclass';
  const cleaned = title.replace(/\s*\([a-zA-Z0-9_-]{6,}\)/g, '').trim();
  if (cleaned.toLowerCase() === 'educational video' || !cleaned) {
    return 'Educational Masterclass';
  }
  return cleaned;
}

export const RecentVideosGrid: React.FC<RecentVideosGridProps> = ({
  videos,
  onSelectVideo,
  onNewVideoClick,
}) => {
  const activeVideo = videos.length > 0 ? videos[0] : null;

  if (videos.length === 0) {
    return (
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Recent Video Summaries
          </h3>
        </div>

        <Card className="p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-5 border border-dashed border-gray-200 dark:border-border-dark bg-gray-50/50 dark:bg-card-dark/40 shadow-soft-sm">
          <div className="w-16 h-16 rounded-3xl bg-primary-50 dark:bg-primary-950/70 border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 flex items-center justify-center shadow-soft-sm">
            <Video className="w-8 h-8" />
          </div>

          <div className="flex flex-col gap-1.5 max-w-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              No Video Summaries Yet
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Paste any YouTube video link or upload an educational lecture to generate instant comprehensive summaries, key concepts, interactive quizzes, and flashcards.
            </p>
          </div>

          <Button
            onClick={onNewVideoClick}
            size="lg"
            leftIcon={<Sparkles className="w-4 h-4" />}
            className="shadow-glow-purple mt-2"
          >
            Summarize Your First Video
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Featured Continue Learning Card */}
      {activeVideo && (
        <Card className="p-6 sm:p-8 bg-gradient-to-r from-primary-900 via-primary-800 to-indigo-900 text-white border-none shadow-glow-purple relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 blur-3xl rounded-full transform translate-x-1/2 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col gap-2 max-w-xl">
              <Badge variant="primary" className="self-start bg-white/20 text-white border-white/30 backdrop-blur-md">
                Continue Learning
              </Badge>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                {formatCleanTitle(activeVideo.title)}
              </h2>
              <p className="text-sm text-indigo-100/80 line-clamp-2">
                {activeVideo.summary.tldr}
              </p>
              <div className="flex items-center gap-4 text-xs text-indigo-200 mt-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {getDynamicVideoDuration(activeVideo)}
                </span>
                <span className="flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" /> {activeVideo.questions.length} Quiz Questions
                </span>
              </div>
            </div>

            <Button
              onClick={() => onSelectVideo(activeVideo)}
              size="lg"
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              className="bg-white text-primary-900 hover:bg-gray-100 font-bold shrink-0 border-none shadow-none"
            >
              Resume Lesson
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Videos Grid Header */}
      <div className="flex items-center justify-between mt-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Recent Video Summaries
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewVideoClick}
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          Summarize New Video
        </Button>
      </div>

      {/* Video Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <Card
            key={video.id}
            hoverEffect
            onClick={() => onSelectVideo(video)}
            className="p-4 cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div className="relative rounded-xl overflow-hidden aspect-video bg-gray-900">
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center text-primary-600 dark:text-white shadow-soft-md group-hover:scale-110 transition-transform">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>
              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-semibold backdrop-blur-sm">
                {getDynamicVideoDuration(video)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {formatCleanTitle(video.title)}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {video.channel} • {video.processed_at}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-border-dark text-xs">
              <span className="text-gray-500 dark:text-gray-400 font-medium">
                {video.questions.length} Questions & Quiz
              </span>
              <span className="text-primary-600 dark:text-primary-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                Open Study Guide →
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
