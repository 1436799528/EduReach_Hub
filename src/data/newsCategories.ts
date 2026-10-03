/**
 * Single source of truth for news categories.
 *
 * The Admin Newsroom editor writes these slugs into `news_articles.category`;
 * the public News page derives its filter pills from the same list, so a new
 * category never requires a second code change. Legacy slugs from earlier
 * releases stay readable so existing rows keep rendering with a label.
 */

export type NewsCategory = { slug: string; label: string };

export const newsCategories: NewsCategory[] = [
  { slug: 'jamb', label: 'JAMB & UTME' },
  { slug: 'waec', label: 'WAEC' },
  { slug: 'neco', label: 'NECO' },
  { slug: 'nabteb', label: 'NABTEB' },
  { slug: 'admissions', label: 'Admissions' },
  { slug: 'universities', label: 'Universities' },
  { slug: 'polytechnics', label: 'Polytechnics' },
  { slug: 'colleges-of-education', label: 'Colleges of Education' },
  { slug: 'scholarships', label: 'Scholarships & Funding' },
  { slug: 'nelfund', label: 'NELFUND' },
  { slug: 'post-utme', label: 'Post-UTME' },
  { slug: 'school-updates', label: 'School Updates' },
  { slug: 'examination-updates', label: 'Examination Updates' },
  { slug: 'academic-calendar', label: 'Academic Calendar' },
  { slug: 'general', label: 'General Education' },
];

/** Legacy slugs that may already exist in the database. */
const legacyLabels: Record<string, string> = {
  campus: 'Campus Updates',
  funding: 'Scholarships & Funding',
  admission: 'Admissions',
  results: 'Examination Updates',
};

const labelBySlug = new Map<string, string>([
  ...newsCategories.map((category) => [category.slug, category.label] as [string, string]),
  ...Object.entries(legacyLabels),
]);

export function newsCategoryLabel(slug: string): string {
  const normalized = String(slug || '').trim().toLowerCase();
  const known = labelBySlug.get(normalized);
  if (known) return known;
  return normalized.replaceAll('-', ' ').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'General Education';
}

/** Slugs offered as editor choices: the maintained list + any legacy value currently in use. */
export function newsCategoryOptions(current?: string): NewsCategory[] {
  if (current && !labelBySlug.has(current.trim().toLowerCase())) {
    return [...newsCategories, { slug: current.trim().toLowerCase(), label: newsCategoryLabel(current) }];
  }
  return newsCategories;
}

/**
 * The canonical slug for a stored category.
 *
 * This mirrors `public.news_category_slug(text)` in the database (migration
 * 20261002130000), which is the generated `news_articles.category_slug` column.
 * The rule lives in both places on purpose: the database makes the stored value
 * filterable and indexed, and the client keeps working against an older payload
 * or a cached response.
 *
 * The bug this closes: editors wrote labels ("Scholarships & Funding",
 * "NABTEB") while the page filtered by slug ("scholarships", "nabteb"), so a
 * live article could be invisible under its own category.
 */
const ALIAS_SLUGS: Record<string, string> = {
  // Keys are already normalised (lowercase, punctuation collapsed to dashes),
  // because that is what the lookup receives.
  'scholarships-funding': 'scholarships',
  'scholarship-funding': 'scholarships',
  'scholarships-and-funding': 'scholarships',
  funding: 'scholarships',
  grant: 'scholarships',
  grants: 'scholarships',
  scholarship: 'scholarships',
  scholarships: 'scholarships',
  admission: 'admissions',
  admissions: 'admissions',
  campus: 'school-updates',
  'campus-updates': 'school-updates',
  'school-updates': 'school-updates',
  'school-update': 'school-updates',
  results: 'examination-updates',
  result: 'examination-updates',
  'exam-updates': 'examination-updates',
  'exam-update': 'examination-updates',
  'examination-updates': 'examination-updates',
  'examination-update': 'examination-updates',
  utme: 'jamb',
  'jamb-utme': 'jamb',
  'jamb-and-utme': 'jamb',
  jamb: 'jamb',
  'post-utme': 'post-utme',
  postutme: 'post-utme',
  'college-of-education': 'colleges-of-education',
  'colleges-of-education': 'colleges-of-education',
  university: 'universities',
  universities: 'universities',
  polytechnic: 'polytechnics',
  polytechnics: 'polytechnics',
  general: 'general',
  'general-education': 'general',
  education: 'general',
};

export function newsCategorySlug(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) return 'general';
  return ALIAS_SLUGS[normalized] || normalized;
}

/** True when an article's stored category matches a filter slug (labels, legacy slugs and case all resolve). */
export function newsCategoryMatches(articleCategory: string, filterSlug: string): boolean {
  const filter = newsCategorySlug(filterSlug);
  if (!filter || filter === 'all') return true;
  return newsCategorySlug(articleCategory) === filter;
}
