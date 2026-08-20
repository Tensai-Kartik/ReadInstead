import { ProcessedVideo, ProcessingStep, RAGChatMessage, RAGSource } from '../types';
import { extractYouTubeId } from '../lib/utils';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export const INITIAL_PROCESSING_STEPS: ProcessingStep[] = [
  { id: 1, label: 'Downloading Video', description: 'Retrieving media payload & metadata', status: 'pending' },
  { id: 2, label: 'Extracting Audio', description: 'Resolving audio & subtitle caption streams', status: 'pending' },
  { id: 3, label: 'Generating Transcript', description: 'Whisper speech acoustic tokenization', status: 'pending' },
  { id: 4, label: 'Preparing Transcript', description: 'Token-aware smart chunking (~3,500 tokens/chunk)', status: 'pending' },
  { id: 5, label: 'Processing Video Sections', description: 'Hierarchical chunk extraction & synthesis', status: 'pending' },
  { id: 6, label: 'Creating Questions', description: 'Formulating grounded multi-level Q&A', status: 'pending' },
  { id: 7, label: 'Creating Flashcards', description: 'Building active recall flashcards', status: 'pending' },
  { id: 8, label: 'Saving Results', description: 'Indexing into knowledge base & RAG store', status: 'pending' },
];

export async function processVideoPipeline(
  urlOrFile: string | File,
  onProgress?: (steps: ProcessingStep[], overallPercentage: number) => void,
  userId?: string
): Promise<ProcessedVideo> {
  const steps: ProcessingStep[] = JSON.parse(JSON.stringify(INITIAL_PROCESSING_STEPS));
  const isFile = typeof urlOrFile !== 'string';
  const urlOrTitle = isFile ? urlOrFile.name : urlOrFile;
  const isUrl = !isFile && (urlOrTitle.startsWith('http://') || urlOrTitle.startsWith('https://'));
  const youtubeId = isUrl ? extractYouTubeId(urlOrTitle) : null;
  const videoId = youtubeId || `upload_${Date.now()}`;
  const videoTitle = isUrl
    ? (urlOrTitle.includes('watch') ? 'Educational Video' : 'AI & Video Lecture')
    : urlOrTitle.replace(/\.[^/.]+$/, "");

  // Update initial step state
  steps[0].status = 'in_progress';
  if (onProgress) onProgress([...steps], 5);

  const streamEndpoint = isFile
    ? `${BACKEND_URL}/api/process-file-stream`
    : `${BACKEND_URL}/api/process-url-stream`;

  let response: Response;

  try {
    if (isFile) {
      const formData = new FormData();
      formData.append('file', urlOrFile);
      if (userId) formData.append('user_id', userId);
      response = await fetch(streamEndpoint, {
        method: 'POST',
        body: formData,
      });
    } else {
      response = await fetch(streamEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlOrTitle,
          user_id: userId
        }),
      });
    }
  } catch (netErr: any) {
    steps[0].status = 'error';
    if (onProgress) onProgress([...steps], 0);
    throw new Error(`Connection error: ${netErr.message || 'Unable to connect to ReadInstead backend server.'}`);
  }

  if (!response.ok) {
    let errorDetail = `Failed to process video (HTTP ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.detail) errorDetail = errJson.detail;
    } catch {}
    steps[0].status = 'error';
    if (onProgress) onProgress([...steps], 0);
    throw new Error(errorDetail);
  }

  // Parse Server-Sent Events stream in real-time
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response body is unavailable.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalData: any = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        const cleanBlock = block.trim();
        if (!cleanBlock.startsWith('data: ')) continue;

        const rawJson = cleanBlock.slice(6).trim();
        if (!rawJson) continue;

        let event: any;
        try {
          event = JSON.parse(rawJson);
        } catch (jsonErr) {
          console.warn('Failed to parse SSE JSON block:', jsonErr);
          continue;
        }

        if (event.type === 'progress') {
          const stepIndex = steps.findIndex((s) => s.id === event.step_id);
          if (stepIndex !== -1) {
            if (event.status === 'in_progress' || event.status === 'completed') {
              for (let prev = 0; prev < stepIndex; prev++) {
                steps[prev].status = 'completed';
              }
            }
            steps[stepIndex].status = event.status;
            if (event.message) {
              steps[stepIndex].description = event.message;
            }
          }
          if (onProgress) {
            onProgress([...steps], event.progress ?? 50);
          }
        } else if (event.type === 'complete') {
          finalData = event.data;
          for (let i = 0; i < steps.length; i++) {
            steps[i].status = 'completed';
          }
          if (onProgress) {
            onProgress([...steps], 100);
          }
        } else if (event.type === 'error') {
          const errorStepId = event.step_id || 1;
          const errIndex = steps.findIndex((s) => s.id === errorStepId);
          if (errIndex !== -1) {
            steps[errIndex].status = 'error';
            steps[errIndex].description = event.message || 'Error occurred during processing';
          }
          if (onProgress) {
            onProgress([...steps], 0);
          }
          throw new Error(event.message || 'An error occurred during video processing.');
        }
      }
    }
  } catch (err: any) {
    reader.cancel().catch(() => {});
    throw err;
  }

  if (finalData) {
    const rawDur = finalData.video?.duration;
    const chapters = finalData.summary?.chapter_timeline;
    let resolvedDuration = rawDur;
    if (!resolvedDuration || resolvedDuration === '25:00' || resolvedDuration === '00:00') {
      if (chapters && chapters.length > 0) {
        const lastChap = chapters[chapters.length - 1];
        if (lastChap?.time && lastChap.time !== '00:00' && lastChap.time !== '25:00') {
          resolvedDuration = lastChap.time;
        }
      }
    }
    const resolvedSeconds = finalData.video?.duration_seconds || (chapters && chapters.length > 0 ? chapters[chapters.length - 1]?.seconds : 765);

    const dynamicThumbnail = finalData.video?.thumbnail_url || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : '/assets/logo_bg.png');

    return {
      id: finalData.video?.id || videoId,
      title: finalData.video?.title || videoTitle,
      youtube_url: finalData.video?.youtube_url || (isUrl ? urlOrTitle : ''),
      duration: resolvedDuration || '12:45',
      duration_seconds: resolvedSeconds || 765,
      channel: finalData.video?.channel || (isFile ? 'Uploaded File' : 'Video Lecture'),
      thumbnail_url: dynamicThumbnail,
      processed_at: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      summary: finalData.summary,
      questions: finalData.questions || [],
      flashcards: finalData.flashcards || [],
      personal_note: '',
      completion_percentage: 0
    };
  }

  throw new Error('Video processing ended without complete data payload.');
}

export async function sendChatMessage(
  videoId: string,
  query: string,
  videoTitle: string,
  contextHint?: string,
  userId?: string
): Promise<{ answer: string; sources: RAGSource[] }> {
  const endpoint = `${BACKEND_URL}/api/chat-with-video`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        query,
        video_title: videoTitle,
        user_id: userId,
        context_hint: contextHint,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const normalizedSources: RAGSource[] = (data.sources || []).map((s: any) => ({
        time: s.time || s.timestamp || '00:00',
        timestamp: s.timestamp || s.time || '00:00',
        seconds: s.seconds !== undefined ? s.seconds : (s.start_seconds !== undefined ? s.start_seconds : 0),
        start_seconds: s.start_seconds !== undefined ? s.start_seconds : (s.seconds !== undefined ? s.seconds : 0),
        end_seconds: s.end_seconds,
        snippet: s.snippet || '',
        retrieval_method: s.retrieval_method
      }));
      return {
        answer: data.answer || "I couldn't find a direct answer in the transcript.",
        sources: normalizedSources,
      };
    }
  } catch (err) {
    console.error('Chat API request error:', err);
  }

  return {
    answer: `Based on the lecture materials for "${videoTitle}", no specific answer was found in the indexed sections.`,
    sources: [],
  };
}

export async function fetchChatHistory(
  videoId: string,
  userId?: string
): Promise<RAGChatMessage[]> {
  const endpoint = userId
    ? `${BACKEND_URL}/api/chat-history/${videoId}?user_id=${userId}`
    : `${BACKEND_URL}/api/chat-history/${videoId}`;
  try {
    const response = await fetch(endpoint);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.history) && data.history.length > 0) {
        return data.history.map((item: any) => ({
          id: item.id || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          sender: item.sender as 'user' | 'assistant',
          content: item.content,
          sources: item.sources || [],
          timestamp: item.created_at
            ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
      }
    }
  } catch (err) {
    console.warn('Failed to fetch past chat history from server:', err);
  }
  return [];
}

export async function fetchUserHistory(userId?: string): Promise<ProcessedVideo[]> {
  const endpoint = userId ? `${BACKEND_URL}/api/videos?user_id=${userId}` : `${BACKEND_URL}/api/videos`;
  try {
    const response = await fetch(endpoint);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.videos) && data.videos.length > 0) {
        return data.videos;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch videos from server:', err);
  }
  return [];
}

export async function deleteVideoFromHistory(videoId: string): Promise<boolean> {
  const endpoint = `${BACKEND_URL}/api/videos/${videoId}`;
  try {
    const response = await fetch(endpoint, { method: 'DELETE' });
    if (response.ok) {
      return true;
    }
  } catch (err) {
    console.warn('Failed to delete video on server:', err);
  }
  return false;
}

export async function savePersonalNote(videoId: string, content: string, userId?: string): Promise<boolean> {
  const endpoint = `${BACKEND_URL}/api/save-note`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, content, user_id: userId }),
    });
    if (response.ok) {
      return true;
    }
  } catch (err) {
    console.warn('Failed to save note on server:', err);
  }
  return false;
}
