/**
 * Client access to the site content the admin portal owns.
 *
 * One module-level promise, so the footer, the policy pages and the admin
 * editor do not each fetch the same JSON on the same navigation. A failure is
 * not an error screen: `mergeSiteContent` fills in the copy the site shipped
 * with, and the caller can tell the difference through `source`.
 */

import { apiUrl } from './apiBase';
import { mergeSiteContent, type SiteContentPayload } from './siteContentModel';

export type SiteContentSource = 'live' | 'fallback';

export interface LoadedSiteContent {
  content: SiteContentPayload;
  source: SiteContentSource;
  fetchedAt: number | null;
}

let cache: LoadedSiteContent | null = null;
let inflight: Promise<LoadedSiteContent> | null = null;

const TTL_MS = 60_000;

export function resetSiteContentCache(): void {
  cache = null;
  inflight = null;
}

export async function loadSiteContent({ force = false }: { force?: boolean } = {}): Promise<LoadedSiteContent> {
  if (!force && cache && Date.now() - cache.fetchedAt! < TTL_MS) return cache;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch(apiUrl('/api/site-content'), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`site content ${response.status}`);
      const body = await response.json();
      cache = { content: mergeSiteContent(body), source: 'live', fetchedAt: Date.now() };
    } catch {
      // Degrade to the shipped copy, or keep the last good copy if there is one.
      // The footer must not disappear because the API is having a bad minute - a
      // page without a footer looks abandoned.
      cache = cache ?? { content: mergeSiteContent(null), source: 'fallback', fetchedAt: Date.now() };
    } finally {
      inflight = null;
    }
    return cache;
  })();

  return inflight;
}

export function peekSiteContent(): LoadedSiteContent | null {
  return cache;
}
