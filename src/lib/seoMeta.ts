/**
 * Route metadata: title, description, canonical URL, robot directive and
 * structured data.
 *
 * The public site is a client-rendered SPA, so this module is the single place
 * that turns "which route is open" and "which record is loaded" into what a
 * crawler or link preview should read. Two rules keep it honest:
 *
 *   1. There is exactly one canonical URL per resource. Aliases canonicalise.
 *   2. Nothing that should not be indexed is ever given a canonical URL that
 *      would invite indexing.
 *
 * Server-side enforcement lives in `server.ts` (X-Robots-Tag) and
 * `src/server/seo.ts` (robots.txt, sitemap.xml); this module is the client half.
 */

import { isLiveServiceSlug } from '../data/liveServices';
import { pageTitleFor } from './pageMeta';

export const SITE_NAME = 'EduReach Hub';
export const DEFAULT_TITLE = 'EduReach Hub — Student Services, CBT & Education Updates';
export const DEFAULT_DESCRIPTION =
  'EduReach Hub brings verified student services, CBT practice, education news, scholarships, admission tools and a student dashboard together for Nigerian students.';

export type StructuredData = Record<string, unknown>;

export interface SeoMeta {
  title: string;
  description: string;
  /** Absolute or site-relative canonical path. `null` means "do not canonicalise". */
  canonicalPath: string | null;
  indexable: boolean;
  image?: string | null;
  type?: 'website' | 'article';
  publishedTime?: string | null;
  modifiedTime?: string | null;
  structuredData?: StructuredData | null;
}

/** Alias → canonical. One canonical URL per resource. */
const CANONICAL_ALIASES: Record<string, string> = {
  '/signin': '/login',
  '/signup': '/register',
  '/calculator': '/screening-calculator',
  '/cgpa-calculator': '/tools/cgpa-calculator',
  '/scholarships': '/jobs',
  '/track': '/services/track',
  '/dashboard/applications': '/dashboard/services',
  '/dashboard/past-questions': '/dashboard/cbt',
  '/dashboard/saved': '/dashboard/tools',
  '/dashboard/notifications': '/dashboard',
  '/dashboard/settings': '/settings',
  '/dashboard/profile': '/profile/complete',
  '/profile': '/profile/complete',
};

const AUTH_PATHS = new Set([
  '/login', '/register', '/forgot-password', '/reset-password', '/verify-email',
]);

/** Prefixes that must never be indexed, whatever their content. */
const PRIVATE_PREFIXES = [
  '/admin', '/dashboard', '/profile', '/settings', '/search', '/api',
  '/cbt/practice', '/cbt/results', '/cbt/setup', '/services/track', '/track',
];

const AUTH_AND_PRIVATE_EXACT = new Set(['/services/track', '/track']);

/** Routes that render an honest placeholder until real content exists. */
const PLACEHOLDER_PATHS = new Set(['/nabteb', '/tools', '/support']);
const PLACEHOLDER_PREFIXES = ['/admission'];

