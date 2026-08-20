import React, { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, ExternalLink, Share2 } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { getYouTubeEmbedUrl, extractYouTubeId, getDynamicVideoDuration } from '../../lib/utils';
import { ProcessedVideo } from '../../types';

export interface VideoPlayerProps {
  video: ProcessedVideo;
  seekTimeSeconds?: number;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, seekTimeSeconds }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const youtubeId = extractYouTubeId(video.youtube_url);
  const embedUrl = youtubeId ? getYouTubeEmbedUrl(video.youtube_url) : '';

  const handleShare = () => {
    navigator.clipboard.writeText(video.youtube_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayDuration = getDynamicVideoDuration(video);

  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-4 shadow-soft-md">
      {/* Top Header metadata */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-border-dark min-h-[42px]">
        <div className="flex items-center gap-2 overflow-hidden">
          <Badge variant="primary" icon={<Play className="w-3 h-3 fill-current" />} className="shrink-0 font-bold whitespace-nowrap">
            Video
          </Badge>
          <span className="text-xs text-gray-700 dark:text-gray-300 font-semibold truncate">
            {video.channel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-card-dark-hover hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copied ? 'Copied Link!' : 'Share'}</span>
          </button>
          <a
            href={video.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl bg-gray-100 dark:bg-card-dark-hover hover:bg-gray-200 dark:hover:bg-white/10 text-xs text-gray-500 dark:text-gray-400 transition-colors"
            title="Open in YouTube"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div className="relative rounded-2xl overflow-hidden aspect-video bg-black shadow-inner group">
        {youtubeId ? (
          <iframe
            ref={iframeRef}
            src={`${embedUrl}${seekTimeSeconds !== undefined ? `&start=${seekTimeSeconds}` : ''}`}
            title={video.title}
            className="w-full h-full border-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="relative w-full h-full">
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-16 h-16 rounded-full bg-white/90 dark:bg-primary-600/90 text-primary-600 dark:text-white flex items-center justify-center shadow-soft-lg hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current ml-1" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Title & Channel metadata */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
          {video.title}
        </h2>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
          <span>Processed on {video.processed_at}</span>
          <span>•</span>
          <span>Duration: {displayDuration}</span>
        </div>
      </div>
    </Card>
  );
};
