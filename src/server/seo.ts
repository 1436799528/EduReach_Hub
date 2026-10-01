/**
 * Server-rendered crawler surfaces: robots.txt and sitemap.xml.
 *
 * These are served by Express so they work identically in production (behind
 * the API function), on a self-hosted Docker deploy, and in local development.
 * The sitemap lists only canonical, public, currently-useful URLs:
 *
 *   - never admin, dashboard, auth, search or tracker paths;
 *   - never placeholder routes that render "coming soon";
 *   - never expired articles (they stay linkable but leave the index);
 *   - never a URL that is not reachable by a student.
 *
 * Database reads are best-effort: if the project is unconfigured or a query
 * fails, the static entries are still served rather than a broken sitemap.
 */

import { LIVE_SERVICE_SLUGS, isLiveServiceSlug } from '../../src/data/liveServices';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: number;
}

export interface MinimalSupabase {
  from(table: string): any;
}

const STATIC_ENTRIES: Array<{ path: string; changefreq: SitemapEntry['changefreq']; priority: number }> = [
  { path: '/', changefreq: 'daily', priority: 1 },
  { path: '/news', changefreq: 'daily', priority: 0.9 },
  { path: '/jobs', changefreq: 'daily', priority: 0.9 },
  { path: '/schools', changefreq: 'weekly', priority: 0.8 },
  { path: '/services', changefreq: 'monthly', priority: 0.8 },
  { path: '/cbt', changefreq: 'weekly', priority: 0.8 },
  { path: '/events', changefreq: 'weekly', priority: 0.7 },
  { path: '/past-questions', changefreq: 'monthly', priority: 0.7 },
  { path: '/jamb', changefreq: 'weekly', priority: 0.7 },
  { path: '/waec', changefreq: 'weekly', priority: 0.7 },
  { path: '/neco', changefreq: 'weekly', priority: 0.7 },
  { path: '/post-utme', changefreq: 'weekly', priority: 0.7 },
  { path: '/screening-calculator', changefreq: 'monthly', priority: 0.6 },
  { path: '/tools/cgpa-calculator', changefreq: 'monthly', priority: 0.6 },
];

