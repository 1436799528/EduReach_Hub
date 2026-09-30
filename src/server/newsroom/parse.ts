/**
 * Feed, HTML and metadata parsing for the newsroom.
 *
 * Deliberately regex-based and dependency-free: feeds are the only structured
 * input we accept, the extraction targets are well-known meta tags, and a
 * small parser is far easier to test and audit than a general document model.
 *
 * Note on scope: the parser reads headline, link, source summary and image
 * only. It never captures the full article text, because EduReach attributes
 * and links to sources rather than reproducing them.
 */

import {
  canonicalUrl,
  decodeHtmlEntities,
  hostOf,
  normalizeWhitespace,
  stripCdata,
  stripHtml,
  toPlainText,
} from './text';

export interface ParsedItem {
  title: string;
  url: string;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  categories: string[];
  author: string | null;
}

export interface PageMeta {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  siteName: string | null;
}

function tagValue(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) return null;
  return normalizeWhitespace(stripHtml(stripCdata(match[1])));
}

function tagValues(block: string, tag: string): string[] {
  const results: string[] = [];
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block))) {
    const value = normalizeWhitespace(stripHtml(stripCdata(match[1])));
    if (value) results.push(value);
  }
  return results;
}

function atomLink(block: string): string | null {
  const alternate = block.match(/<link[^>]+rel=["']alternate["'][^>]*>/i) || block.match(/<link[^>]*>/i);
  if (!alternate) return null;
  const href = alternate[0].match(/href=["']([^"']+)["']/i);
  return href ? href[1].trim() : null;
}

function absoluteUrl(value: string | null, baseUrl: string): string {
  if (!value) return '';
  try {
    const url = new URL(decodeHtmlEntities(value.trim()), baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  // Reject dates far outside a believable window (bad publisher clocks).
  const now = Date.now();
  if (parsed.getTime() > now + 2 * 86_400_000) return null;
  if (parsed.getTime() < now - 400 * 86_400_000) return null;
  return parsed.toISOString();
}

function itemImage(block: string, baseUrl: string): string | null {
  const candidates = [
    block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i)?.[1],
    block.match(/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i)?.[1],
    block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i)?.[1],
    block.match(/<itunes:image[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1],
    block.match(/<image[^>]*>([\s\S]*?)<\/image>/i)?.[1]?.match(/<url>([\s\S]*?)<\/url>/i)?.[1],
  ];
  for (const candidate of candidates) {
    const absolute = absoluteUrl(candidate ?? null, baseUrl);
    if (absolute) return absolute;
  }
  return null;
}

/**
 * Parses RSS 2.0, RDF/RSS 1.0 and Atom documents. Returns [] for anything it
 * does not recognise so a malformed feed degrades to "no new items" instead of
 * taking down the run.
 */
export function parseFeed(xml: string, feedUrl: string): ParsedItem[] {
  const source = stripCdata(String(xml || ''));
  if (!source) return [];

  const blocks = [
    ...source.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...source.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
  ].map((match) => match[0]);

  const items: ParsedItem[] = [];
  for (const block of blocks) {
    const title = tagValue(block, 'title') || '';
    const link = absoluteUrl(tagValue(block, 'link') || atomLink(block), feedUrl);
    if (!title || !link) continue;

    const description =
      tagValue(block, 'description') ||
      tagValue(block, 'summary') ||
      tagValue(block, 'media:description') ||
      null;

    items.push({
      title,
      url: link,
      excerpt: description ? toPlainText(description, 600) : null,
      imageUrl: itemImage(block, feedUrl),
      publishedAt: normalizeDate(
        tagValue(block, 'pubDate') || tagValue(block, 'published') || tagValue(block, 'updated') || tagValue(block, 'dc:date'),
      ),
      categories: tagValues(block, 'category').slice(0, 6),
      author: tagValue(block, 'dc:creator') || tagValue(block, 'author') || null,
    });
  }

  return items;
}

/** Minimal JSON Feed (jsonfeed.org) support. */
export function parseJsonFeed(payload: unknown, feedUrl: string): ParsedItem[] {
  const items = (payload as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return [];

  return items.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const title = normalizeWhitespace(String(record.title || ''));
    const link = absoluteUrl(typeof record.url === 'string' ? record.url : null, feedUrl);
    if (!title || !link) return [];
    const summary = typeof record.summary === 'string' ? record.summary : '';
    return [{
      title,
      url: link,
      excerpt: summary ? toPlainText(summary, 600) : null,
      imageUrl: absoluteUrl(typeof record.image === 'string' ? record.image : null, feedUrl) || null,
      publishedAt: normalizeDate(
        typeof record.date_published === 'string' ? record.date_published : null,
      ),
      categories: Array.isArray(record.tags) ? record.tags.map(String).slice(0, 6) : [],
      author: null,
    }];
  });
}

const NON_ARTICLE_PATH = /\/(tag|tags|category|categories|author|authors|page|feed|rss|about|contact|advert|advertis|privacy|terms|subscribe|newsletter|login|signin|signup|search|wp-admin|wp-content|wp-json|comments|shop|cart|account|events?\/page)(\/|$)/i;
const NON_ARTICLE_EXTENSION = /\.(xml|json|jpg|jpeg|png|gif|svg|webp|pdf|zip|mp3|mp4|css|js)$/i;

/**
 * Discovers candidate article links on a homepage or section page. Used when a
 * source has no usable feed: the alternative would be to index nothing from
 * the most authoritative sites, which are exactly the ones that matter most.
 */
export function discoverArticleLinks(html: string, baseUrl: string, limit = 40): string[] {
  const baseHost = hostOf(baseUrl);
  if (!baseHost) return [];

  const seen = new Set<string>();
  const scored: Array<{ url: string; score: number }> = [];

  for (const match of String(html || '').matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const rawHref = match[1];
    const anchorText = normalizeWhitespace(stripHtml(match[2] || ''));
    let url: URL;
    try {
      url = new URL(decodeHtmlEntities(rawHref.trim()), baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    if (hostOf(url.toString()) !== baseHost) continue;
    if (url.pathname === '/' || url.pathname === '') continue;
    if (NON_ARTICLE_PATH.test(url.pathname) || NON_ARTICLE_EXTENSION.test(url.pathname)) continue;

    const canonical = canonicalUrl(url.toString());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);

    const segment = url.pathname.split('/').filter(Boolean).pop() || '';
    let score = 0;
    if (/\/(19|20)\d{2}\//.test(url.pathname)) score += 3;
    if (/\/\d{4}\/\d{1,2}\//.test(url.pathname)) score += 2;
    if (segment.split('-').length >= 4) score += 2;
    if (anchorText.split(/\s+/).length >= 5) score += 1;
    if (segment.length > 24) score += 1;
    if (/\d{4}/.test(segment)) score += 1;

    if (score >= 2) scored.push({ url: canonical, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.url);
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = normalizeWhitespace(decodeHtmlEntities(match[1]));
      if (value) return value;
    }
  }
  return null;
}

/** Open Graph / Twitter / standard metadata for a single article page. */
export function extractPageMeta(html: string, pageUrl: string): PageMeta {
  const source = String(html || '');
  const property = (name: string) => [
    new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i'),
  ];

  const title =
    metaContent(source, property('og:title')) ||
    metaContent(source, property('twitter:title')) ||
    normalizeWhitespace(stripHtml(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')) ||
    null;

  const description =
    metaContent(source, property('og:description')) ||
    metaContent(source, property('twitter:description')) ||
    metaContent(source, property('description'));

  const imageCandidate =
    metaContent(source, property('og:image:secure_url')) ||
    metaContent(source, property('og:image')) ||
    metaContent(source, property('twitter:image'));

  const published =
    metaContent(source, property('article:published_time')) ||
    metaContent(source, property('og:published_time')) ||
    metaContent(source, property('datePublished')) ||
    metaContent(source, [
      /<time[^>]+datetime=["']([^"']+)["']/i,
      /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    ]);

  return {
    title,
    description: description ? toPlainText(description, 600) : null,
    imageUrl: absoluteUrl(imageCandidate, pageUrl) || null,
    publishedAt: normalizeDate(published),
    siteName: metaContent(source, property('og:site_name')),
  };
}

/** Rejects responses that are clearly not HTML, regardless of Content-Type. */
export function looksLikeHtml(body: string): boolean {
  const head = String(body || '').slice(0, 1500).toLowerCase();
  return head.includes('<html') || head.includes('<!doctype html') || head.includes('<rss') || head.includes('<?xml');
}
