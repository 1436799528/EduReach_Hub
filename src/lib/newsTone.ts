/**
 * News card colour.
 *
 * The news board goes back to the coloured card the rest of EduReach uses — a
 * gradient surface with white type — instead of the white square that made every
 * story look like the same placeholder. Colour is chosen by category so a reader
 * learns the board ("blue is government exam news, teal is school news"), and it
 * does not depend on row order: filtering the list cannot repaint the cards.
 *
 * Every tone is a real pair from the original banner palette, darkened at the
 * light end so white headline text clears 4.5:1 on the lightest pixel of the
 * gradient (see the numbers in NEWS-1-GRADIENT-CARDS.md). A tone name is also
 * the CSS hook (`er-news-tone-<tone>`), so the component never carries colours.
 */

export const NEWS_TONES = ['indigo', 'blue', 'teal', 'cyan', 'violet', 'plum', 'rose', 'amber'] as const;

export type NewsTone = (typeof NEWS_TONES)[number];

const TONE_BY_CATEGORY: Record<string, NewsTone> = {
  jamb: 'indigo',
  utme: 'indigo',
  'jamb-utme': 'indigo',
  waec: 'blue',
  'waec-ssce': 'blue',
  neco: 'teal',
  nabteb: 'cyan',
  admissions: 'plum',
  admission: 'plum',
  screening: 'plum',
  'post-utme': 'violet',
  postutme: 'violet',
  universities: 'indigo',
  polytechnics: 'teal',
  'colleges-of-education': 'cyan',
  scholarships: 'amber',
  funding: 'amber',
  nelfund: 'teal',
  'school-updates': 'violet',
  campus: 'violet',
  'examination-updates': 'rose',
  results: 'rose',
  'academic-calendar': 'cyan',
  general: 'blue',
};

/**
 * The tone for a stored category slug. Unknown slugs stay readable and keep a
 * stable colour through a small deterministic hash, so a category added in the
 * newsroom never renders as an unstyled card.
 */
export function newsToneFor(category: string | null | undefined): NewsTone {
  const slug = String(category ?? '').trim().toLowerCase();
  const known = TONE_BY_CATEGORY[slug];
  if (known) return known;
  if (!slug) return 'blue';
  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) hash = (hash * 31 + slug.charCodeAt(index)) % 997;
  return NEWS_TONES[hash % NEWS_TONES.length];
}

/** The class a news card carries for its tone. */
export function newsToneClass(category: string | null | undefined): string {
  return `er-news-tone-${newsToneFor(category)}`;
}
