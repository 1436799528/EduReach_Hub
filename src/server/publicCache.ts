/**
 * A small, explicit public-content cache.
 *
 * The public institution page is assembled from eleven related reads. That is
 * the right shape for an editorial view and the wrong shape for every anonymous
 * visitor: without a cache, a popular school page multiplies ten-query work by
 * the number of readers. This module puts one assembled response behind a
 * short-lived cache with three properties that matter:
 *
 *   * **stale-while-revalidate.** A visitor holding a response that is a minute
 *     past its TTL gets it immediately; one refresh runs in the background. A
 *     database slowdown therefore degrades to "slightly old page", not "school
 *     page unavailable".
 *   * **single flight.** When an entry is empty or hard-expired, concurrent
 *     requests for the same key share one loader call. A cold cache on a popular
 *     school does not become a stampede.
 *   * **explicit invalidation.** An editor publishing an institution clears that
 *     institution's key — and nothing else.
 *
 * Nothing here caches a request whose response depends on the caller. Keys are
 * chosen by the caller and must never include an authenticated identity; the
 * admin and student endpoints do not use this module at all.
 */

export interface CacheStats {
  /** Entries answered from a fresh value. */
  hits: number;
  /** Entries answered from a stale value while a refresh ran in the background. */
  staleHits: number;
  /** Entries with no stored value that had to wait for the loader. */
  misses: number;
  /** Loader calls actually executed (the numerator of the coalescing ratio). */
  loads: number;
  /** Requests that joined an in-flight load instead of starting another. */
  coalesced: number;
  /** Background refreshes started after a stale hit. */
  revalidations: number;
  /** Refreshes whose loader threw. The previous value is kept. */
  failures: number;
  /** Keys removed by `invalidate` / `invalidatePrefix`. */
  invalidations: number;
  size: number;
}

export interface CacheRead<T> {
  value: T;
  /** Where the answer came from, surfaced as a response header and in metrics. */
  state: 'hit' | 'stale' | 'miss';
}

export interface PublicCacheOptions<T> {
  /** How long a value is considered fresh. */
  ttlMs: number;
  /**
   * How long a stale value may still be served while the refresh runs. After
   * `ttlMs + staleMs` the request waits for a fresh load instead: an outage
   * cannot serve yesterday's page indefinitely.
   */
  staleMs: number;
  now?: () => number;
  onError?: (error: unknown, key: string) => void;
  /**
   * Store only responses that are safe to reuse. The public institution read
   * uses this to keep unpublished institutions out of the shared cache: their
   * payload is public, but caching it would let an empty assembled response
   * outlive the publish that filled it.
   */
  shouldCache?: (value: T) => boolean;
}

interface Entry<T> {
  value: T;
  storedAt: number;
}

export interface PublicCache<T> {
  get(key: string, load: () => Promise<T>): Promise<CacheRead<T>>;
  peek(key: string): T | undefined;
  invalidate(key: string): void;
  invalidatePrefix(prefix: string): void;
  clear(): void;
  stats(): CacheStats;
}

export function createPublicCache<T>(options: PublicCacheOptions<T>): PublicCache<T> {
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, Entry<T>>();
  const inFlight = new Map<string, Promise<T>>();
  const counters = {
    hits: 0,
    staleHits: 0,
    misses: 0,
    loads: 0,
    coalesced: 0,
    revalidations: 0,
    failures: 0,
    invalidations: 0,
  };

  function loadOnce(key: string, load: () => Promise<T>): Promise<T> {
    const running = inFlight.get(key);
    if (running) {
      counters.coalesced += 1;
      return running;
    }
    counters.loads += 1;
    const promise = (async () => {
      try {
        const value = await load();
        if (!options.shouldCache || options.shouldCache(value)) {
          entries.set(key, { value, storedAt: now() });
        }
        return value;
      } catch (error) {
        counters.failures += 1;
        options.onError?.(error, key);
        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, promise);
    return promise;
  }

  function refreshInBackground(key: string, load: () => Promise<T>) {
    counters.revalidations += 1;
    void loadOnce(key, load).catch(() => {
      // The stale value is still served. A failed refresh is not an outage; the
      // next request tries again, and `failures` makes the rate observable.
    });
  }

  return {
    async get(key, load) {
      const entry = entries.get(key);
      const at = now();
      if (entry) {
        const age = at - entry.storedAt;
        if (age < options.ttlMs) {
          counters.hits += 1;
          return { value: entry.value, state: 'hit' };
        }
        if (age < options.ttlMs + options.staleMs) {
          counters.staleHits += 1;
          refreshInBackground(key, load);
          return { value: entry.value, state: 'stale' };
        }
      }
      counters.misses += 1;
      return { value: await loadOnce(key, load), state: 'miss' };
    },

    peek(key) {
      return entries.get(key)?.value;
    },

    invalidate(key) {
      entries.delete(key);
      inFlight.delete(key);
      counters.invalidations += 1;
    },

    invalidatePrefix(prefix) {
      for (const key of [...entries.keys()]) {
        if (key.startsWith(prefix)) {
          entries.delete(key);
          counters.invalidations += 1;
        }
      }
      for (const key of [...inFlight.keys()]) {
        if (key.startsWith(prefix)) inFlight.delete(key);
      }
    },

    clear() {
      counters.invalidations += entries.size;
      entries.clear();
      inFlight.clear();
    },

    stats() {
      return { ...counters, size: entries.size };
    },
  };
}

/**
 * The response policy for a cacheable public read.
 *
 * `max-age` is what the visitor's browser may reuse; `s-maxage` is what the CDN
 * may reuse; the stale window lets the CDN answer during a revalidation. These
 * numbers are deliberately short — an institution edit should be visible within
 * minutes, not hours.
 */
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

/**
 * Policy for everything that depends on who is asking: student data, admin
 * data, auth. It is repeated here so a route can never "inherit" a public cache
 * policy by accident.
 */
export const PRIVATE_CACHE_CONTROL = 'private, no-store';
