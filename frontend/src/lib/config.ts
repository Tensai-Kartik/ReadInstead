/**
 * ReadInstead App Configuration & Dynamic Backend Endpoint Resolution
 * Supports dynamic runtime switching, local storage overrides, Vercel build-time env vars,
 * and Render live backend detection.
 */

export const BACKEND_URL_STORAGE_KEY = 'readinstead_backend_url';
export const BACKEND_URL_CHANGED_EVENT = 'readinstead_backend_url_changed';

/**
 * Checks if the current browser environment is a live deployed domain (e.g. Vercel, Netlify, custom domain)
 */
export function isLiveProduction(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return (
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    hostname !== '0.0.0.0' &&
    !hostname.endsWith('.local')
  );
}

/**
 * Resolves the active backend URL dynamically.
 * Priority:
 * 1. Runtime override in localStorage (if set by user in the UI)
 * 2. VITE_BACKEND_URL environment variable from Vite / Vercel
 * 3. Localhost fallback (http://localhost:8000) for local development
 * 4. Empty string if on live domain with no backend set (to prompt user connection)
 */
export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    // 1. Check user-defined runtime URL in localStorage
    const savedUrl = localStorage.getItem(BACKEND_URL_STORAGE_KEY)?.trim();
    if (savedUrl) {
      return savedUrl.replace(/\/$/, '');
    }

    const rawEnvUrl = import.meta.env.VITE_BACKEND_URL?.trim();
    const live = isLiveProduction();

    if (live) {
      // On live deployment, only use env var if it does not point to localhost
      if (rawEnvUrl && !rawEnvUrl.includes('localhost') && !rawEnvUrl.includes('127.0.0.1')) {
        return rawEnvUrl.replace(/\/$/, '');
      }
      // If deployed on Vercel and env var is missing or set to localhost, return empty string
      return '';
    }

    // Local development: use env var or fallback to localhost:8000
    if (rawEnvUrl) {
      return rawEnvUrl.replace(/\/$/, '');
    }
    return 'http://localhost:8000';
  }

  // SSR or non-browser fallback
  const rawEnvUrl = import.meta.env.VITE_BACKEND_URL?.trim();
  return rawEnvUrl ? rawEnvUrl.replace(/\/$/, '') : 'http://localhost:8000';
}

/**
 * Checks if a valid backend endpoint is currently configured.
 */
export function isBackendConfigured(): boolean {
  const url = getBackendUrl();
  if (!url) return false;
  if (isLiveProduction() && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    return false;
  }
  return true;
}

/**
 * Saves a new backend URL to localStorage and dispatches a global update event.
 */
export function setBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim().replace(/\/$/, '');
  if (cleanUrl) {
    localStorage.setItem(BACKEND_URL_STORAGE_KEY, cleanUrl);
  } else {
    localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent(BACKEND_URL_CHANGED_EVENT, { detail: { url: cleanUrl } }));
}

/**
 * Resets backend URL override to default env settings.
 */
export function resetBackendUrl(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(BACKEND_URL_CHANGED_EVENT, { detail: { url: getBackendUrl() } }));
}

/**
 * Generates a full API URL given a route path (e.g. '/api/process-url-stream')
 */
export function getApiUrl(path: string): string {
  const base = getBackendUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    // If no backend configured, return relative path
    return cleanPath;
  }
  return `${base}${cleanPath}`;
}

/**
 * Proxy constant for legacy code compatibility (evaluated dynamically via getter where possible)
 */
export const BACKEND_URL = getBackendUrl();
