/**
 * One image pipeline, used everywhere an image is rendered.
 *
 * The rules this module encodes:
 *
 *   1. **Same-origin assets are transformed by Netlify's Image CDN**, which
 *      serves WebP (and AVIF where the browser accepts it) at the size the layout
 *      asks for. A 2000px photograph is never sent to a 300px card.
 *   2. **A remote image is never rewritten.** An institution's logo lives on the
 *      institution's server; asking our CDN to proxy an arbitrary URL we have not
 *      validated would be a hotlink with extra steps. So a remote URL is
 *      validated, rendered as-is with `referrerPolicy="no-referrer"`, and left
 *      alone. If it fails to load, a neutral placeholder is shown.
 *   3. **`immutable` is only ever claimed for content-hashed or CDN-transformed
 *      URLs.** `/assets/index-a1b2c3.js` can never change; `/news/photos/x.jpg`
 *      can.
 *
 * Nothing here invents an image. A missing image stays missing.
 */

export const IMAGE_CDN_PATH = '/.netlify/images';

export const IMAGE_QUALITY = 72;

/**
 * The neutral placeholder. It is a drawing, not a photograph of a campus: using a
 * stock school photo for a different institution is exactly the fabrication this
 * project forbids.
 */
export const NEUTRAL_IMAGE_PLACEHOLDER = '/images/neutral-placeholder.svg';

export interface ImageEnvironment {
  /** Built for production. In dev the Express server has no image CDN. */
  production: boolean;
  /** `window.location.hostname`, or null when there is no window (tests, SSR). */
  hostname: string | null;
  /** `VITE_IMAGE_CDN=off` disables transformation explicitly. */
  disabled?: boolean;
}

export function detectImageEnvironment(): ImageEnvironment {
  let production = false;
  try {
    production = Boolean((import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD);
  } catch {
    // `import.meta.env` is absent outside Vite (tests, scripts); not production.
  }
  const hostname = typeof window === 'undefined' ? null : window.location.hostname;
  return { production, hostname };
}

/**
 * Is the Image CDN in front of this page?
 *
 * Only a production build served from a real host gets `/.netlify/images`. A
 * local preview (`localhost`, the sandbox host) keeps the original file, so a
 * missing CDN never turns every image into a broken request.
 */
export function imageCdnEnabled(env: ImageEnvironment = detectImageEnvironment()): boolean {
  if (env.disabled) return false;
  if (!env.production) return false;
  const host = String(env.hostname ?? '').trim().toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]') return false;
  if (host.endsWith('.local') || host.endsWith('.e2b.app')) return false;
  return true;
}

/** A path on this site, not a protocol-relative URL. */
export function isLocalImagePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

/**
 * Validate what an editor or an article stored, and return either a path we may
 * serve or an absolute https URL we may link. Everything else is dropped:
 * `http:` (mixed content), `data:` (an image hidden in a string), `javascript:`,
 * credentials in the URL, and protocol-relative URLs that dodge our origin check.
 */
export function safeImageUrl(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (isLocalImagePath(value)) {
    return /\s/.test(value) ? null : value;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  return url.toString();
}

/** A remote image: validated, but never handed to our CDN. */
export function isRemoteImage(value: string | null): boolean {
  return Boolean(value && /^https:\/\//i.test(value));
}

export interface TransformOptions {
  width: number;
  height?: number;
  /** 1–100. Left at the module default unless a surface has a reason. */
  quality?: number;
  /** `image/webp` or `image/avif`; Netlify accepts `webp` / `avif`. */
  format?: 'webp' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * The CDN URL for one transformed variant.
 *
 * `encodeURIComponent` on the source matters: the CDN parses `url` as a query
 * parameter, so an unencoded `?` or `&` in the original would truncate it.
 */
export function transformedImageUrl(src: string, options: TransformOptions): string {
  if (!isLocalImagePath(src)) return src;
  const params = new URLSearchParams();
  params.set('url', src);
  params.set('w', String(Math.round(options.width)));
  if (options.height) params.set('h', String(Math.round(options.height)));
  params.set('fit', options.fit ?? (options.height ? 'cover' : 'max'));
  params.set('fm', options.format ?? 'webp');
  params.set('q', String(options.quality ?? IMAGE_QUALITY));
  return `${IMAGE_CDN_PATH}?${params.toString()}`;
}

/**
 * The widths worth generating for a layout slot: the slot itself plus a half-size
 * and a 2× variant for dense screens, clamped to a sane range.
 *
 * The point is that a 300px card never receives a 1280px file. The 2× variant
 * exists because a retina phone at 300 CSS pixels genuinely needs 600 device
 * pixels; nothing above that is offered.
 */
export function widthsFor(width: number): number[] {
  const slot = Number.isFinite(width) && width > 0 ? Math.round(width) : 640;
  const candidates = [slot / 2, slot, slot * 2]
    .map((candidate) => Math.round(candidate))
    .filter((candidate) => candidate >= 160 && candidate <= 1600);
  if (!candidates.length) candidates.push(Math.min(Math.max(slot, 160), 1600));
  return [...new Set(candidates)].sort((a, b) => a - b);
}

/**
 * `srcset` for one format. An empty string means "no responsive variants", and
 * the caller renders the single original instead.
 */
export function buildSrcSet(
  src: string,
  widths: number[],
  options: Omit<TransformOptions, 'width'> = {},
): string {
  if (!isLocalImagePath(src) || !widths.length) return '';
  return widths
    .map((width) => `${transformedImageUrl(src, { ...options, width })} ${width}w`)
    .join(', ');
}

/** Sensible `sizes` for the three layouts the site uses. */
export function sizesFor(layout: 'card' | 'row' | 'hero' | 'article'): string {
  switch (layout) {
    case 'card':
      return '(min-width: 1024px) 300px, (min-width: 640px) 45vw, 92vw';
    case 'row':
      return '112px';
    case 'hero':
      return '(min-width: 1024px) 960px, 100vw';
    case 'article':
    default:
      return '(min-width: 1024px) 760px, 100vw';
  }
}

/**
 * The cache policy an image response may carry.
 *
 * `immutable` is a promise that the bytes will never change. Only a content-hashed
 * asset or a CDN transform can keep that promise, so those are the only two cases
 * that get it.
 */
export function imageCacheControl(src: string | null): string {
  if (!src) return 'no-store';
  if (src.startsWith(IMAGE_CDN_PATH) || /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i.test(src)) {
    return 'public, max-age=31536000, immutable';
  }
  if (isLocalImagePath(src)) return 'public, max-age=3600, stale-while-revalidate=86400';
  // A remote image is not ours to cache with our own policy.
  return 'no-store';
}

/** The placeholder a failed image falls back to. Same drawing, no invention. */
export function placeholderFor(_src: string | null | undefined): string {
  return NEUTRAL_IMAGE_PLACEHOLDER;
}