/** Paths that must never be crawled, mirrored in the client's noindex rules. */
export const DISALLOWED_PATHS = [
  '/api/',
  '/admin',
  '/dashboard',
  '/profile',
  '/settings',
  '/search',
  '/cbt/practice',
  '/cbt/results',
  '/cbt/setup',
  '/services/track',
  '/track',
  '/login',
  '/signin',
  '/register',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

/**
 * Exact paths whose UI is a "coming soon" placeholder: linkable, but nothing
 * worth indexing. Deliberately kept out of DISALLOWED_PATHS because robots.txt
 * matches by prefix — disallowing /tools would also block the live
 * /tools/cgpa-calculator page.
 */
const PLACEHOLDER_EXACT_PATHS = new Set(['/nabteb', '/tools', '/support', '/admission']);

/**
 * Server-side indexability, mirroring `isIndexablePath` in src/lib/seoMeta.ts.
 * Used for the X-Robots-Tag header so a crawler that never runs the SPA still
 * gets the right answer for student, admin, tracker and placeholder routes.
 * Only exact and single-segment matches are used so no indexable page is
 * caught by accident.
 */
export function isNonIndexablePath(pathname: string): boolean {
  const path = String(pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (path === '/api' || DISALLOWED_PATHS.some((prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix))) return true;
  if (PLACEHOLDER_EXACT_PATHS.has(path) || path.startsWith('/admission/')) return true;
  const service = /^\/services\/([^/]+)$/.exec(path);
  if (service) return !isLiveServiceSlug(service[1]);
  return false;
}

export const SITEMAP_MAX_ARTICLES = 500;
export const SITEMAP_MAX_INSTITUTIONS = 1000;

/**
 * Canonical origin for absolute URLs. `EDUREACH_SITE_URL` wins when configured;
 * otherwise the request host is used so nothing is hard-coded to one domain.
 */
export function resolveSiteOrigin(request: {
  headers?: Record<string, unknown>;
  protocol?: string;
  get?: (name: string) => string | undefined;
}): string {
  const configured = String(process.env.EDUREACH_SITE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  const header = (name: string): string => {
    const fromGetter = request.get?.(name);
    if (fromGetter) return String(fromGetter);
    const raw = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
    return Array.isArray(raw) ? String(raw[0]) : raw ? String(raw) : '';
  };

  const host = (header('x-forwarded-host') || header('host')).split(',')[0].trim();
  const protocol = (header('x-forwarded-proto') || request.protocol || 'https').split(',')[0].trim();
  if (!host) return 'http://localhost:3000';
  return `${protocol || 'https'}://${host}`.replace(/\/+$/, '');
}

export function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildRobotsTxt(origin: string): string {
  const lines = [
    '# EduReach Hub — https://github.com/1436799528/EduReach_Hub',
    '# Public content is open to crawlers. Student, admin and tracker surfaces are not.',
    'User-agent: *',
    'Allow: /',
    ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ];
  return lines.join('\n');
}

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const seen = new Set<string>();
  const unique: SitemapEntry[] = [];
  for (const entry of entries) {
    if (!entry.loc || seen.has(entry.loc)) continue;
    seen.add(entry.loc);
    unique.push(entry);
  }
  unique.sort((a, b) => a.loc.localeCompare(b.loc));

  const urls = unique.map((entry) => {
    const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
    if (entry.lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    if (typeof entry.priority === 'number') parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
    return `  <url>\n${parts.join('\n')}\n  </url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export function staticSitemapEntries(origin: string): SitemapEntry[] {
  const entries: SitemapEntry[] = STATIC_ENTRIES.map((entry) => ({
    loc: `${origin}${entry.path}`,
    changefreq: entry.changefreq,
    priority: entry.priority,
  }));
  for (const slug of LIVE_SERVICE_SLUGS) {
    entries.push({ loc: `${origin}/services/${slug}`, changefreq: 'monthly', priority: 0.7 });
  }
  return entries;
}

function isFreshArticle(row: Record<string, unknown>): boolean {
  const status = String(row.verification_status || 'verified').toLowerCase();
  if (status === 'expired' || status === 'archived' || status === 'superseded') return false;
  if (!row.expires_at) return true;
  const expires = new Date(String(row.expires_at));
  return !Number.isFinite(expires.getTime()) || expires.getTime() > Date.now();
}

function isoOrUndefined(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

/**
 * Static entries plus everything currently worth indexing from the database.
 * Never throws: a failing source removes its entries, not the sitemap.
 */
export async function collectSitemapEntries(
  client: MinimalSupabase | null,
  origin: string,
  onError?: (message: string, error: unknown) => void,
): Promise<SitemapEntry[]> {
  const entries = staticSitemapEntries(origin);
  if (!client) return entries;

  try {
    let { data, error } = await client
      .from('news_articles')
      .select('slug,updated_at,published_at,expires_at,verification_status')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(SITEMAP_MAX_ARTICLES);
    if (error) {
      // Unmigrated database: retry with the legacy column set.
      ({ data, error } = await client
        .from('news_articles')
        .select('slug,updated_at,published_at')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(SITEMAP_MAX_ARTICLES));
    }
    if (error) throw error;

    for (const row of data || []) {
      const record = row as Record<string, unknown>;
      const slug = String(record.slug || '').trim();
      if (!slug || !isFreshArticle(record)) continue;
      entries.push({
        loc: `${origin}/news/${encodeURIComponent(slug)}`,
        lastmod: isoOrUndefined(record.updated_at) || isoOrUndefined(record.published_at),
        changefreq: 'weekly',
        priority: 0.7,
      });
    }
  } catch (error) {
    onError?.('news_articles', error);
  }

  try {
    const { data, error } = await client
      .from('institutions')
      .select('school_name,acronym,state')
      .order('school_name', { ascending: true })
      .limit(SITEMAP_MAX_INSTITUTIONS);
    if (error) throw error;

    for (const row of data || []) {
      const record = row as Record<string, unknown>;
      const name = String(record.school_name || '').trim();
      const slug = schoolSlug(name);
      // Skip anything that cannot produce a resolvable slug rather than
      // advertising a URL the school finder would treat as a 404.
      if (!name || !slug) continue;
      entries.push({
        loc: `${origin}/schools/${encodeURIComponent(slug)}`,
        changefreq: 'monthly',
        priority: 0.5,
      });
    }
  } catch (error) {
    onError?.('institutions', error);
  }

  return entries;
}

/**
 * Slug used by the school finder for institution URLs.
 *
 * This must stay byte-for-byte equivalent to `itemKey()` in
 * src/components/dashboard/SchoolFinderCard.tsx, which is what the finder and
 * the detail page resolve against. The rule is duplicated rather than imported
 * so the server bundle does not pull in a React component; the behaviour is
 * pinned by a test in tests/seo.test.ts.
 */
export function schoolSlug(schoolName: string): string {
  return String(schoolName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
