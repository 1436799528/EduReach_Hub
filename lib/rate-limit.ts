/**
 * Rate limiting for the public and administrative API.
 *
 * Two layers, because EduReach runs on serverless infrastructure:
 *
 *   1. in-process — cheap, always on. It stops request floods against a warm
 *      instance but cannot see other instances.
 *   2. durable (`check_rate_limit` RPC) — counts across instances in Postgres.
 *      Used for the endpoints where abuse is expensive or sensitive: admin
 *      bootstrap, guest CBT scoring, uploads, bulk import and newsroom runs.
 *
 * The durable layer fails open with a logged error when the RPC is missing
 * (migration not applied yet) so a half-migrated environment degrades to the
 * in-process limit instead of breaking the endpoint.
 */

import type { NextFunction, Request, Response } from 'express';

export interface RateLimitRule {
  /** Bucket name used for the in-process key and the durable counter. */
  name: string;
  limit: number;
  windowSeconds: number;
  /** Also count in the database so limits hold across instances. */
  durable?: boolean;
}

export interface RateLimitDependencies {
  /** Service-role RPC caller. Returning an error is treated as "no durable limiter". */
  callRpc?: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  now?: () => number;
  log?: (message: string, meta?: Record<string, unknown>) => void;
}

interface WindowEntry {
  hits: number[];
}

/** Sliding-window counter. Exported so tests can drive it directly. */
export class MemoryRateLimiter {
  private readonly windows = new Map<string, WindowEntry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  hit(key: string, rule: RateLimitRule): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const nowMs = this.now();
    const windowMs = rule.windowSeconds * 1000;
    const entry = this.windows.get(key) || { hits: [] };
    entry.hits = entry.hits.filter((timestamp) => nowMs - timestamp < windowMs);

    if (entry.hits.length >= rule.limit) {
      const oldest = entry.hits[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
      this.windows.set(key, entry);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    entry.hits.push(nowMs);
    this.windows.set(key, entry);

    // Bounded growth: drop windows nobody has touched recently.
    if (this.windows.size > 5000) {
      for (const [existingKey, existing] of this.windows) {
        if (!existing.hits.length || nowMs - existing.hits[existing.hits.length - 1] > windowMs) {
          this.windows.delete(existingKey);
        }
      }
    }

    return { allowed: true, remaining: Math.max(0, rule.limit - entry.hits.length), retryAfterSeconds: 0 };
  }

  reset(): void {
    this.windows.clear();
  }
}

/**
 * Client identity for rate limiting. Netlify supplies the original client IP in
 * `x-nf-client-connection-ip`; other proxies use `x-forwarded-for`.
 */
export function clientKey(req: Request): string {
  const header = req.header('x-nf-client-connection-ip')
    || (req.header('x-forwarded-for') || '').split(',')[0]
    || req.ip
    || req.socket?.remoteAddress
    || 'unknown';
  return String(header).trim() || 'unknown';
}

export function createRateLimiter(
  dependencies: RateLimitDependencies = {},
): (rule: RateLimitRule) => (req: Request, res: Response, next: NextFunction) => void {
  const limiter = new MemoryRateLimiter(dependencies.now);
  const log = dependencies.log ?? (() => {});

  return function forRule(rule: RateLimitRule) {
    return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
      const key = `${rule.name}:${clientKey(req)}`;
      const local = limiter.hit(key, rule);
      res.setHeader('RateLimit-Limit', String(rule.limit));
      res.setHeader('RateLimit-Remaining', String(local.remaining));

      if (!local.allowed) {
        res.setHeader('Retry-After', String(local.retryAfterSeconds));
        log('rate limit hit (in-process)', { rule: rule.name, key });
        return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
      }

      if (!rule.durable || !dependencies.callRpc) return next();

      // Durable check runs after the cheap one so a flood never reaches the DB.
      dependencies.callRpc('check_rate_limit', {
        p_bucket: key,
        p_limit: rule.limit,
        p_window_seconds: rule.windowSeconds,
      })
        .then(({ data, error }) => {
          if (error) {
            log('durable rate limit unavailable; relying on in-process limit', { rule: rule.name, error: error.message });
            return next();
          }
          if (data === false) {
            res.setHeader('Retry-After', String(rule.windowSeconds));
            log('rate limit hit (durable)', { rule: rule.name, key });
            return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
          }
          return next();
        })
        .catch((error: unknown) => {
          log('durable rate limit threw; relying on in-process limit', {
            rule: rule.name,
            error: error instanceof Error ? error.message : String(error),
          });
          next();
        });
    };
  };
}

/**
 * Every limited route in one place, so the policy can be reviewed like the
 * editorial policy is. Limits are deliberate but generous: an ordinary student
 * never reaches them; a script does.
 */
export const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  adminBootstrap: { name: 'admin-bootstrap', limit: 5, windowSeconds: 900, durable: true },
  guestCbtSubmit: { name: 'guest-cbt-submit', limit: 30, windowSeconds: 600, durable: true },
  analyticsEvent: { name: 'analytics-event', limit: 240, windowSeconds: 60 },
  adminUpload: { name: 'admin-upload', limit: 20, windowSeconds: 600, durable: true },
  adminImport: { name: 'admin-import', limit: 10, windowSeconds: 600, durable: true },
  adminNewsroomRun: { name: 'admin-newsroom-run', limit: 6, windowSeconds: 3600, durable: true },
  apiGeneral: { name: 'api-general', limit: 1200, windowSeconds: 60 },
};
