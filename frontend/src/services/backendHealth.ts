import { getBackendUrl, isBackendConfigured, isLiveProduction } from '../lib/config';

export interface BackendHealthDetails {
  status: 'healthy' | 'offline' | 'sleeping' | 'unconfigured';
  service?: string;
  engine?: string;
  active_keys_count?: number;
  database?: string;
  caching?: string;
  latencyMs?: number;
  url: string;
  error?: string;
}

/**
 * Checks the health and latency of the ReadInstead backend service.
 */
export async function checkBackendConnection(targetUrl?: string): Promise<BackendHealthDetails> {
  const url = (targetUrl !== undefined ? targetUrl.trim().replace(/\/$/, '') : getBackendUrl());

  if (!url) {
    return {
      status: 'unconfigured',
      url: '',
      error: isLiveProduction()
        ? 'No backend URL configured for live deployment. Please connect your Render backend URL.'
        : 'Backend server URL is empty.',
    };
  }

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

  try {
    const res = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok) {
      const data = await res.json();
      return {
        status: 'healthy',
        service: data.service || 'ReadInstead Backend',
        engine: data.engine || 'faster-whisper + Groq OpenAI RAG',
        active_keys_count: data.active_keys_count ?? 0,
        database: data.database || 'Supabase Production PostgreSQL',
        caching: data.caching || 'Active',
        latencyMs,
        url,
      };
    } else {
      return {
        status: 'offline',
        latencyMs,
        url,
        error: `Server responded with HTTP ${res.status} (${res.statusText})`,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      status: isTimeout ? 'sleeping' : 'offline',
      url,
      error: isTimeout
        ? 'Request timed out. The Render instance might be spinning up from sleep mode.'
        : (err.message || 'Connection refused / unreachable.'),
    };
  }
}

/**
 * Pings the backend repeatedly to wake up a sleeping Render free-tier instance.
 * Render free instances typically take 30-50s to cold start.
 */
export async function wakeUpRenderBackend(
  targetUrl?: string,
  onProgress?: (attempt: number, maxAttempts: number, statusText: string) => void
): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  const url = targetUrl !== undefined ? targetUrl.trim().replace(/\/$/, '') : getBackendUrl();
  if (!url) {
    return { success: false, error: 'No backend URL provided.' };
  }

  const maxAttempts = 20; // 20 attempts * 3s = up to 60s
  const intervalMs = 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (onProgress) {
      onProgress(
        attempt,
        maxAttempts,
        `Pinging Render backend (attempt ${attempt}/${maxAttempts})... Instance is booting up.`
      );
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const startTime = performance.now();
      const res = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const latencyMs = Math.round(performance.now() - startTime);
        if (onProgress) {
          onProgress(maxAttempts, maxAttempts, 'Backend is online and ready!');
        }
        return { success: true, latencyMs };
      }
    } catch {
      // Still waking up, wait and retry
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return {
    success: false,
    error: 'Backend wake-up timed out after 60 seconds. Please check your Render dashboard status.',
  };
}
