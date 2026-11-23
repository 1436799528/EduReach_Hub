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

export const SOCIAL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X (Twitter)' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'custom', label: 'Another platform' },
] as const;
export type SocialPlatformKey = (typeof SOCIAL_PLATFORMS)[number]['key'];

export interface SocialLink {
  platform: SocialPlatformKey;
  /** The platform name, or the administrator's own name for a custom entry. */
  label: string;
  /** Optional public handle, stored without the leading @. */
  handle: string;
  /** Empty until an administrator configures the real profile. */
  url: string;
  /** Disabled platforms are not rendered at all. */
  visible: boolean;
}

export interface ContactDetail {
  label: string;
  value: string;
}

export interface SiteSettings {
  brand: { name: string; tagline: string };
  footer: { about: string };
  contact: {
    whatsapp: string;
    email: string;
    supportEmail: string;
    phone: string;
    note: string;
    details: ContactDetail[];
  };
  social: { links: SocialLink[] };
}

/** The eight networks the site can show without an administrator adding one. */
export function defaultSocialLinks(): SocialLink[] {
  return SOCIAL_PLATFORMS.filter((platform) => platform.key !== 'custom').map((platform) => ({
    platform: platform.key,
    label: platform.label,
    handle: '',
    url: '',
    visible: true,
  }));
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
      supportEmail: '',
      phone: '',
      note: 'Message us on WhatsApp. If you are signed in, you can also reply to the notification on your request in the dashboard.',
      details: [],
    },
    // Icons exist for every supported network, but a URL is never invented:
    // until an administrator saves one the icon is rendered without a link.
    social: { links: defaultSocialLinks() },
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

const KNOWN_PLATFORMS = new Set<string>(SOCIAL_PLATFORMS.map((platform) => platform.key));

/** Guess the icon for a link saved before platforms were stored explicitly. */
export function socialPlatformFor(label: string): SocialPlatformKey {
  const key = String(label || '').toLowerCase().replace(/[^a-z]/g, '');
  if (key.includes('facebook')) return 'facebook';
  if (key.includes('instagram')) return 'instagram';
  if (key.includes('tiktok')) return 'tiktok';
  if (key.includes('youtube')) return 'youtube';
  if (key === 'x' || key.includes('twitter')) return 'x';
  if (key.includes('whatsapp')) return 'whatsapp';
  if (key.includes('linkedin')) return 'linkedin';
  if (key.includes('telegram')) return 'telegram';
  return 'custom';
}

function cleanHandle(value: unknown): string {
  return String(value ?? '')
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 40);
}

function socialLinks(value: unknown, fallback: SocialLink[]): SocialLink[] {
  // `undefined` means the API failed and the shipped defaults should render.
  // An explicit empty array means the administrator removed every network.
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const seenLabels = new Set<string>();
  const links: SocialLink[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Partial<SocialLink>;
    const platform: SocialPlatformKey = KNOWN_PLATFORMS.has(String(raw.platform))
      ? (raw.platform as SocialPlatformKey)
      : socialPlatformFor(String(raw.label || ''));
    const label = text(raw.label, '', 40).trim();
    if (!label) continue;
    const key = platform === 'custom' ? `custom:${label.toLowerCase()}` : platform;
    if (seenLabels.has(key)) continue;
    seenLabels.add(key);
    const url = isSafeHttpsUrl(raw.url) ? String(raw.url).trim() : '';
    if (url && seen.has(url)) continue;
    if (url) seen.add(url);
    links.push({
      platform,
      label,
      handle: cleanHandle(raw.handle),
      url,
      visible: raw.visible !== false,
    });
    if (links.length === 16) break;
  }
  return links;
}

function contactDetails(value: unknown): ContactDetail[] {
  if (!Array.isArray(value)) return [];
  const details: ContactDetail[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const label = text((entry as ContactDetail).label, '', 40).trim();
    const detail = text((entry as ContactDetail).value, '', 120).trim();
    if (!label || !detail) continue;
    details.push({ label, value: detail });
    if (details.length === 8) break;
  }
  return details;
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
      whatsapp:
        String(contact.whatsapp ?? base.contact.whatsapp).replace(/[^0-9]/g, '').slice(0, 15) ||
        base.contact.whatsapp,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '',
      supportEmail: (() => {
        const value = typeof contact.supportEmail === 'string' ? contact.supportEmail.trim() : '';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? value : '';
      })(),
      phone: String(contact.phone ?? '')
        .replace(/[^0-9+()\-\s]/g, '')
        .trim()
        .slice(0, 24),
      note: text(contact.note, base.contact.note, 300),
      details: contactDetails(contact.details),
    },
    social: { links: socialLinks(social.links, base.social.links) },
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
