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
