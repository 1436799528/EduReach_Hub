// Browser API requests use the separately deployed Vercel backend in production.
// Set VITE_EDUREACH_API_URL to the backend origin (for example,
// https://edureach-backend.vercel.app). Local development keeps the same-origin
// /api path so the Vite proxy or local server can handle it.
const configuredApiOrigin = (import.meta.env?.VITE_EDUREACH_API_URL as string | undefined)
  ?.trim()
  .replace(/\\/+$/, '');

export const API_BASE_PATH = configuredApiOrigin
  ? `${configuredApiOrigin}/api`
  : '/api';

export function apiUrl(path: string): string {
  if (!path.startsWith('/api/')) return path;
  return `${API_BASE_PATH}${path.slice('/api'.length)}`;
}
