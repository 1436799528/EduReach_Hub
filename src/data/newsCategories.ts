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

/** True when an article's stored category matches a filter slug (with legacy aliases). */
export function newsCategoryMatches(articleCategory: string, filterSlug: string): boolean {
  const article = String(articleCategory || '').trim().toLowerCase();
  const filter = filterSlug.trim().toLowerCase();
  if (!filter || filter === 'all') return true;
  if (article === filter) return true;
  // Alias groups so older rows respond to the current filter names.
  const aliases: Record<string, string[]> = {
    admissions: ['admission'],
    scholarships: ['funding', 'grant'],
    'school-updates': ['campus'],
    'examination-updates': ['results', 'result'],
    jamb: ['utme'],
    'post-utme': ['postutme'],
  };
  return (aliases[filter] || []).some((alias) => article === alias);
}
