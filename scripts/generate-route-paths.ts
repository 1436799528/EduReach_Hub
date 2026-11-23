/**
 * Generated route tables, from the one place that knows the routes.
 *
 * `src/app/routes.tsx` is the router. Everything else that has to agree with it
 * used to agree by hand — the Netlify fallback, the Express fallback, the route
 * manifest. They drifted, and the drift has a name: **soft 404s**. Until now
 * `netlify.toml` ended with `/* → /index.html 200`, so `/anything-at-all`
 * answered 200 with a "Page Not Found" screen. A crawler cannot tell that from a
 * real page, and the sitemap and robots rules had to be special-cased before the
 * shell for exactly this reason.
 *
 * This script reads the router and writes two artifacts:
 *
 *   src/app/routePaths.generated.ts   the route table both servers consult
 *   netlify.toml                      the marked block of 200 rules
 *
 * After it runs, an unknown path is served the shell with a **404 status**, and a
 * real route keeps its 200.
 *
 *   tsx scripts/generate-route-paths.ts           rewrite the artifacts
 *   tsx scripts/generate-route-paths.ts --check   exit 1 if they are out of date
 *
 * CI runs `--check`, so a route added to the router without regenerating fails
 * the build instead of 404ing in production.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const routesPath = join(root, 'src/app/routes.tsx');
const generatedPath = join(root, 'src/app/routePaths.generated.ts');
const netlifyPath = join(root, 'netlify.toml');

const BEGIN = '# BEGIN GENERATED ROUTES';
const END = '# END GENERATED ROUTES';

export interface RouteTable {
  /** Paths the router matches exactly. */
  paths: string[];
  /** Prefixes the router matches with `startsWith` (the router always writes them with a trailing slash). */
  prefixes: string[];
}

export function readRouteTable(source: string = readFileSync(routesPath, 'utf8')): RouteTable {
  const paths = [...new Set([...source.matchAll(/path === '([^']+)'/g)].map((match) => match[1]))].sort();
  const prefixes = [
    ...new Set([...source.matchAll(/path\.startsWith\('([^']+)'\)/g)].map((match) => match[1].replace(/\/+$/, ''))),
  ].sort();
  return { paths, prefixes };
}

function generatedModule(table: RouteTable): string {
  return `/**
 * GENERATED FILE — do not edit.
 *
 * Written by \`scripts/generate-route-paths.ts\` from \`src/app/routes.tsx\`.
 * Run \`npm run routes:generate\` after changing the router; CI runs
 * \`npm run routes:check\` and fails if this file is out of date.
 *
 * It exists so the Netlify fallback and the Express fallback can answer an
 * unknown path with a 404 instead of serving the shell with a 200.
 */

export const APP_ROUTE_PATHS: readonly string[] = ${JSON.stringify(table.paths, null, 2)};

export const APP_ROUTE_PREFIXES: readonly string[] = ${JSON.stringify(table.prefixes, null, 2)};

/** True when the router has a case for this path. Query strings are ignored. */
export function isAppRoute(pathname: string): boolean {
  const path = String(pathname || '/').split('?')[0].split('#')[0];
  const normalized = path.length > 1 ? path.replace(/\\/+$/, '') : path;
  if (APP_ROUTE_PATHS.includes(normalized)) return true;
  return APP_ROUTE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix + '/'));
}
`;
}

function netlifyBlock(table: RouteTable): string {
  const lines = [
    BEGIN,
    '# Written by scripts/generate-route-paths.ts from src/app/routes.tsx.',
    '#',
    '# Every router path answers 200 with the shell; anything else falls through to',
    '# the 404 rule at the end of this block, which serves dist/404.html (a copy of',
    '# the shell) with a real 404 status. Before this, the catch-all answered 200',
    '# for every unknown URL, so search engines indexed soft 404s.',
    '',
  ];
  for (const path of table.paths) {
    if (path === '/') continue;
    lines.push('[[redirects]]', `  from = "${path}"`, '  to = "/index.html"', '  status = 200', '');
  }
  lines.push('[[redirects]]', '  from = "/"', '  to = "/index.html"', '  status = 200', '');
  for (const prefix of table.prefixes) {
    lines.push('[[redirects]]', `  from = "${prefix}/*"`, '  to = "/index.html"', '  status = 200', '');
  }
  lines.push(
    '# The shell, served with the status the path deserves.',
    '[[redirects]]',
    '  from = "/*"',
    '  to = "/404.html"',
    '  status = 404',
    '',
    END,
  );
  return `${lines.join('\n')}\n`;
}

function withBlock(toml: string, block: string): string {
  const start = toml.indexOf(BEGIN);
  const end = toml.indexOf(END);
  if (start === -1 || end === -1) {
    // No block yet: replace the old single catch-all, wherever it sits.
    const stripped = toml.replace(/\n# Client-side routes fall back to the SPA shell[\s\S]*?status = 200\n?$/, '\n');
    return `${stripped.replace(/\s*$/, '')}\n\n${block}`;
  }
  return `${toml.slice(0, start)}${block}${toml.slice(end + END.length + 1)}`;
}

export function buildArtifacts(): { module: string; toml: string; table: RouteTable } {
  const table = readRouteTable();
  const module = generatedModule(table);
  const toml = withBlock(readFileSync(netlifyPath, 'utf8'), netlifyBlock(table));
  return { module, toml, table };
}

function main(): void {
  const check = process.argv.includes('--check');
  const { module, toml, table } = buildArtifacts();

  if (check) {
    const stale: string[] = [];
    if (readFileSync(generatedPath, 'utf8') !== module) stale.push('src/app/routePaths.generated.ts');
    if (readFileSync(netlifyPath, 'utf8') !== toml) stale.push('netlify.toml');
    if (stale.length > 0) {
      console.error(`FAIL route tables are out of date: ${stale.join(', ')}`);
      console.error('     run `npm run routes:generate` and commit the result.');
      process.exitCode = 1;
      return;
    }
    console.log(
      `ok   route tables match src/app/routes.tsx (${table.paths.length} paths, ${table.prefixes.length} prefixes)`,
    );
    return;
  }

  writeFileSync(generatedPath, module);
  writeFileSync(netlifyPath, toml);
  console.log(
    `wrote ${table.paths.length} paths and ${table.prefixes.length} prefixes to routePaths.generated.ts and netlify.toml`,
  );
}

if (process.argv[1] && process.argv[1].endsWith('generate-route-paths.ts')) {
  main();
}
