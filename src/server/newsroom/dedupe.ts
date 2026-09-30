/**
 * Multi-signal duplicate detection.
 *
 * A unique slug is not duplicate prevention: the same event can arrive with a
 * different headline, a different wording of the same headline, an AMP variant
 * of the same URL, or a syndicated copy from another outlet. So we compare on
 * five independent signals and keep a review state for the ambiguous middle:
 *
 *   exact  → same canonical URL, same content hash, or same headline from the
 *            same source. Never ingested twice.
 *   likely → near-identical headline (token overlap or SimHash), or the same
 *            event (entities + action) within a few days. Treated as a
 *            duplicate, but recorded with its matched article for auditing.
 *   possible → similar but not convincing. Ingested for human review, never
 *            published automatically, and shown with the suspected match.
 */

import { EVENT_ACTIONS, EVENT_ENTITIES } from './lexicon';
import {
  contentHash,
  daysBetween,
  dedupeKeyFor,
  hammingDistance,
  jaccard,
  normalizeTitle,
  simhash64,
  tokenize,
} from './text';

export type DuplicateLevel = 'exact' | 'likely' | 'possible';

export interface DuplicateMatch {
  level: DuplicateLevel;
  reason: string;
  score: number;
  matched: IndexEntry;
}

export interface CandidateSignals {
  title: string;
  canonicalUrl: string;
  excerpt?: string | null;
  body?: string | null;
  sourceKey: string;
  sourcePublishedAt?: string | null;
}

export interface IndexEntry {
  /** Set when the entry is already a news_articles row or a stored candidate. */
  id: string | null;
  origin: 'article' | 'candidate' | 'batch';
  canonicalUrl: string;
  title: string;
  normalizedTitle: string;
  tokens: string[];
  simhash: string;
  contentHash: string;
  sourceKey: string;
  sourcePublishedAt: string | null;
  eventFingerprint: string;
}

const TITLE_JACCARD_LIKELY = 0.82;
const TITLE_JACCARD_POSSIBLE = 0.6;
const SIMHASH_LIKELY = 3;
const SIMHASH_POSSIBLE = 8;
const SAME_EVENT_WINDOW_DAYS = 3;

/** Entities + actions present in a headline, sorted and joined. */
export function eventFingerprint(title: string): string {
  const text = ` ${normalizeTitle(title)} `;
  const entities = EVENT_ENTITIES.filter((entity) => text.includes(` ${normalizeTitle(entity)} `)).map(normalizeTitle);
  const actions = EVENT_ACTIONS.filter((action) => text.includes(` ${normalizeTitle(action)} `)).map(normalizeTitle);
  if (!entities.length || !actions.length) return '';
  return `${Array.from(new Set(entities)).sort().join('+')}|${Array.from(new Set(actions)).sort().join('+')}`;
}

export function buildIndexEntry(
  input: CandidateSignals & { id?: string | null; origin?: IndexEntry['origin'] },
): IndexEntry {
  const tokens = tokenize(input.title);
  return {
    id: input.id ?? null,
    origin: input.origin ?? 'batch',
    canonicalUrl: input.canonicalUrl,
    title: input.title,
    normalizedTitle: normalizeTitle(input.title),
    tokens,
    simhash: simhash64(tokens),
    contentHash: contentHash(input.title, String(input.body || input.excerpt || '')),
    sourceKey: input.sourceKey,
    sourcePublishedAt: input.sourcePublishedAt ?? null,
    eventFingerprint: eventFingerprint(input.title),
  };
}

export function dedupeKeyForCandidate(input: { canonicalUrl: string; title: string }): string {
  return dedupeKeyFor(input);
}

/**
 * Compares one candidate against everything already known. Returns the
 * strongest match found, or null when the candidate looks genuinely new.
 */
export function findDuplicate(
  candidate: IndexEntry,
  index: IndexEntry[],
): DuplicateMatch | null {
  let best: DuplicateMatch | null = null;

  const record = (level: DuplicateLevel, reason: string, score: number, matched: IndexEntry) => {
    const rank = { exact: 3, likely: 2, possible: 1 } as const;
    if (!best || rank[level] > rank[best.level] || (rank[level] === rank[best.level] && score > best.score)) {
      best = { level, reason, score, matched };
    }
  };

  for (const entry of index) {
    if (entry.canonicalUrl && entry.canonicalUrl === candidate.canonicalUrl) {
      record('exact', 'canonical_url', 1, entry);
      continue;
    }

    if (entry.normalizedTitle && entry.normalizedTitle === candidate.normalizedTitle) {
      const sameSource = entry.sourceKey && entry.sourceKey === candidate.sourceKey;
      record(sameSource ? 'exact' : 'likely', sameSource ? 'same_source_title' : 'same_title', 0.98, entry);
      continue;
    }
    if (candidate.contentHash && entry.contentHash && candidate.contentHash === entry.contentHash) {
      record('exact', 'content_hash', 1, entry);
      continue;
    }


    const similarity = jaccard(candidate.tokens, entry.tokens);
    if (similarity >= TITLE_JACCARD_LIKELY) {
      record('likely', 'title_similarity', similarity, entry);
      continue;
    }

    const distance = hammingDistance(candidate.simhash, entry.simhash);
    if (distance <= SIMHASH_LIKELY) {
      record('likely', 'near_duplicate_title', 1 - distance / 64, entry);
      continue;
    }

    if (
      candidate.eventFingerprint &&
      candidate.eventFingerprint === entry.eventFingerprint &&
      (daysBetween(candidate.sourcePublishedAt, entry.sourcePublishedAt) ?? 0) <= SAME_EVENT_WINDOW_DAYS
    ) {
      record('likely', 'same_event', 0.9, entry);
      continue;
    }

    if (similarity >= TITLE_JACCARD_POSSIBLE || distance <= SIMHASH_POSSIBLE) {
      record('possible', 'similar_headline', Math.max(similarity, 1 - distance / 64), entry);
    }
  }

  return best;
}

/** Human-readable explanation stored on the candidate row for editors. */
export function describeMatch(match: DuplicateMatch | null): string {
  if (!match) return '';
  const target = match.matched.title || match.matched.canonicalUrl;
  return `${match.level} duplicate (${match.reason}) of "${target}"`;
}
