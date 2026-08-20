import { ProcessedVideo, ProcessingStep, RAGChatMessage, RAGSource } from '../types';
import { extractYouTubeId } from '../lib/utils';
import { getApiUrl, getBackendUrl, isBackendConfigured, isLiveProduction } from '../lib/config';

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
    ? getApiUrl('/api/process-file-stream')
    : getApiUrl('/api/process-url-stream');

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
          user_id: userId,
        }),
      });
    }
  } catch (netErr: any) {
    const isConnRefused =
      netErr.message?.includes('Failed to fetch') ||
      netErr.message?.includes('NetworkError') ||
      netErr.name === 'TypeError';
    const isLive = isLiveProduction();
    const activeBackendUrl = getBackendUrl();
    const configured = isBackendConfigured();

    let errorMsg: string;
    if (isLive && !configured) {
      errorMsg = `Live Backend Not Connected: Please click 'Connect Backend' in the top header or sidebar to configure your Render backend URL (e.g. https://your-service.onrender.com).`;
    } else if (isLive && isConnRefused) {
      errorMsg = `Render Backend Sleeping or Unreachable (${activeBackendUrl}): On Render's free tier, servers sleep after 15 minutes of inactivity. Please wait 30 seconds for the instance to wake up or check your Backend Status in the header.`;
    } else if (isConnRefused) {
      errorMsg = `Backend Offline: Could not connect to ${activeBackendUrl || 'http://localhost:8000'}. Please start your FastAPI server (npm run backend).`;
    } else {
      errorMsg = `Connection error: ${netErr.message || 'Unable to connect to ReadInstead backend server.'}`;
    }

    steps[0].status = 'error';
    steps[0].description = errorMsg;
    if (onProgress) onProgress([...steps], 0);
    throw new Error(errorMsg);
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
            steps[stepIndex].status = event.status || 'in_progress';
            if (event.message) {
              steps[stepIndex].description = event.message;
            }
          }
          if (onProgress && typeof event.progress === 'number') {
            onProgress([...steps], event.progress);
          }
        } else if (event.type === 'complete') {
          finalData = event.payload || event.data || event.result || event;
          steps.forEach((s) => (s.status = 'completed'));
          if (onProgress) onProgress([...steps], 100);
        } else if (event.type === 'error') {
          const stepIndex = steps.findIndex((s) => s.id === event.step_id);
          if (stepIndex !== -1) {
            steps[stepIndex].status = 'error';
            steps[stepIndex].description = event.message || 'Processing step failed';
          }
          if (onProgress) onProgress([...steps], 0);
          throw new Error(event.message || 'An error occurred during video processing pipeline.');
        }
      }
    }
  } catch (streamErr: any) {
    steps.forEach((s) => {
      if (s.status === 'in_progress') {
        s.status = 'error';
        s.description = streamErr.message || 'Stream processing disconnected';
      }
    });
    if (onProgress) onProgress([...steps], 0);
    throw streamErr;
  }

  if (finalData) {
    const questionsWithDefaults = (finalData.questions || []).map((q: any, i: number) => ({
      id: q.id || `q_${i}_${Date.now()}`,
      video_id: finalData.video?.id || videoId,
      question_text: q.question_text || q.question || '',
      question_type: q.question_type || 'MCQs',
      difficulty: q.difficulty || 'Medium',
      options: Array.isArray(q.options) && q.options.length > 0 ? q.options : ['True', 'False'],
      correct_answer: q.correct_answer || (q.options ? q.options[0] : 'True'),
      explanation: q.explanation || 'See relevant video section for conceptual grounding.',
      start_seconds: q.start_seconds !== undefined ? q.start_seconds : (q.seconds !== undefined ? q.seconds : 0),
      end_seconds: q.end_seconds,
      timestamp: q.timestamp || '00:00',
    }));

    const flashcardsWithDefaults = (finalData.flashcards || []).map((f: any, i: number) => ({
      id: f.id || `fc_${i}_${Date.now()}`,
      video_id: finalData.video?.id || videoId,
      front: f.front || f.term || 'Concept Key',
      back: f.back || f.definition || 'Detailed explanation',
      mastery_level: 'new' as const,
      start_seconds: f.start_seconds !== undefined ? f.start_seconds : (f.seconds !== undefined ? f.seconds : 0),
      end_seconds: f.end_seconds,
      timestamp: f.timestamp || '00:00',
    }));

    const normalizedTimeline = (finalData.summary?.chapter_timeline || []).map((chap: any) => ({
      time: chap.time || chap.timestamp || '00:00',
      seconds: chap.seconds !== undefined ? chap.seconds : 0,
      title: chap.title || 'Chapter Section',
      description: chap.description || chap.notes || '',
    }));

    const finalSummary = {
      executive_summary: finalData.summary?.executive_summary || '',
      tldr: finalData.summary?.tldr || '',
      detailed_notes: finalData.summary?.detailed_notes || [],
      key_takeaways: finalData.summary?.key_takeaways || [],
      important_concepts: finalData.summary?.important_concepts || [],
      chapter_timeline: normalizedTimeline,
    };

    return {
      id: finalData.video?.id || videoId,
      user_id: userId,
      title: finalData.video?.title || videoTitle,
      youtube_url: isUrl ? urlOrTitle : '',
      embed_url: finalData.video?.embed_url || '',
      duration: finalData.video?.duration || '15:00',
      duration_seconds: finalData.video?.duration_seconds || 900,
      channel: finalData.video?.channel || 'Educational Masterclass',
      thumbnail_url: finalData.video?.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60',
      processed_at: finalData.video?.processed_at || new Date().toISOString(),
      summary: finalSummary,
      original_summary: JSON.parse(JSON.stringify(finalSummary)),
      translations: {},
      questions: questionsWithDefaults,
      flashcards: flashcardsWithDefaults,
      personal_note: finalData.video?.personal_note || '',
      completion_percentage: finalData.video?.completion_percentage || 0,
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
  const endpoint = getApiUrl('/api/chat-with-video');
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
        retrieval_method: s.retrieval_method,
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
  const path = userId
    ? `/api/chat-history/${videoId}?user_id=${encodeURIComponent(userId)}`
    : `/api/chat-history/${videoId}`;
  const endpoint = getApiUrl(path);

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
  const path = userId ? `/api/videos?user_id=${encodeURIComponent(userId)}` : `/api/videos`;
  const endpoint = getApiUrl(path);

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
  const endpoint = getApiUrl(`/api/videos/${videoId}`);
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
  const endpoint = getApiUrl('/api/save-note');
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

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const endpoint = getApiUrl('/health');
    const response = await fetch(endpoint);
    return response.ok;
  } catch {
    return false;
  }
}
