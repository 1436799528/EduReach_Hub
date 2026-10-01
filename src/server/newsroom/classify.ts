/**
 * Relevance classification and category routing.
 *
 * A newsroom that ingests everything is worse than one that ingests nothing,
 * because the cost of reading falls on the student. Every item is scored for
 * "is this a Nigerian tertiary student update?", routed to one of the
 * maintained news categories, and marked eligible for automatic publication
 * only when it clears the auto-publish threshold from a Tier 1 source.
 */

import { CATEGORY_RULES, OFF_TOPIC_TERMS, RELEVANCE_TERMS, TERM_ALIASES } from './lexicon';
import { normalizeTitle, tokenize } from './text';

export interface ClassificationInput {
  title: string;
  excerpt?: string | null;
  keywords?: string[];
  sourceTier?: number;
  trustScore?: number;
  categoryHint?: string | null;
}

export interface Classification {
  /** 0 (irrelevant) to 1 (unmistakably on-topic). */
  score: number;
  matchedTerms: string[];
  category: string;
  relevant: boolean;
  /** Tier 1 sources may publish without a human when the gate also passes. */
  autoPublishEligible: boolean;
  reason: string;
}

export interface ClassificationOptions {
  /** Minimum score for an item to enter the system at all. */
  relevanceThreshold?: number;
  /** Minimum score for an item to be published without human review. */
  autoPublishThreshold?: number;
}

const DEFAULT_RELEVANCE_THRESHOLD = 0.34;
const DEFAULT_AUTO_PUBLISH_THRESHOLD = 0.5;
/** Raw weight that maps to a relevance score of 1. */
const SCORE_SCALE = 7;

function alias(value: string): string {
  return TERM_ALIASES[value] || value;
}

/** Multi-word terms need phrase matching, so they are checked on the raw text. */
function phraseMatches(text: string, terms: string[]): string[] {
  const normalized = ` ${text} `;
  return terms.filter((term) => term.includes(' ') && normalized.includes(` ${term} `));
}

function scoreText(text: string, weightMultiplier: number, matched: Set<string>): number {
  let total = 0;
  for (const token of tokenize(text)) {
    const key = alias(token);
    const weight = RELEVANCE_TERMS[key];
    if (!weight) continue;
    total += weight * weightMultiplier;
    matched.add(key);
  }
  for (const phrase of phraseMatches(normalizeTitle(text), Object.keys(RELEVANCE_TERMS))) {
    total += (RELEVANCE_TERMS[phrase] || 1) * weightMultiplier;
    matched.add(alias(phrase));
  }
  return total;
}

export function classify(
  input: ClassificationInput,
  options: ClassificationOptions = {},
): Classification {
  const relevanceThreshold = options.relevanceThreshold ?? DEFAULT_RELEVANCE_THRESHOLD;
  const autoPublishThreshold = options.autoPublishThreshold ?? DEFAULT_AUTO_PUBLISH_THRESHOLD;

  const title = String(input.title || '');
  const excerpt = String(input.excerpt || '');
  const keywordText = Array.isArray(input.keywords) ? input.keywords.join(' ') : '';

  const matched = new Set<string>();
  // Headlines carry the most signal; the excerpt supports it; feed keywords help.
  let raw = scoreText(title, 1, matched);
  raw += scoreText(excerpt, 0.4, matched);
  raw += scoreText(keywordText, 0.5, matched);

  const normalizedTitle = normalizeTitle(title);
  const offTopic = OFF_TOPIC_TERMS.filter((term) => normalizedTitle.includes(term));

  let score = Math.max(0, Math.min(1, raw / SCORE_SCALE));
  const tier = Number(input.sourceTier || 3);
  if (tier === 1) score = Math.min(1, score + 0.15);
  else if (tier === 2) score = Math.min(1, score + 0.05);

  // A lifestyle or sports story that happens to mention "students" is not a
  // student update; require real education weight before off-topic terms are
  // forgiven.
  const educationWeight = raw;
  if (offTopic.length && educationWeight < 4) {
    score = Math.min(score, 0.15);
  }

  const relevant = score >= relevanceThreshold;
  const category = routeCategory({ title, excerpt, keywordText }, input.categoryHint);
  const trust = typeof input.trustScore === 'number' ? input.trustScore : tier === 1 ? 0.9 : 0.6;
  const autoPublishEligible = tier === 1 && trust >= 0.8 && score >= autoPublishThreshold;

  const reason = !relevant
    ? `relevance ${score.toFixed(2)} below threshold ${relevanceThreshold}`
    : autoPublishEligible
      ? `tier 1 source, relevance ${score.toFixed(2)}`
      : `relevance ${score.toFixed(2)}; human review required`;

  return {
    score: Number(score.toFixed(4)),
    matchedTerms: Array.from(matched).slice(0, 25),
    category,
    relevant,
    autoPublishEligible,
    reason,
  };
}

export function routeCategory(
  input: { title: string; excerpt?: string; keywordText?: string },
  categoryHint?: string | null,
): string {
  const titleText = normalizeTitle(input.title);
  const allText = `${titleText} ${normalizeTitle(input.excerpt || '')} ${normalizeTitle(input.keywordText || '')}`;

  let best: { category: string; weight: number } | null = null;
  for (const rule of CATEGORY_RULES) {
    let weight = 0;
    for (const term of rule.terms) {
      const normalizedTerm = normalizeTitle(term);
      if (!normalizedTerm) continue;
      // Headline matches outrank body-only matches.
      if (titleText.includes(normalizedTerm)) weight += 3;
      else if (allText.includes(normalizedTerm)) weight += 1;
    }
    if (weight > 0 && (!best || weight > best.weight)) best = { category: rule.category, weight };
  }

  if (best) return best.category;
  if (categoryHint) return categoryHint;
  return 'general';
}
