/**
 * Services with a live application workflow.
 *
 * Single source of truth shared by the router (`src/app/routes.tsx`) and the
 * sitemap (`src/server/seo.ts`). Every other /services/:slug renders the honest
 * coming-soon panel, so it must not be indexed and must not appear in the
 * sitemap — which is exactly why this list cannot live in two places.
 */

export const LIVE_SERVICE_SLUGS: readonly string[] = [
  'nelfund-loan',
  'results',
  'jamb-slip',
  'admission-letters',
];

const liveServiceSlugs = new Set(LIVE_SERVICE_SLUGS.map((slug) => slug.toLowerCase()));

export function isLiveServiceSlug(slug: string): boolean {
  return liveServiceSlugs.has(String(slug || '').trim().toLowerCase());
}
