// Kept separate from the API client so all browser modules share exactly the
// same Vite/Netlify path selection. Node consumers have no import.meta.env and
// intentionally use the local `/api` fallback.
const viteProduction = import.meta.env?.PROD === true;

export const API_BASE_PATH = viteProduction ? '/.netlify/functions/api' : '/api';

export function apiUrl(path: string): string {
  if (!path.startsWith('/api/')) return path;
  return `${API_BASE_PATH}${path.slice('/api'.length)}`;
}