/** Per-route copy for the surfaces that carry search traffic. */
const ROUTE_META: Record<string, { title: string; description: string }> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  '/news': {
    title: 'Education News & Verified Student Updates | EduReach Hub',
    description:
      'Verified updates for Nigerian students: JAMB, WAEC, NECO, NABTEB, admission lists, NELFUND, school notices and deadlines — each with its source and expiry.',
  },
  '/events': {
    title: 'Student Deadlines & Academic Calendar | EduReach Hub',
    description:
      'Upcoming academic dates and student deadlines in one calendar, so registration windows, examinations and resumption dates are not missed.',
  },
  '/jobs': {
    title: 'Scholarships, Grants, Jobs & Fellowships for Nigerian Students | EduReach Hub',
    description:
      'Open opportunities for Nigerian students with eligibility, deadlines and the official application link. Closed opportunities are removed automatically.',
  },
  '/schools': {
    title: 'Nigerian Universities, Polytechnics & Colleges Directory | EduReach Hub',
    description:
      'Search Nigerian institutions by name, state and type, and reach each institution\u2019s official website. EduReach is independent and not affiliated with any institution.',
  },
  '/services': {
    title: 'Student Services: NELFUND, Results, JAMB Slip & Admission Letters | EduReach Hub',
    description:
      'EduReach service catalogue: what each student service does, the requirements, and how to start a request and track it to completion.',
  },
  '/cbt': {
    title: 'CBT Practice for JAMB, WAEC, NECO & Post-UTME | EduReach Hub',
    description:
      'Practise computer-based tests with real timed papers, subject selection and instant scoring. Answer keys stay server-side; every active bank is real content.',
  },
  '/past-questions': {
    title: 'Past Questions & CBT Practice | EduReach Hub',
    description:
      'Practise past-question style CBT papers by examination and subject, with instant scoring and explanations.',
  },
  '/screening-calculator': {
    title: 'Post-UTME Screening Score Calculator | EduReach Hub',
    description:
      'Work out your screening aggregate from JAMB and O\u2019Level results before you check the official institution portal.',
  },
  '/tools/cgpa-calculator': {
    title: 'CGPA Calculator for Nigerian University Students | EduReach Hub',
    description:
      'Calculate semester GPA and cumulative CGPA by course units and grades, and save your terms in your EduReach dashboard.',
  },
  '/jamb': {
    title: 'JAMB UTME Hub: Registration, CBT & Admission Updates | EduReach Hub',
    description:
      'JAMB UTME guidance, practice and verified updates — registration windows, exam slips, CAPS and admission lists, always pointing at the official JAMB portal.',
  },
  '/waec': {
    title: 'WAEC Hub: WASSCE Registration, Timetable & Results | EduReach Hub',
    description:
      'WAEC WASSCE guidance and verified updates: registration windows, timetables and result notices from the official WAEC Nigeria source.',
  },
  '/neco': {
    title: 'NECO Hub: SSCE Registration, Timetable & Results | EduReach Hub',
    description:
      'NECO SSCE and GCE guidance with verified updates on registration, timetables and results from the official NECO source.',
  },
  '/post-utme': {
    title: 'Post-UTME Hub: Screening, Cut-off Marks & Admission Lists | EduReach Hub',
    description:
      'Post-UTME screening guidance for Nigerian institutions: what to expect, how aggregates are computed, and verified updates from the institutions themselves.',
  },
};

export function normalizePath(pathname: string): string {
  const trimmed = String(pathname || '/').split('?')[0].split('#')[0];
  const normalized = trimmed.replace(/\/+$/, '');
  return normalized || '/';
}

/** Canonical path for any route, including dynamic prefixes. */
export function canonicalPathFor(pathname: string): string {
  const path = normalizePath(pathname);
  const direct = CANONICAL_ALIASES[path];
  if (direct) return direct;

  const applyMatch = path.match(/^\/services\/apply\/([^/]+)$/);
  if (applyMatch) return `/services/${applyMatch[1]}`;

  return path;
}

export function isIndexablePath(pathname: string): boolean {
  const path = canonicalPathFor(pathname);
  if (AUTH_PATHS.has(path)) return false;
  if (AUTH_AND_PRIVATE_EXACT.has(path)) return false;
  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
  if (PLACEHOLDER_PATHS.has(path)) return false;
  if (PLACEHOLDER_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
  // A service without a live workflow renders the coming-soon panel.
  const serviceMatch = path.match(/^\/services\/([^/]+)$/);
  if (serviceMatch && !isLiveServiceSlug(serviceMatch[1])) return false;
  return true;
}

function descriptionFor(path: string): string {
  return ROUTE_META[path]?.description || DEFAULT_DESCRIPTION;
}

function titleFor(path: string): string {
  const known = ROUTE_META[path];
  if (known) return known.title;
  if (path.startsWith('/news/')) return `Verified Student Update | ${SITE_NAME}`;
  if (path.startsWith('/schools/')) return `Institution Profile | ${SITE_NAME}`;
  if (path.startsWith('/services/')) return `Student Service | ${SITE_NAME}`;
  const helperTitle = pageTitleFor(path);
  return helperTitle && helperTitle !== 'Page Not Found' ? `${helperTitle} | ${SITE_NAME}` : DEFAULT_TITLE;
}

/** Metadata for a route with no record-specific data. */
export function seoForPath(pathname: string): SeoMeta {
  const canonicalPath = canonicalPathFor(pathname);
  const indexable = isIndexablePath(canonicalPath);
  return {
    title: titleFor(canonicalPath),
    description: descriptionFor(canonicalPath),
    canonicalPath: indexable ? canonicalPath : null,
    indexable,
    type: 'website',
    structuredData: canonicalPath === '/' ? websiteStructuredData() : null,
  };
}

export function websiteStructuredData(): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'EduReach',
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'en-NG',
  };
}

