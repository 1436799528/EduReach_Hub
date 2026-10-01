/**
 * Editorial quality gate.
 *
 * The existing CMS gate checked that a title, an excerpt, a body, a category
 * and a source URL exist before an editor could publish by hand. Automated
 * ingestion needs a stricter version of the same idea, because nobody is
 * looking at the item before it lands: every ingested story must answer who
 * reported it, when, from what official source, and whether it is still
 * actionable.
 *
 * Errors block ingestion; warnings allow it but flag the item for review.
 */

import { newsCategories } from '../../../src/data/newsCategories';
import { isHttpsUrl } from './text';

export type QualityLevel = 'error' | 'warning';

export interface QualityFlag {
  code: string;
  level: QualityLevel;
  message: string;
}

export interface QualityInput {
  title: string;
  excerpt?: string | null;
  body?: string | null;
  category: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
  sourceTier?: number;
  relevanceScore?: number;
}

export interface QualityResult {
  passed: boolean;
  score: number;
  flags: QualityFlag[];
  errors: string[];
  warnings: string[];
}

export interface QualityOptions {
  minTitleLength?: number;
  maxTitleLength?: number;
  minExcerptLength?: number;
  minBodyLength?: number;
  /** Relevance score below which an item is rejected outright. */
  minRelevanceScore?: number;
  /** Oldest acceptable source publication date, in days. */
  maxAgeDays?: number;
}

const DEFAULTS: Required<QualityOptions> = {
  minTitleLength: 25,
  maxTitleLength: 160,
  minExcerptLength: 60,
  minBodyLength: 200,
  minRelevanceScore: 0.2,
  maxAgeDays: 120,
};

const PLACEHOLDER_TITLES = [
  'untitled', 'latest news', 'news', 'read more', 'click here', 'home',
  'page not found', '404', 'advertisement', 'sponsored post', 'no title',
];

const BLOCKED_PHRASES = [
  'click here to win', 'free recharge', 'betting tips', 'casino', 'viagra',
  'sponsored content', 'advertorial', 'promo code',
];

const MAINTAINED_CATEGORIES = new Set(newsCategories.map((category) => category.slug));

/**
 * How long an item stays actionable. Exam and deadline news goes stale
 * fastest and is exactly the content that misleads a student when it is
 * wrong, so it expires soonest.
 */
export const CATEGORY_TTL_DAYS: Record<string, number> = {
  jamb: 120,
  waec: 120,
  neco: 120,
  nabteb: 120,
  'post-utme': 120,
  admissions: 150,
  nelfund: 180,
  scholarships: 90,
  'academic-calendar': 180,
  'examination-updates': 120,
  'school-updates': 270,
  universities: 365,
  polytechnics: 365,
  'colleges-of-education': 365,
  general: 365,
};

export function ttlDaysForCategory(category: string): number {
  return CATEGORY_TTL_DAYS[category] ?? CATEGORY_TTL_DAYS.general;
}

/**
 * Expiry date for a freshly ingested article. Always computed from the source
 * publication date so a late-arriving story does not get a bonus year of life.
 */
export function expiresAtFor(category: string, from: Date = new Date()): string {
  const ttl = ttlDaysForCategory(category);
  return new Date(from.getTime() + ttl * 86_400_000).toISOString();
}

function isShouty(title: string): boolean {
  const letters = title.replace(/[^a-z]/gi, '');
  if (letters.length < 20) return false;
  const upper = letters.replace(/[^A-Z]/g, '').length;
  return upper / letters.length > 0.7;
}

