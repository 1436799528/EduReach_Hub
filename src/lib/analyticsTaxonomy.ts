/**
 * AN-1 — the analytics taxonomy.
 *
 * This file is the single source of truth for product analytics. Every event the
 * product may record is declared here, with the funnel it belongs to, the reason
 * it exists, and the exact payload it may carry. The server validates against
 * this module, the browser validates against this module, the admin console's
 * query shapes follow it, `scripts/analytics-audit.ts` fails the build when a
 * call site or the server drifts from it, and `docs/features/AN-1.md` must list
 * exactly these events.
 *
 * Two rules are not negotiable and are enforced, not documented:
 *
 * 1. **Nothing a student typed is ever stored.** Metadata is an allowlist of
 *    declared keys. Free-text keys (a search box is where a student writes their
 *    name and their problem) are refused by name in the audit.
 * 2. **A payload is bounded.** Every string has a cap, every number a range,
 *    nesting is refused, and the whole object has a byte cap. The worst a single
 *    request can add is bounded by this file.
 *
 * Keep this module dependency-free: the server imports it at runtime.
 */

export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'search',
  'news_view',
  'school_view',
  'service_view',
  'service_submit',
  'cbt_setup_view',
  'cbt_start',
  'cbt_submit',
  'notification_open',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsFunnel = 'discovery' | 'service' | 'cbt' | 'notification';

export type AnalyticsMetadataField = {
  type: 'string' | 'number' | 'boolean';
  /** Strings: maximum length. Numbers: maximum absolute value. */
  max?: number;
  required?: boolean;
  /** Why this field exists — one line, for the reviewer of the next event. */
  note: string;
};

export type AnalyticsEventSpec = {
  funnel: AnalyticsFunnel;
  purpose: string;
  metadata: Record<string, AnalyticsMetadataField>;
};

/** Raw rows older than this are pruned. Must equal the prune function's default. */
export const RETENTION_DAYS = 90;

/** The whole metadata object may not exceed this many bytes once serialised. */
export const METADATA_MAX_BYTES = 2048;

/** Default string cap when a field does not declare one. */
export const STRING_MAX_DEFAULT = 120;

/**
 * Keys that would hold something a student typed. The audit fails if a declared
 * field is named like one of these, so the search box cannot quietly become a
 * database column again.
 */
export const FREE_TEXT_KEY_PATTERN =
  /^(q|query|search|term|term_text|text|input|email|e_mail|phone|phone_number|name|full_?name|first_?name|last_?name|address|message|comment|note|password|token|otp|pin|nuban|account_?number)$/i;

/** What each string field may contain, by name — checked by the audit. */
export const IDENTIFIER_KEY_PATTERN = /(id|slug|mode|status|category|title)$/;

export const ANALYTICS_TAXONOMY: Record<AnalyticsEventName, AnalyticsEventSpec> = {
  page_view: {
    funnel: 'discovery',
    purpose: 'Which routes are reached, and how often.',
    metadata: {},
  },
  search: {
    funnel: 'discovery',
    purpose: 'That a search happened and whether the catalogue answered it.',
    metadata: {
      query_length: { type: 'number', max: 500, required: true, note: 'Character count of the term — never the term itself.' },
      result_count: { type: 'number', max: 100000, required: true, note: 'How many results were returned; 0 is the actionable signal.' },
    },
  },
  news_view: {
    funnel: 'discovery',
    purpose: 'Which published articles are actually read, not just listed.',
    metadata: {
      slug: { type: 'string', max: 160, required: true, note: 'The article identifier, not its text.' },
      category: { type: 'string', max: 40, note: 'Editorial category, for the content plan.' },
    },
  },
  school_view: {
    funnel: 'discovery',
    purpose: 'Which institutions students look up — evidence for sourcing order (INT-3).',
    metadata: {
      schoolId: { type: 'string', max: 64, required: true, note: 'Institution identifier.' },
    },
  },
  service_view: {
    funnel: 'service',
    purpose: 'Which service pages attract demand.',
    metadata: {
      slug: { type: 'string', max: 80, required: true, note: 'Service key.' },
    },
  },
  service_submit: {
    funnel: 'service',
    purpose: 'Which services are actually completed, not only browsed.',
    metadata: {
      slug: { type: 'string', max: 80, required: true, note: 'Service key.' },
    },
  },
  cbt_setup_view: {
    funnel: 'cbt',
    purpose: 'Which exam bodies reach the setup wizard before any attempt starts.',
    metadata: {
      mode: { type: 'string', max: 20, required: true, note: 'Exam body (jamb, waec, neco, post-utme).' },
    },
  },
  cbt_start: {
    funnel: 'cbt',
    purpose: 'Which banks are actually attempted — the top of the CBT funnel.',
    metadata: {
      examId: { type: 'string', max: 64, required: true, note: 'Bank identifier.' },
      examTitle: { type: 'string', max: 120, note: 'Published bank title, for the console.' },
    },
  },
  cbt_submit: {
    funnel: 'cbt',
    purpose: 'Attempt completion — the denominator for cbt_start.',
    metadata: {
      examId: { type: 'string', max: 64, required: true, note: 'Bank identifier.' },
    },
  },
  notification_open: {
    funnel: 'notification',
    purpose: 'Whether NTF-1 notifications are opened, not merely delivered.',
    metadata: {
      status: { type: 'string', max: 30, note: 'The service status the notification announced.' },
    },
  },
};

