/**
 * The shape of the public site content, and the fallback used when it cannot be
 * loaded.
 *
 * Two rules make this file worth its own module:
 *
 *  1. The footer and the policy pages must render even when the API is down.
 *     `DEFAULT_SITE_CONTENT` is the content the site shipped before these
 *     tables existed, so a failed request degrades to the old page instead of
 *     an empty footer.
 *  2. A partial or malformed response must never put `undefined` on the page.
 *     `mergeSiteSettings` applies the defaults field by field.
 *
 * Dependency-free on purpose: imported by the browser, the Express server and
 * the tests.
 */

export const POLICY_SLUGS = ['privacy', 'terms', 'cookies', 'accessibility', 'disclaimer', 'contact'] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

export interface SocialLink {
  label: string;
  url: string;
}

export interface SiteSettings {
  brand: { name: string; tagline: string };
  footer: { about: string };
  contact: { whatsapp: string; email: string; note: string };
  social: { links: SocialLink[] };
}

export interface SitePage {
  slug: PolicySlug;
  title: string;
  summary: string;
  body: string;
  status: 'draft' | 'published';
  reviewState: 'pending' | 'approved';
  revision: number;
  updatedAt: string | null;
  publishedAt: string | null;
}

export interface SiteContentPayload {
  settings: SiteSettings;
  pages: SitePage[];
}

/** Mirrors the footer that shipped in HubLayout.tsx before this was stored. */
export const DEFAULT_SITE_CONTENT: SiteContentPayload = {
  settings: {
    brand: {
      name: 'EduReach Hub',
      tagline: 'CBT practice, past questions and student services for Nigerian students.',
    },
    footer: {
      about: 'Practice for JAMB, WAEC, NECO and Post-UTME, and help with the student services that are hardest to navigate.',
    },
    contact: {
      whatsapp: '2349130134969',
      email: '',
      note: 'Message us on WhatsApp. If you are signed in, you can also reply to the notification on your request in the dashboard.',
    },
    social: { links: [] },
  },
  pages: [],
};

export function isPolicySlug(value: unknown): value is PolicySlug {
  return typeof value === 'string' && (POLICY_SLUGS as readonly string[]).includes(value);
}

/**
 * A WhatsApp deep link from a number the administrator stored. Digits only:
 * anything else is a typo or an attempt to smuggle a scheme into an href.
 */
export function whatsappHref(digits: string): string | null {
  const clean = String(digits || '').replace(/[^0-9]/g, '');
  if (clean.length < 8 || clean.length > 15) return null;
  return `https://wa.me/${clean}`;
}

/** Only https links are rendered. A stored `javascript:` never becomes an href. */
export function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw || raw.length > 300) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function text(value: unknown, fallback: string, max = 400): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function socialLinks(value: unknown): SocialLink[] {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const links: SocialLink[] = [];
  for (const entry of source) {
    if (!entry || typeof entry !== 'object') continue;
    const label = text((entry as SocialLink).label, '', 40).trim();
    const url = (entry as SocialLink).url;
    if (!label || !isSafeHttpsUrl(url) || seen.has(url)) continue;
    seen.add(url);
    links.push({ label, url });
    if (links.length === 8) break;
  }
  return links;
}

/**
 * Settings as the page should render them: every field present, every URL
 * checked, nothing that failed validation rendered.
 */
export function mergeSiteSettings(raw: unknown): SiteSettings {
  const base = DEFAULT_SITE_CONTENT.settings;
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<SiteSettings> & Record<string, unknown>;
  const brand = (value.brand && typeof value.brand === 'object' ? value.brand : {}) as Partial<SiteSettings['brand']>;
  const footer = (value.footer && typeof value.footer === 'object' ? value.footer : {}) as Partial<SiteSettings['footer']>;
  const contact = (value.contact && typeof value.contact === 'object' ? value.contact : {}) as Partial<SiteSettings['contact']>;
  const social = (value.social && typeof value.social === 'object' ? value.social : {}) as { links?: unknown };

  const email = typeof contact.email === 'string' ? contact.email.trim() : '';
  return {
    brand: {
      name: text(brand.name, base.brand.name, 60),
      tagline: text(brand.tagline, base.brand.tagline, 160),
    },
    footer: { about: text(footer.about, base.footer.about, 400) },
    contact: {
      whatsapp: String(contact.whatsapp ?? base.contact.whatsapp).replace(/[^0-9]/g, '').slice(0, 15) || base.contact.whatsapp,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '',
      note: text(contact.note, base.contact.note, 300),
    },
    social: { links: socialLinks(social.links) },
  };
}

/** A page row (or API object) as the page should render it, or null. */
export function mergeSitePage(raw: unknown): SitePage | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (!isPolicySlug(value.slug)) return null;
  const status = value.status === 'published' ? 'published' : value.status === 'draft' ? 'draft' : null;
  if (!status) return null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const body = typeof value.body === 'string' ? value.body.trim() : '';
  if (!title || !body) return null;
  return {
    slug: value.slug,
    title: title.slice(0, 120),
    summary: typeof value.summary === 'string' ? value.summary.trim().slice(0, 300) : '',
    body,
    status,
    reviewState: value.reviewState === 'approved' || value.review_state === 'approved' ? 'approved' : 'pending',
    revision: Number.isFinite(Number(value.revision)) ? Math.max(1, Math.trunc(Number(value.revision))) : 1,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : typeof value.updated_at === 'string' ? value.updated_at : null,
    publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : typeof value.published_at === 'string' ? value.published_at : null,
  };
}

/** Whole payload, defensively merged. Used by the client on every render. */
export function mergeSiteContent(raw: unknown): SiteContentPayload {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pages = Array.isArray(value.pages)
    ? value.pages.map(mergeSitePage).filter((page): page is SitePage => page !== null)
    : [];
  return { settings: mergeSiteSettings(value.settings), pages };
}
