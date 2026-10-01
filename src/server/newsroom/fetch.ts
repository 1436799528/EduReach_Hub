/**
 * Network layer for the newsroom: bounded fetches, per-host politeness and
 * robots.txt compliance.
 *
 * Ingestion runs unattended in a scheduled function, so every outward request
 * is capped (timeout, bytes, concurrency) and throttled per host. A source that
 * is slow or hostile degrades that one source, never the run.
 */

import { crawlDelayMs, isPathAllowed, parseRobots, type RobotsPolicy } from './robots';

export const DEFAULT_USER_AGENT = 'EduReach-Newsroom/1.0 (+https://github.com/1436799528/EduReach_Hub; student news aggregation; contact: editorial@edureach.example)';
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_BYTES = 700_000;

export interface FetchTextResult {
  ok: boolean;
  status: number | null;
  text: string;
  contentType: string;
  finalUrl: string;
  error?: string;
  bytes: number;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  accept?: string;
  fetchImpl?: typeof fetch;
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<FetchTextResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await doFetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
        Accept: options.accept ?? 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/feed+json;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-NG,en;q=0.9',
      },
    });

    const contentType = response.headers?.get?.('content-type') || '';
    if (!response.ok) {
      return { ok: false, status: response.status, text: '', contentType, finalUrl: url, error: `HTTP ${response.status}`, bytes: 0 };
    }

    const raw = await response.text();
    const text = raw.length > maxBytes ? raw.slice(0, maxBytes) : raw;
    return {
      ok: true,
      status: response.status,
      text,
      contentType,
      finalUrl: (response as Response).url || url,
      bytes: raw.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch failed';
    return {
      ok: false,
      status: null,
      text: '',
      contentType: '',
      finalUrl: url,
      error: /abort/i.test(message) ? `timed out after ${timeoutMs}ms` : message,
      bytes: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Serialises requests per host and enforces crawl-delay between them. */
export class HostThrottle {
  private readonly lastRequestAt = new Map<string, number>();

  constructor(private readonly defaultDelayMs = 1000) {}

  async wait(host: string, delayMs: number | null): Promise<void> {
    const delay = Math.max(delayMs ?? this.defaultDelayMs, 250);
    const previous = this.lastRequestAt.get(host);
    const now = Date.now();
    if (previous !== undefined) {
      const remaining = previous + delay - now;
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    this.lastRequestAt.set(host, Date.now());
  }
}

export function hostOfUrl(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Caches robots.txt per host for the life of a run.
 *
 * A 404 or a network failure is treated as "no rules published" (the common
 * convention). A fetched file that forbids the path stops us from touching the
 * host at all.
 */
export class RobotsCache {
  private readonly cache = new Map<string, RobotsPolicy | null>();

  constructor(
    private readonly userAgent: string,
    private readonly fetchOptions: FetchOptions = {},
  ) {}

  async policyFor(origin: string): Promise<RobotsPolicy | null> {
    if (this.cache.has(origin)) return this.cache.get(origin) ?? null;
    const result = await fetchText(`${origin}/robots.txt`, {
      ...this.fetchOptions,
      timeoutMs: Math.min(this.fetchOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS, 6000),
      maxBytes: 120_000,
      accept: 'text/plain,*/*;q=0.5',
    });
    // 404/410/5xx/network error → no published rules we can honour.
    const policy = result.ok && result.text ? parseRobots(result.text) : null;
    this.cache.set(origin, policy);
    return policy;
  }

  async isAllowed(url: string): Promise<{ allowed: boolean; delayMs: number | null; reason?: string }> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { allowed: false, delayMs: null, reason: 'invalid URL' };
    }
    const policy = await this.policyFor(parsed.origin);
    if (!policy) return { allowed: true, delayMs: null };
    const allowed = isPathAllowed(policy, this.userAgent, `${parsed.pathname}${parsed.search}`);
    return {
      allowed,
      delayMs: crawlDelayMs(policy, this.userAgent),
      reason: allowed ? undefined : 'robots.txt disallows this path',
    };
  }
}

/**
 * Reusable single-source fetch policy: robots check, throttle, bounded GET.
 * Both feed discovery and article enrichment go through it.
 */
export async function politeFetch(
  url: string,
  context: { robots: RobotsCache; throttle: HostThrottle; userAgent: string; fetchImpl?: typeof fetch },
): Promise<FetchTextResult & { skipped?: string }> {
  const host = hostOfUrl(url);
  if (!host) return { ok: false, status: null, text: '', contentType: '', finalUrl: url, error: 'invalid URL', bytes: 0 };

  const permission = await context.robots.isAllowed(url);
  if (!permission.allowed) {
    return { ok: false, status: null, text: '', contentType: '', finalUrl: url, error: permission.reason, bytes: 0, skipped: permission.reason };
  }

  await context.throttle.wait(host, permission.delayMs);
  return fetchText(url, {
    fetchImpl: context.fetchImpl,
    userAgent: context.userAgent,
    maxBytes: DEFAULT_MAX_BYTES,
  });
}

/** True when a response body is XML/JSON rather than HTML. */
export function looksLikeFeed(result: FetchTextResult): boolean {
  const type = result.contentType.toLowerCase();
  if (type.includes('rss') || type.includes('atom') || type.includes('xml') || type.includes('json')) return true;
  const head = result.text.slice(0, 400).trimStart().toLowerCase();
  return head.startsWith('<?xml') || head.startsWith('<rss') || head.startsWith('{');
}