export function isAnalyticsEvent(name: unknown): name is AnalyticsEventName {
  return typeof name === 'string' && (ANALYTICS_EVENT_NAMES as readonly string[]).includes(name);
}

export type ValidatedMetadata = Record<string, string | number | boolean>;

export type MetadataValidation =
  | { ok: true; value: ValidatedMetadata; dropped: string[] }
  | { ok: false; reason: string };

/**
 * Keep declared keys with values of the declared type, within the declared cap.
 * Drop everything else. Never throw: this runs on the ingest path, and a bad
 * payload must be a smaller payload, not a failed request.
 */
export function validateAnalyticsMetadata(name: AnalyticsEventName, metadata: unknown): MetadataValidation {
  const spec = ANALYTICS_TAXONOMY[name];
  if (!spec) return { ok: false, reason: `unknown event: ${name}` };
  const input: Record<string, unknown> =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};

  const value: ValidatedMetadata = {};
  const dropped: string[] = [];

  for (const [key, field] of Object.entries(spec.metadata)) {
    const raw = input[key];
    if (raw === undefined || raw === null) {
      if (field.required) return { ok: false, reason: `missing required field: ${key}` };
      continue;
    }
    if (field.type === 'string') {
      if (typeof raw !== 'string') {
        dropped.push(key);
        continue;
      }
      const cap = field.max ?? STRING_MAX_DEFAULT;
      const trimmed = raw.trim().slice(0, cap);
      if (!trimmed) {
        dropped.push(key);
        continue;
      }
      value[key] = trimmed;
      continue;
    }
    if (field.type === 'number') {
      const numeric = typeof raw === 'number' ? raw : Number.NaN;
      if (!Number.isFinite(numeric)) {
        dropped.push(key);
        continue;
      }
      const bounded = Math.trunc(numeric);
      value[key] = field.max === undefined ? bounded : Math.max(Math.min(bounded, field.max), -field.max);
      continue;
    }
    // boolean
    if (typeof raw !== 'boolean') {
      dropped.push(key);
      continue;
    }
    value[key] = raw;
  }

  for (const key of Object.keys(input)) {
    if (!(key in spec.metadata)) dropped.push(key);
  }

  if (JSON.stringify(value).length > METADATA_MAX_BYTES) {
    return { ok: false, reason: 'metadata payload too large' };
  }

  return { ok: true, value, dropped: [...new Set(dropped)] };
}

/**
 * A stored path is a route, not a URL: query strings and fragments can carry a
 * token or an email address, and neither belongs in an analytics row.
 */
export function sanitizeAnalyticsPath(raw: unknown, fallback: string | null = null): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  const withoutFragment = raw.split('#')[0];
  const withoutQuery = withoutFragment.split('?')[0];
  const trimmed = withoutQuery.trim().slice(0, 500);
  return trimmed || fallback;
}

/** Same reasoning for the referrer: origin and path only. */
export function sanitizeReferrer(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const withoutFragment = raw.split('#')[0];
  const withoutQuery = withoutFragment.split('?')[0];
  const trimmed = withoutQuery.trim().slice(0, 500);
  return trimmed || null;
}

/** The user-agent is kept for device-level shape only, and capped tightly. */
export function sanitizeUserAgent(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().slice(0, 200) || null;
}
