/**
 * Search matching for the site search.
 *
 * The first version compared `haystack.includes(query)`, which fails the two
 * things people actually type: words in a different order ("jamb slip") and
 * punctuation ("JAMB?"). This version normalises both sides, splits the query
 * into words and requires every word to appear somewhere in the record - in any
 * order - which is what a student means by a search.
 *
 * It is deliberately not a fuzzy matcher: a typo should produce the honest
 * "nothing matched" state with a way to ask, not a confident wrong link.
 */

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: "université" finds "universite"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function searchTokens(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  // De-duplicate: "jamb jamb" is one requirement, not two.
  return Array.from(new Set(normalized.split(' ').filter(Boolean)));
}

/**
 * True when every token in `query` appears in one of the fields.
 * Order and punctuation do not matter; a missing word does.
 */
export function matchesSearch(fields: Array<string | null | undefined>, query: string): boolean {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = normalizeSearchText(fields.filter(Boolean).join(' '));
  if (!haystack) return false;
  return tokens.every((token) => haystack.includes(token));
}

export type HighlightSegment = { text: string; match: boolean };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split a label into the parts a suggestion should emphasise.
 *
 * The matcher is token-based, so highlighting uses the same tokens rather than
 * the raw query: typing "jamb slip" marks both words wherever they appear, and
 * punctuation in the query cannot become a regular-expression operator. Longer
 * tokens come first so "past questions" marks the phrase rather than "past"
 * twice. The unstyled text is always a segment, so a no-match still renders the
 * complete label.
 */
export function highlightSegments(value: string, query: string): HighlightSegment[] {
  const text = String(value ?? '');
  if (!text) return [];
  const tokens = searchTokens(query).sort((a, b) => b.length - a.length);
  if (!tokens.length) return [{ text, match: false }];
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');
  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: text.slice(lastIndex, index), match: false });
    segments.push({ text: match[0], match: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), match: false });
  return segments.length ? segments : [{ text, match: false }];
}

export function filterSearchItems<T extends { title: string; description: string; category: string }>(
  items: T[],
  query: string,
  limit = 40,
): T[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return items.slice(0, limit);
  const matches = items.filter((item) => matchesSearch([item.title, item.description, item.category], query));
  return matches
    .map((item, index) => ({
      item,
      index,
      rank: normalizeSearchText(item.title) === normalized ? 0
        : normalizeSearchText(item.title).startsWith(normalized) ? 1
        : normalizeSearchText(item.category).startsWith(normalized) ? 2
        : 3,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
}
