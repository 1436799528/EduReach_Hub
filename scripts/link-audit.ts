/**
 * Every internal link, checked against the router.
 *
 * The site has no server-side render step to fail on a bad href, so a link to a
 * path the router does not know is served the 404 screen only after a deploy,
 * and nothing in CI notices. This script closes that: it reads the route table
 * from `src/app/routes.tsx` (the same reader `routes:check` uses) and every
 * literal link in the source, then reports the ones that resolve to nothing.
 *
 * What counts as a link:
 *   - `href="/..."`, `href={'/...'}`, `href={\`/...\`}`
 *   - `href: '/...'` in data modules (nav lists, footer lists, cards)
 *   - `navigate('/...')` and `window.location.assign/replace('/...')`
 *
 * A template literal is checked by its static head: `` `/news/${slug}` `` needs
 * a route at `/news` (or a prefix that covers it), which is exactly the mistake
 * that produces 404s in practice.
 *
 *   tsx scripts/link-audit.ts            report, exit 1 on a broken link
 *   tsx scripts/link-audit.ts --verbose  also list every external host
 *
 * Deliberately not a network crawl: this runs offline in CI on every pull
 * request. The post-deploy crawl (`npm run smoke -- <url> --pages`) is the
 * other half and needs a live site.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readRouteTable } from './generate-route-paths';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Directories worth reading. Generated and vendored trees are skipped. */
const SOURCE_DIRS = ['pages', 'src', 'public'];
const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.html'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', 'generated']);

/** Files that legitimately name paths without linking to them. */
const SKIP_FILES = new Set([
  // The router itself: its `path === '/x'` comparisons are not links.
  'src/app/routes.tsx',
  'src/app/routePaths.generated.ts',
  // The audit reads these to decide what is valid.
  'src/app/pageManifest.ts',
  'src/lib/seoMeta.ts',
  'scripts/link-audit.ts',
]);

/** Static files served from `dist/` that are not routes. */
const STATIC_PREFIXES = ['/assets/', '/images/', '/og/', '/fonts/', '/icons/', '/audio/', '/video/', '/documents/'];

const STATIC_FILES = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/manifest.json',
  '/manifest.webmanifest',
  '/sw.js',
  '/robots.txt',
  '/sitemap.xml',
  '/site.webmanifest',
  '/404.html',
]);

interface Link {
  file: string;
  line: number;
  target: string;
}

interface Finding extends Link {
  reason: string;
}

export const PLACEHOLDER = '\u0000';

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, out);
    } else if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      out.push(full);
    }
  }
  return out;
}

/** Turn a template literal into text with one marker per interpolation. */
function markInterpolations(raw: string): string {
  return raw.replace(/\$\{[^}]*\}/g, PLACEHOLDER);
}