function truncate(value: string, maxLength: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function httpsImage(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface ArticleSeoInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  image_url?: string | null;
  category?: string | null;
  source_name?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  expires_at?: string | null;
  verification_status?: string | null;
}

export function isArticleFresh(article: Pick<ArticleSeoInput, 'expires_at' | 'verification_status'>): boolean {
  const status = String(article.verification_status || 'verified').toLowerCase();
  if (status === 'expired' || status === 'archived' || status === 'superseded') return false;
  if (!article.expires_at) return true;
  const expires = new Date(String(article.expires_at));
  return !Number.isFinite(expires.getTime()) || expires.getTime() > Date.now();
}

/** Metadata for an article page. Expired articles stay readable but leave the index. */
export function seoForArticle(article: ArticleSeoInput): SeoMeta {
  const canonicalPath = `/news/${encodeURIComponent(String(article.slug))}`;
  const fresh = isArticleFresh(article);
  const image = httpsImage(article.image_url);
  const description = truncate(
    article.excerpt || `${article.title} — verified update for Nigerian students on EduReach Hub.`,
    158,
  );
  const publishedTime = article.published_at || null;
  const modifiedTime = article.updated_at || article.published_at || null;

  return {
    title: truncate(`${article.title} | EduReach Hub`, 70),
    description,
    canonicalPath: fresh ? canonicalPath : null,
    indexable: fresh,
    image,
    type: 'article',
    publishedTime,
    modifiedTime,
    structuredData: fresh
      ? {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: truncate(article.title, 110),
          description,
          inLanguage: 'en-NG',
          ...(publishedTime ? { datePublished: publishedTime } : {}),
          ...(modifiedTime ? { dateModified: modifiedTime } : {}),
          ...(image ? { image: [image] } : {}),
          ...(article.category ? { articleSection: article.category } : {}),
          ...(article.source_name ? { citation: article.source_name } : {}),
          isAccessibleForFree: true,
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            description: 'Independent Nigerian student-support platform.',
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalPath },
        }
      : null,
  };
}

export interface InstitutionSeoInput {
  slug: string;
  school_name: string;
  acronym?: string | null;
  state?: string | null;
  institution_type?: string | null;
  website_url?: string | null;
}

