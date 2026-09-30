/**
 * Text, URL and hashing primitives for the EduReach newsroom.
 *
 * Everything here is deterministic and dependency-free so the pipeline can be
 * unit tested without network access and so a re-run against the same input
 * always produces the same dedupe keys.
 */

/** Words that carry no dedupe signal in a headline. */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'has', 'have', 'he', 'her', 'his', 'in', 'into', 'is', 'it', 'its', 'of', 'on',
  'or', 'our', 'she', 'that', 'the', 'their', 'they', 'this', 'to', 'was', 'were',
  'will', 'with', 'you', 'your', 'we', 'us', 'not', 'no', 'than', 'then', 'over',
  'after', 'before', 'about', 'up', 'out', 'all', 'any', 'can', 'may', 'more',
]);

/** Query parameters that never change which resource a URL points at. */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^igshid$/i,
  /^mc_(cid|eid)$/i,
  /^ref$/i,
  /^source$/i,
  /^src$/i,
  /^cmpid$/i,
  /^share$/i,
  /^_ga$/i,
];

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–',
  mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…',
  eacute: 'é', egrave: 'è', pound: '£', euro: '€', times: '×', bull: '•',
};

export function decodeHtmlEntities(value: string): string {
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return HTML_ENTITY_MAP[key] ?? match;
  });
}

export function stripHtml(value: string): string {
  return normalizeWhitespace(
    decodeHtmlEntities(
      String(value || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  );
}

export function normalizeWhitespace(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/** Plain text ready for storage: entities decoded, tags dropped, spaced. */
export function toPlainText(value: string, maxLength = 20000): string {
  return normalizeWhitespace(stripHtml(value)).slice(0, maxLength);
}

export function stripCdata(value: string): string {
  return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/** Case/punctuation-insensitive headline used for exact and fuzzy matching. */
export function normalizeTitle(value: string): string {
  return normalizeWhitespace(
    decodeHtmlEntities(String(value || ''))
      .toLowerCase()
      // Normalise curly quotes and dashes so "JAMB’s" and "JAMB's" match.
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/[^a-z0-9'\s-]/g, ' ')
      .replace(/\s*-\s*/g, ' '),
  );
}

export function tokenize(value: string): string[] {
  return normalizeTitle(value)
    .split(/[\s'-]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/** Jaccard similarity over token sets — 0 (unrelated) to 1 (identical). */
export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** FNV-1a 64-bit, returned as 16 hex characters. Stable across processes. */
export function hash64(value: string): string {
  const FNV_OFFSET = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK = 0xffffffffffffffffn;
  let hash = FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * 64-bit SimHash over the token multiset. Near-identical headlines produce
 * hashes a few bits apart, which is what makes fuzzy duplicate detection work
 * when two outlets word the same story differently.
 */
export function simhash64(tokens: string[]): string {
  const weights = new Array<number>(64).fill(0);
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  if (!counts.size) return '0'.repeat(16);

  for (const [token, count] of counts) {
    const hash = BigInt(`0x${hash64(token)}`);
    for (let bit = 0; bit < 64; bit += 1) {
      const mask = 1n << BigInt(63 - bit);
      weights[bit] += (hash & mask) === 0n ? -count : count;
    }
  }

  let value = 0n;
  for (let bit = 0; bit < 64; bit += 1) {
    if (weights[bit] > 0) value |= 1n << BigInt(63 - bit);
  }
  return value.toString(16).padStart(16, '0');
}

export function hammingDistance(a: string, b: string): number {
  if (!/^[0-9a-f]{16}$/.test(a) || !/^[0-9a-f]{16}$/.test(b)) return 64;
  let difference = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (difference > 0n) {
    difference &= difference - 1n;
    count += 1;
  }
  return count;
}

/**
 * Canonical form of a URL for dedupe purposes: no tracking parameters, no
 * fragment, no trailing slash, no www, https assumed. Two links that a human
 * would call "the same article" should collapse to one string.
 */
export function canonicalUrl(rawUrl: string, baseUrl?: string): string {
  let url: URL;
  try {
    url = new URL(String(rawUrl || '').trim(), baseUrl);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';

  const keep: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) return;
    keep.push([key, value]);
  });
  keep.sort(([a], [b]) => a.localeCompare(b));

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const query = keep.map(([key, value]) => `${key}=${value}`).join('&');
  return `https://${host}${path}${query ? `?${query}` : ''}`;
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

export function hostOf(value: string): string {
  try {
    return new URL(String(value || '').trim()).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Slug used for public article URLs. Kept ASCII and collision-checked by the
 * caller, which appends a short hash suffix when the base is taken.
 */
export function slugify(value: string, maxLength = 80): string {
  const slug = decodeHtmlEntities(String(value || ''))
    .toLowerCase()
    .replace(/[’‘]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug || 'update';
}

/**
 * Content signature for the "is this literally the same text" check. Only
 * meaningful above a minimum length; short excerpts collide by accident.
 */
export function contentHash(title: string, body: string): string {
  const text = `${normalizeTitle(title)} ${normalizeTitle(body).slice(0, 2000)}`.trim();
  if (text.length < 40) return '';
  return hash64(text);
}

/** Stable key that the unique index on news_articles.dedupe_key enforces. */
export function dedupeKeyFor(input: { canonicalUrl: string; title: string }): string {
  if (input.canonicalUrl) return `u:${hash64(input.canonicalUrl)}`;
  const tokens = tokenize(input.title).sort();
  return `t:${hash64(tokens.join(' '))}`;
}

/** Days between two dates, used for the "same event, same week" signal. */
export function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return Math.abs(first - second) / 86_400_000;
}

export function truncate(value: string, maxLength: number): string {
  const text = normalizeWhitespace(value);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