export function runQualityGate(input: QualityInput, options: QualityOptions = {}): QualityResult {
  const settings = { ...DEFAULTS, ...options };
  const flags: QualityFlag[] = [];
  const error = (code: string, message: string) => flags.push({ code, level: 'error', message });
  const warn = (code: string, message: string) => flags.push({ code, level: 'warning', message });

  const title = String(input.title || '').trim();
  const excerpt = String(input.excerpt || '').trim();
  const body = String(input.body || '').trim();
  const category = String(input.category || '').trim().toLowerCase();
  const sourceUrl = String(input.sourceUrl || '').trim();

  // Who reported this?
  if (!input.sourceName || !String(input.sourceName).trim()) {
    error('missing_source_name', 'No source publication is recorded for this item.');
  }
  if (!sourceUrl) {
    error('missing_source_url', 'No source URL is recorded for this item.');
  } else if (!isHttpsUrl(sourceUrl)) {
    error('insecure_source_url', 'The source URL is not HTTPS.');
  }

  // What does it say, and is the shape sane?
  if (!title) {
    error('missing_title', 'The item has no headline.');
  } else {
    if (title.length < settings.minTitleLength) {
      error('short_title', `Headline is only ${title.length} characters.`);
    }
    if (title.length > settings.maxTitleLength) {
      error('long_title', `Headline is ${title.length} characters, over the ${settings.maxTitleLength} limit.`);
    }
    const lowered = title.toLowerCase();
    if (PLACEHOLDER_TITLES.some((placeholder) => lowered === placeholder || lowered.startsWith(`${placeholder} `))) {
      error('placeholder_title', 'Headline looks like a page placeholder rather than an article.');
    }
    if (isShouty(title)) warn('shouty_title', 'Headline is mostly upper case.');
    if (BLOCKED_PHRASES.some((phrase) => lowered.includes(phrase))) {
      error('blocked_content', 'Headline contains promotional or prohibited content.');
    }
  }

  if (!excerpt) {
    warn('missing_excerpt', 'No summary is available; readers will see only the headline.');
  } else if (excerpt.length < settings.minExcerptLength) {
    warn('short_excerpt', `Summary is only ${excerpt.length} characters.`);
  }

  if (!body) {
    error('missing_body', 'The item has no editorial summary.');
  } else if (body.length < settings.minBodyLength) {
    error('short_body', `Editorial summary is only ${body.length} characters.`);
  }

  if (!category || category === 'general') {
    warn('generic_category', 'Item was not routed to a specific category.');
  } else if (!MAINTAINED_CATEGORIES.has(category)) {
    error('invalid_category', `Category "${category}" is not in the maintained category list.`);
  }

  // When was it reported, and is it still actionable?
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  if (!publishedAt || !Number.isFinite(publishedAt.getTime())) {
    warn('missing_date', 'No source publication date was found.');
  } else {
    const ageDays = (Date.now() - publishedAt.getTime()) / 86_400_000;
    if (ageDays > settings.maxAgeDays) {
      error('stale_item', `Item was published ${Math.round(ageDays)} days ago.`);
    } else if (ageDays > settings.maxAgeDays / 2) {
      warn('ageing_item', `Item was published ${Math.round(ageDays)} days ago.`);
    }
    if (ageDays < -2) error('future_dated', 'Item is dated in the future.');
  }

  if (!input.imageUrl) warn('missing_image', 'No image was found for this item.');

  if (typeof input.relevanceScore === 'number' && input.relevanceScore < settings.minRelevanceScore) {
    error('low_relevance', `Relevance score ${input.relevanceScore.toFixed(2)} is below the ingestion floor.`);
  }

  if (Number(input.sourceTier || 0) > 1) {
    warn('requires_review', 'Source is not a Tier 1 official source, so human review is required.');
  }

  const linkCount = (body.match(/https?:\/\//g) || []).length;
  if (linkCount > 4) warn('link_heavy', `Editorial summary contains ${linkCount} links.`);

  const errors = flags.filter((flag) => flag.level === 'error').map((flag) => flag.message);
  const warnings = flags.filter((flag) => flag.level === 'warning').map((flag) => flag.message);
  const score = Math.max(0, 1 - errors.length * 0.25 - warnings.length * 0.05);

  return {
    passed: errors.length === 0,
    score: Number(score.toFixed(4)),
    flags,
    errors,
    warnings,
  };
}
