import { apiUrl } from './apiBase';
import { PUBLIC_PROFILE_SLUG_PATTERN, type PublicProfile } from './publicProfile';

/** A visitor-facing read. The API is same-origin and never requires a session. */
export async function fetchPublicProfile(slug: string): Promise<PublicProfile> {
  if (!PUBLIC_PROFILE_SLUG_PATTERN.test(slug)) throw new Error('not-found');
  const response = await fetch(apiUrl(`/api/public/profiles/${encodeURIComponent(slug)}`), {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) throw new Error('not-found');
  if (!response.ok) throw new Error('unavailable');
  const body = await response.json() as { profile?: PublicProfile };
  if (!body.profile) throw new Error('not-found');
  return body.profile;
}

export function publicProfileUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/u/${slug}`;
}
