import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function getYouTubeThumbnail(url: string): string {
  const id = extractYouTubeId(url);
  if (id) {
    return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  }
  return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop';
}

export function getYouTubeEmbedUrl(url: string): string {
  const id = extractYouTubeId(url);
  if (id) {
    return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0&modestbranding=1`;
  }
  return '';
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch {
    return dateString;
  }
}

export function getDynamicVideoDuration(video: { duration?: string; duration_seconds?: number; summary?: { chapter_timeline?: Array<{ time?: string; seconds?: number }> } }): string {
  if (!video) return '12:45';
  if (video.duration && video.duration !== '25:00' && video.duration !== '00:00') {
    return video.duration;
  }
  const chapters = video.summary?.chapter_timeline;
  if (chapters && chapters.length > 0) {
    const lastChapter = chapters[chapters.length - 1];
    if (lastChapter && lastChapter.time && lastChapter.time !== '00:00' && lastChapter.time !== '25:00') {
      return lastChapter.time;
    }
    if (lastChapter && lastChapter.seconds && lastChapter.seconds > 0) {
      const m = Math.floor(lastChapter.seconds / 60);
      const s = lastChapter.seconds % 60;
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return h > 0 ? `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${remM}:${s.toString().padStart(2, '0')}`;
    }
  }
  if (video.duration_seconds && video.duration_seconds > 0 && video.duration_seconds !== 1500) {
    const m = Math.floor(video.duration_seconds / 60);
    const s = video.duration_seconds % 60;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return h > 0 ? `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${remM}:${s.toString().padStart(2, '0')}`;
  }
  return video.duration || '12:45';
}