/** Metadata for an institution page. Only sourced facts reach the description. */
export function seoForInstitution(institution: InstitutionSeoInput): SeoMeta {
  const name = String(institution.school_name || 'Institution');
  const acronym = String(institution.acronym || '').trim();
  const state = String(institution.state || '').trim();
  const type = String(institution.institution_type || 'Institution').trim();
  const canonicalPath = `/schools/${encodeURIComponent(String(institution.slug))}`;

  // Leads with "Official EduReach page for …" so a search result cannot be
  // mistaken for the institution's own site, and always carries the
  // independence statement.
  const description = truncate(
    `Official EduReach page for ${name}${acronym ? ` (${acronym})` : ''} — ${type}${state ? ` in ${state} state` : ''}. Independent platform, not affiliated with this institution.`,
    158,
  );

  const structuredType = /universit|polytechnic|college/i.test(type) ? 'CollegeOrUniversity' : 'EducationalOrganization';

  return {
    title: truncate(`${name}${acronym ? ` (${acronym})` : ''} — Institution Profile | EduReach Hub`, 70),
    description,
    canonicalPath,
    indexable: true,
    type: 'website',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': structuredType,
      name,
      ...(acronym ? { alternateName: acronym } : {}),
      ...(httpsImage(institution.website_url) || institution.website_url
        ? { url: httpsImage(institution.website_url) || undefined }
        : {}),
      ...(state ? { address: { '@type': 'PostalAddress', addressRegion: state, addressCountry: 'NG' } } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// DOM application (browser)
// ---------------------------------------------------------------------------

const JSON_LD_SELECTOR = 'script[data-edureach-seo="jsonld"]';

function documentOrNull(): Document | null {
  return typeof document === 'undefined' ? null : document;
}

function upsertMeta(doc: Document, attribute: 'name' | 'property', key: string, content: string): void {
  let element = doc.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = doc.createElement('meta');
    element.setAttribute(attribute, key);
    doc.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function removeMeta(doc: Document, attribute: 'name' | 'property', key: string): void {
  doc.head.querySelectorAll(`meta[${attribute}="${key}"]`).forEach((element) => element.remove());
}

export function siteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

export function absoluteUrl(pathOrUrl: string | null, origin: string): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${origin.replace(/\/+$/, '')}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

/** Writes the route's metadata into the document head. Safe to call on every navigation. */
export function applySeo(meta: SeoMeta, origin = siteOrigin()): void {
  const doc = documentOrNull();
  if (!doc) return;

  doc.title = meta.title;
  upsertMeta(doc, 'name', 'description', meta.description);

  // Robots: private and placeholder routes are excluded here and again on the
  // server (X-Robots-Tag) and in robots.txt.
  upsertMeta(doc, 'name', 'robots', meta.indexable ? 'index,follow' : 'noindex,nofollow');

  const canonicalUrl = meta.canonicalPath ? absoluteUrl(meta.canonicalPath, origin) : '';
  const existing = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonicalUrl) {
    if (existing) existing.setAttribute('href', canonicalUrl);
    else {
      const link = doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      link.setAttribute('href', canonicalUrl);
      doc.head.appendChild(link);
    }
  } else if (existing) {
    existing.remove();
  }

  upsertMeta(doc, 'property', 'og:site_name', SITE_NAME);
  upsertMeta(doc, 'property', 'og:title', meta.title);
  upsertMeta(doc, 'property', 'og:description', meta.description);
  upsertMeta(doc, 'property', 'og:type', meta.type || 'website');
  upsertMeta(doc, 'property', 'og:locale', 'en_NG');
  if (canonicalUrl) upsertMeta(doc, 'property', 'og:url', canonicalUrl);
  else removeMeta(doc, 'property', 'og:url');

  const image = httpsImage(meta.image);
  if (image) upsertMeta(doc, 'property', 'og:image', image);
  else removeMeta(doc, 'property', 'og:image');

  upsertMeta(doc, 'name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  upsertMeta(doc, 'name', 'twitter:title', meta.title);
  upsertMeta(doc, 'name', 'twitter:description', meta.description);
  if (image) upsertMeta(doc, 'name', 'twitter:image', image);
  else removeMeta(doc, 'name', 'twitter:image');

  if (meta.publishedTime) upsertMeta(doc, 'property', 'article:published_time', meta.publishedTime);
  else removeMeta(doc, 'property', 'article:published_time');

  doc.head.querySelectorAll(JSON_LD_SELECTOR).forEach((element) => element.remove());
  if (meta.structuredData) {
    const script = doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-edureach-seo', 'jsonld');
    script.textContent = JSON.stringify(meta.structuredData);
    doc.head.appendChild(script);
  }
}

/** Convenience wrapper used by the app shell on every route change. */
export function applyRouteSeo(pathname: string, origin = siteOrigin()): SeoMeta {
  const meta = seoForPath(pathname);
  applySeo(meta, origin);
  return meta;
}
