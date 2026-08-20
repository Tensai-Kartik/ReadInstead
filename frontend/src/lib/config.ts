/**
 * ReadInstead App Configuration
 * Centralized resolution of backend endpoint and environment variables
 */

export function getBackendUrl(): string {
  const rawUrl = import.meta.env.VITE_BACKEND_URL?.trim();

  // If in a browser environment on a live domain (e.g., your-domain.vercel.app)
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '0.0.0.0';

    if (!isLocalhost) {
      // If deployed on live HTTPS and VITE_BACKEND_URL is not set or still set to localhost
      if (!rawUrl || rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) {
        // Fallback to relative URL so same-origin or reverse-proxy rewrites work
        return '';
      }
      return rawUrl.replace(/\/$/, '');
    }
  }

  // Local development fallback
  if (rawUrl) {
    return rawUrl.replace(/\/$/, '');
  }

  return 'http://localhost:8000';
}

export const BACKEND_URL = getBackendUrl();