function unescape(value: string): string {
  return value.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\`/g, '`');
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/**
 * All literal link targets in one file.
 *
 * The patterns overlap on purpose: a JSX attribute and a data object property
 * look different, and missing one class of link is how the site ends up with a
 * dead footer. Duplicates are removed by file+line+target.
 */
export function linksIn(file: string, source: string): Link[] {
  const found = new Map<string, Link>();
  const add = (index: number, raw: string) => {
    const target = unescape(markInterpolations(raw)).trim();
    if (!target) return;
    const key = `${index}:${target}`;
    if (!found.has(key)) found.set(key, { file, line: lineOf(source, index), target });
  };

  const patterns: Array<[RegExp, number]> = [
    // href="/x"  href='/x'
    [/\bhref\s*=\s*(?:"([^"\n]+)"|'([^'\n]+)')/g, 1],
    // href={"/x"}  href={'/x'}  href={`/x`}
    [/\bhref\s*=\s*\{\s*(?:`([^`\n]+)`|"([^"\n]+)"|'([^'\n]+)')\s*\}/g, 1],
    // href: '/x'  (nav and footer data)
    [/\bhref\s*:\s*(?:`([^`\n]+)`|"([^"\n]+)"|'([^'\n]+)')/g, 1],
    // route: '/x'  (service cards and directory records point at a page)
    [/\broute\s*:\s*(?:`([^`\n]+)`|"([^"\n]+)"|'([^'\n]+)')/g, 1],
    // navigate('/x')
    [/\bnavigate\(\s*(?:`([^`\n]+)`|"([^"\n]+)"|'([^'\n]+)')/g, 1],
    // window.location.href = '/x'
    [/window\.location\.(?:href|assign|replace)\s*(?:=\s*)?\(\s*(?:`([^`\n]+)`|"([^"\n]+)"|'([^'\n]+)')/g, 1],
  ];

  for (const [pattern, firstGroup] of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = [0, 1, 2].map((offset) => match[firstGroup + offset]).find((part) => part !== undefined);
      if (value === undefined) continue;
      add(match.index ?? 0, value);
    }
  }

  return [...found.values()].sort((a, b) => a.line - b.line);
}

export type Verdict = 'route' | 'prefix' | 'static' | 'api' | 'external' | 'anchor' | 'broken' | 'ignored';

export function classify(target: string, paths: Set<string>, prefixes: string[]): Verdict {
  const withoutHash = target.split('#')[0].split('?')[0];
  if (target.startsWith('#')) return 'anchor';
  if (withoutHash === '') return 'anchor';
  if (/^(mailto|tel):/i.test(target)) return 'ignored';
  if (/^https?:\/\//i.test(target)) return 'external';
  if (/^(javascript|data):/i.test(target)) return 'broken';
  if (!withoutHash.startsWith('/')) return 'ignored';

  const placeholderAt = withoutHash.indexOf(PLACEHOLDER);

  if (placeholderAt === -1) {
    const path = withoutHash.length > 1 ? withoutHash.replace(/\/+$/, '') : withoutHash;
    if (paths.has(path)) return 'route';
    if (prefixes.some((prefix) => path === prefix || path.startsWith(prefix + '/'))) return 'prefix';
    if (STATIC_FILES.has(path)) return 'static';
    if (STATIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'static';
    if (path.startsWith('/api/')) return 'api';
    // A dynamic page's own base (`/news/:slug` unit) is fine when a prefix covers it.
    return 'broken';
  }

  // `/news/${slug}`: the static head decides. It must be a route or be covered
  // by a prefix, otherwise the first rendered link is a 404.
  const head = withoutHash.slice(0, placeholderAt).replace(/\/+$/, '');
  if (head === '') return 'route'; // `${base}` built entirely at runtime
  if (paths.has(head)) return 'route';
  if (prefixes.some((prefix) => head === prefix || head.startsWith(prefix + '/'))) return 'prefix';
  if (head.startsWith('/api/')) return 'api';
  // A head that is itself dynamic (`/${kind}/x`) cannot be judged statically.
  if (head === '/') return 'ignored';
  return 'broken';
}

function main(): void {
  const verbose = process.argv.includes('--verbose');
  const { paths, prefixes } = readRouteTable();
  const pathSet = new Set(paths);

  const files = SOURCE_DIRS.flatMap((dir) => walk(join(root, dir))).filter((file) => {
    const rel = relative(root, file).split('\\').join('/');
    return !SKIP_FILES.has(rel);
  });

  const byVerdict = new Map<Verdict, Finding[]>();
  const hosts = new Map<string, number>();
  let total = 0;

  for (const file of files) {
    const rel = relative(root, file).split('\\').join('/');
    const source = readFileSync(file, 'utf8');
    for (const link of linksIn(rel, source)) {
      total += 1;
      const verdict = classify(link.target, pathSet, prefixes);
      if (verdict === 'external') {
        try {
          const host = new URL(link.target.startsWith('//') ? `https:${link.target}` : link.target).host;
          hosts.set(host, (hosts.get(host) ?? 0) + 1);
        } catch {
          byVerdict.set('broken', [
            ...(byVerdict.get('broken') ?? []),
            { ...link, reason: 'external URL does not parse' },
          ]);
          continue;
        }
      }
      const reason =
        verdict === 'broken'
          ? link.target.includes(PLACEHOLDER)
            ? 'static head has no matching route'
            : 'no route, prefix or static file serves this path'
          : verdict;
      byVerdict.set(verdict, [...(byVerdict.get(verdict) ?? []), { ...link, reason }]);
    }
  }

  const broken = byVerdict.get('broken') ?? [];
  const count = (verdict: Verdict) => (byVerdict.get(verdict) ?? []).length;

  console.log(`link-audit: ${total} links in ${files.length} files`);
  console.log(
    `  routes ${count('route')}   prefixes ${count('prefix')}   static ${count('static')}   api ${count('api')}   external ${count('external')}   anchors ${count('anchor')}   ignored ${count('ignored')}`,
  );

  if (verbose) {
    console.log('\nexternal hosts:');
    for (const [host, n] of [...hosts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)}  ${host}`);
    }
  }

  if (broken.length === 0) {
    console.log('\nOK every internal link resolves to a route, a prefix or a static file.');
    return;
  }

  console.error(`\nFAIL ${broken.length} broken internal link${broken.length === 1 ? '' : 's'}:`);
  for (const finding of broken) {
    console.error(`  ${finding.file}:${finding.line}  ${finding.target}  — ${finding.reason}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
