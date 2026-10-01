/**
 * Default source catalogue.
 *
 * The catalogue lives in code so it is reviewable, and is upserted into
 * `news_sources` on every run. Operational fields (feed_url, discovery mode,
 * is_active, health) live in the database and are never overwritten by that
 * sync, so an operator can correct a feed path or disable a source without a
 * deployment.
 *
 * Publication policy (see docs/NEWSROOM_PIPELINE.md):
 *   tier 1 — primary official source. May publish automatically when the
 *            quality gate and the relevance threshold both pass.
 *   tier 2 — established reporting. Discovered and summarised, but always
 *            queued for human review.
 *   tier 3 — secondary/aggregator. Discovery only; never the sole basis for a
 *            high-impact claim.
 *   tier 4 — social accounts. Discovery only, never auto-published, disabled
 *            until an operator verifies the handle.
 *
 * Feed URLs are a convenience, not an assumption: every source is probed by
 * `npm run newsroom:check` and falls back to HTML link discovery when a feed
 * path is wrong, which is why a wrong feed path degrades instead of breaking.
 */

export type SourceTier = 1 | 2 | 3 | 4;
export type DiscoveryMode = 'auto' | 'rss' | 'html';

export interface SourceDefinition {
  sourceKey: string;
  name: string;
  homepage: string;
  feedUrl?: string | null;
  tier: SourceTier;
  discovery?: DiscoveryMode;
  categoryHint?: string | null;
  trustScore: number;
  isActive?: boolean;
  /** Headline must contain one of these terms — precision filter for general outlets. */
  requiresAnyTitleTerm?: string[];
  /** Skip links whose path does not match this pattern (case-insensitive). */
  pathInclude?: string;
  /** Skip links whose path matches this pattern (case-insensitive). */
  pathExclude?: string;
  notes?: string;
}

