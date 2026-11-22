/**
 * Splitting a policy document into the cards the page renders.
 *
 * The policy text is stored as one rich-text body, but a single dump of HTML on
 * a white page reads like a pasted document. The page groups it the way the
 * rest of the site is built: a heading card per major section.
 *
 * The split is deliberately conservative: only a top-level `<h2>` starts a new
 * card. Anything before the first heading is the introduction, and inline
 * markup inside a heading is flattened to text so the heading stays a real
 * `<h2>` rather than raw HTML in the page.
 */

import { plainTextFromHtml } from './html-sanitize';

export interface LegalSection {
  /** Stable anchor id derived from the heading. */
  id: string;
  /** Null for the introduction, which has no heading of its own. */
  heading: string | null;
  /** The section body. Already stripped of its own `<h2>`. */
  html: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';
}

const HEADING = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;

export function splitLegalSections(body: string): LegalSection[] {
  const source = String(body || '').trim();
  if (!source) return [];

  const matches = [...source.matchAll(HEADING)];
  if (matches.length === 0) {
    return [{ id: 'overview', heading: null, html: source }];
  }

  const sections: LegalSection[] = [];
  const intro = source.slice(0, matches[0].index).trim();
  if (intro) sections.push({ id: 'introduction', heading: null, html: intro });

  const used = new Set<string>();
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const heading = plainTextFromHtml(match[1] || '').replace(/\s+/g, ' ').trim();
    if (!heading) return;
    let id = slugify(heading);
    if (used.has(id)) {
      let suffix = 2;
      while (used.has(`${id}-${suffix}`)) suffix += 1;
      id = `${id}-${suffix}`;
    }
    used.add(id);
    sections.push({ id, heading, html: source.slice(start, end).trim() });
  });

  return sections;
}