export const DEFAULT_SOURCES: SourceDefinition[] = [
  // ---------------------------------------------------------------- Tier 1
  {
    sourceKey: 'jamb',
    name: 'Joint Admissions and Matriculation Board (JAMB)',
    homepage: 'https://www.jamb.gov.ng/',
    tier: 1,
    categoryHint: 'jamb',
    trustScore: 0.98,
    pathInclude: '(news|bulletin|announce|update|notice|press)',
    notes: 'Official UTME/DE announcements, exam slips, CAPS and admissions bulletins.',
  },
  {
    sourceKey: 'waec-nigeria',
    name: 'West African Examinations Council (WAEC Nigeria)',
    homepage: 'https://www.waecnigeria.org/',
    tier: 1,
    categoryHint: 'waec',
    trustScore: 0.97,
    notes: 'WASSCE timetables, result release notices and registration windows.',
  },
  {
    sourceKey: 'neco',
    name: 'National Examinations Council (NECO)',
    homepage: 'https://www.neco.gov.ng/',
    tier: 1,
    categoryHint: 'neco',
    trustScore: 0.97,
    notes: 'SSCE, BECE and NECO GCE registration and result announcements.',
  },
  {
    sourceKey: 'nabteb',
    name: 'National Business and Technical Examinations Board (NABTEB)',
    homepage: 'https://www.nabteb.gov.ng/',
    tier: 1,
    categoryHint: 'nabteb',
    trustScore: 0.95,
    notes: 'Technical and business examination notices.',
  },
  {
    sourceKey: 'nelfund',
    name: 'Nigerian Education Loan Fund (NELFUND)',
    homepage: 'https://nelfund.ng/',
    tier: 1,
    categoryHint: 'nelfund',
    trustScore: 0.98,
    notes: 'Student loan application windows, institutional eligibility and disbursement updates.',
  },
  {
    sourceKey: 'nuc',
    name: 'National Universities Commission (NUC)',
    homepage: 'https://www.nuc.edu.ng/',
    tier: 1,
    categoryHint: 'universities',
    trustScore: 0.96,
    notes: 'Accreditation, approved programmes and university system directives.',
  },
  {
    sourceKey: 'nbte',
    name: 'National Board for Technical Education (NBTE)',
    homepage: 'https://nbte.gov.ng/',
    tier: 1,
    categoryHint: 'polytechnics',
    trustScore: 0.94,
    notes: 'Polytechnic and technical college regulation and accreditation.',
  },
  {
    sourceKey: 'tetfund',
    name: 'Tertiary Education Trust Fund (TETFund)',
    homepage: 'https://tetfund.gov.ng/',
    tier: 1,
    categoryHint: 'scholarships',
    trustScore: 0.94,
    notes: 'Tertiary institution funding, scholarships and intervention notices.',
  },
  {
    sourceKey: 'federal-ministry-of-education',
    name: 'Federal Ministry of Education',
    homepage: 'https://education.gov.ng/',
    tier: 1,
    categoryHint: 'general',
    trustScore: 0.95,
    notes: 'Federal policy, strike negotiations and national education directives.',
  },
  {
    sourceKey: 'nysc',
    name: 'National Youth Service Corps (NYSC)',
    homepage: 'https://www.nysc.gov.ng/',
    tier: 1,
    categoryHint: 'general',
    trustScore: 0.93,
    notes: 'Mobilisation, call-up letters and orientation updates for graduates.',
  },

  // ---------------------------------------------------------------- Tier 2
  {
    sourceKey: 'punch-education',
    name: 'The Punch',
    homepage: 'https://punchng.com/',
    feedUrl: 'https://punchng.com/feed/',
    tier: 2,
    categoryHint: 'general',
    trustScore: 0.75,
    requiresAnyTitleTerm: [
      'jamb', 'utme', 'waec', 'neco', 'nabteb', 'nelfund', 'student', 'students',
      'university', 'universities', 'polytechnic', 'admission', 'school', 'schools',
      'education', 'asuu', 'scholarship', 'campus', 'hnd', 'nysc', 'academic',
    ],
    notes: 'High-volume general outlet; headline filter keeps education items only.',
  },
  {
    sourceKey: 'vanguard-education',
    name: 'Vanguard Nigeria',
    homepage: 'https://www.vanguardngr.com/',
    feedUrl: 'https://www.vanguardngr.com/feed/',
    tier: 2,
    categoryHint: 'general',
    trustScore: 0.72,
    requiresAnyTitleTerm: [
      'jamb', 'utme', 'waec', 'neco', 'nabteb', 'nelfund', 'student', 'students',
      'university', 'universities', 'polytechnic', 'admission', 'school', 'schools',
      'education', 'asuu', 'scholarship', 'campus', 'nysc', 'academic',
    ],
    notes: 'General outlet; education-filtered.',
  },
  {
    sourceKey: 'premium-times-education',
    name: 'Premium Times',
    homepage: 'https://www.premiumtimesng.com/',
    feedUrl: 'https://www.premiumtimesng.com/feed',
    tier: 2,
    categoryHint: 'general',
    trustScore: 0.8,
    requiresAnyTitleTerm: [
      'jamb', 'utme', 'waec', 'neco', 'nelfund', 'student', 'students', 'university',
      'universities', 'polytechnic', 'admission', 'school', 'schools', 'education',
      'asuu', 'scholarship', 'campus', 'nysc', 'academic',
    ],
    notes: 'Established reporting; still secondary to the official source it describes.',
  },
  {
    sourceKey: 'guardian-nigeria-education',
    name: 'The Guardian Nigeria',
    homepage: 'https://guardian.ng/',
    feedUrl: 'https://guardian.ng/feed/',
    tier: 2,
    categoryHint: 'general',
    trustScore: 0.72,
    requiresAnyTitleTerm: [
      'jamb', 'utme', 'waec', 'neco', 'nelfund', 'student', 'students', 'university',
      'universities', 'polytechnic', 'admission', 'school', 'schools', 'education',
      'asuu', 'scholarship', 'campus', 'nysc', 'academic',
    ],
    notes: 'General outlet; education-filtered.',
  },
  {
    sourceKey: 'the-cable-education',
    name: 'TheCable',
    homepage: 'https://www.thecable.ng/',
    feedUrl: 'https://www.thecable.ng/feed',
    tier: 2,
    categoryHint: 'general',
    trustScore: 0.74,
    requiresAnyTitleTerm: [
      'jamb', 'utme', 'waec', 'neco', 'nelfund', 'student', 'students', 'university',
      'universities', 'polytechnic', 'admission', 'school', 'schools', 'education',
      'asuu', 'scholarship', 'campus', 'nysc', 'academic',
    ],
    notes: 'General outlet; education-filtered.',
  },
  {
    sourceKey: 'daily-trust-education',
    name: 'Daily Trust',
    homepage: 'https://dailytrust.com/',
    feedUrl: 'https://dailytrust.com/feed/',
    tier: 2,
    categoryHint: 'general',
    trustScore: 0.72,
    requiresAnyTitleTerm: [
      'jamb', 'utme', 'waec', 'neco', 'nelfund', 'student', 'students', 'university',
      'universities', 'polytechnic', 'admission', 'school', 'schools', 'education',
      'asuu', 'scholarship', 'campus', 'nysc', 'academic',
    ],
    notes: 'General outlet; education-filtered.',
  },

  // ------------------------------------------------ Tier 4 (disabled by default)
  {
    sourceKey: 'x-jamb',
    name: 'JAMB on X',
    homepage: 'https://x.com/JAMBHQ',
    tier: 4,
    categoryHint: 'jamb',
    trustScore: 0.6,
    isActive: false,
    notes: 'Discovery only and never auto-published. Verify the handle before enabling; X blocks automated fetching.',
  },
  {
    sourceKey: 'x-nelfund',
    name: 'NELFUND on X',
    homepage: 'https://x.com/NELFUND',
    tier: 4,
    categoryHint: 'nelfund',
    trustScore: 0.6,
    isActive: false,
    notes: 'Discovery only and never auto-published. Verify the handle before enabling.',
  },
];

export function sourceByKey(key: string): SourceDefinition | undefined {
  return DEFAULT_SOURCES.find((source) => source.sourceKey === key);
}

/** Tier 1 sources may publish without review once the gate passes. */
export function requiresHumanReview(source: Pick<SourceDefinition, 'tier'>): boolean {
  return source.tier > 1;
}

export function sourceFromRegistryRow(row: Record<string, unknown>): SourceDefinition {
  return {
    sourceKey: String(row.source_key || ''),
    name: String(row.name || ''),
    homepage: String(row.homepage || ''),
    feedUrl: row.feed_url ? String(row.feed_url) : null,
    tier: Number(row.tier || 2) as SourceTier,
    discovery: (row.discovery ? String(row.discovery) : 'auto') as DiscoveryMode,
    categoryHint: row.category_hint ? String(row.category_hint) : null,
    trustScore: typeof row.trust_score === 'number' ? row.trust_score : Number(row.trust_score || 0.6),
    isActive: row.is_active !== false,
    notes: row.notes ? String(row.notes) : undefined,
  };
}
