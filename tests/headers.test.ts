import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// Security headers are declared twice on purpose: `server.ts` sets them on the
// API function's responses, and `public/_headers` sets them on everything Netlify
// serves statically (which is most of the site). The source comment says "keep in
// sync" — this is what makes that a check rather than an intention. A header that
// exists in one place and not the other is silently absent for part of the site,
// and the CSP is the one where drift is most dangerous.

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/**
 * These assertions are about the *content* of the header files, not about how
 * the checkout happens to store line endings. A Windows clone with
 * `core.autocrlf=true` hands us CRLF, and two of the rules below are anchored on
 * `\n`, so the same, correct file failed on Windows and passed on Linux. Normalise
 * at the single point where the files are read: the checks then hold for either
 * checkout style without loosening what they demand.
 */
const readNormalized = (path: string): string =>
  readFileSync(join(ROOT, path), 'utf8').replace(/\r\n?/g, '\n');

const serverSource = readNormalized('server.ts');
const headersFile = readNormalized('public/_headers');

/** The production CSP string from server.ts, as sent at runtime. */
function expressCsp(): string {
  return /'Content-Security-Policy',\s*\n?\s*"([^"]+)"/.exec(serverSource)?.[1] ?? '';
}

/** One directive of a CSP as its list of sources. */
function cspSources(csp: string, directive: string): string[] {
  const values = new RegExp(`(?:^|;)\\s*${directive}\\s+([^;]+)`).exec(csp)?.[1] ?? '';
  return values.trim().split(/\s+/).filter(Boolean);
}

/** Header names the Express middleware sets. */
function expressHeaders(): Set<string> {
  return new Set(
    [...serverSource.matchAll(/res\.setHeader\(\s*'([A-Za-z-]+)'/g)].map((match) => match[1].toLowerCase()),
  );
}

/** The `/*` block of public/_headers — what Netlify applies to every response. */
function netlifyWildcardBlock(): string {
  const start = headersFile.indexOf('/*');
  assert.ok(start >= 0, 'public/_headers has no /* block');
  const rest = headersFile.slice(start + 2);
  const nextBlock = rest.search(/\n\/[^\n]|\n#/);
  return nextBlock >= 0 ? rest.slice(0, nextBlock) : rest;
}

function netlifyHeaders(): Set<string> {
  return new Set(
    [...netlifyWildcardBlock().matchAll(/^\s{2}([A-Za-z-]+):/gm)].map((match) => match[1].toLowerCase()),
  );
}

/** The security headers that must be present on every response, from both sources. */
const REQUIRED = [
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-frame-options',
  'content-security-policy',
  'strict-transport-security',
];

test('every required security header is set by the Express middleware', () => {
  const present = expressHeaders();
  for (const header of REQUIRED) {
    assert.ok(present.has(header), `server.ts does not set ${header}`);
  }
});

test('every required security header is set for Netlify static responses', () => {
  const present = netlifyHeaders();
  for (const header of REQUIRED) {
    assert.ok(present.has(header), `public/_headers does not set ${header}`);
  }
});

test('the two header sources declare the same security header set', () => {
  const express = expressHeaders();
  const netlify = netlifyHeaders();
  // Express additionally sets response-specific headers (Cache-Control on /api,
  // X-Robots-Tag on private paths, Retry-After on a 503); those are not part of
  // the shared baseline.
  const expressBaseline = new Set([...express].filter((name) => !['cache-control', 'retry-after', 'x-robots-tag'].includes(name)));
  assert.deepEqual([...expressBaseline].sort(), [...netlify].sort(), 'the two sources have drifted apart');
});

test('the production CSP is identical in both sources', () => {
  const expressCsp = /'Content-Security-Policy',\s*\n?\s*"([^"]+)"/.exec(serverSource)?.[1];
  assert.ok(expressCsp, 'no production CSP found in server.ts');
  const netlifyCsp = /^\s{2}Content-Security-Policy:\s*(.+)$/m.exec(netlifyWildcardBlock())?.[1].trim();
  assert.ok(netlifyCsp, 'no CSP found in public/_headers');
  assert.equal(netlifyCsp, expressCsp, 'the CSP differs between server.ts and public/_headers');
});

test('the production CSP keeps its load-bearing directives', () => {
  const csp = /'Content-Security-Policy',\s*\n?\s*"([^"]+)"/.exec(serverSource)?.[1] ?? '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /base-uri 'self'/);
  // script-src must not allow inline or eval in production: that is the directive
  // that makes an injected <script> inert. The dev branch may, and does.
  const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';
  assert.ok(!/unsafe-inline|unsafe-eval/.test(scriptSrc), `production script-src is too loose: ${scriptSrc}`);
});

test('the development CSP is never the one shipped to production', () => {
  // The dev branch exists because the Vite client needs inline scripts and HMR
  // sockets. It must stay behind the NODE_ENV check, not become the default.
  const prodBranch = serverSource.slice(serverSource.indexOf('if (isProd) {'));
  const devBranch = prodBranch.slice(prodBranch.indexOf('} else {'));
  assert.match(devBranch, /unsafe-eval/, 'the dev CSP is expected to allow eval for HMR');
  const beforeElse = prodBranch.slice(0, prodBranch.indexOf('} else {'));
  assert.ok(!/unsafe-eval/.test(beforeElse), 'the production branch must not allow eval');
});

test('HSTS is bounded and does not bind subdomains', () => {
  // includeSubDomains and preload are one-way decisions: they would also force
  // any future staging or CDN host to HTTPS-only, and preload is effectively
  // irreversible. Deliberate, and asserted so it stays a decision.
  const value = /'Strict-Transport-Security',\s*'([^']+)'/.exec(serverSource)?.[1] ?? '';
  assert.match(value, /max-age=31536000/);
  assert.ok(!/includeSubDomains/i.test(value), 'HSTS must not include subdomains');
  assert.ok(!/preload/i.test(value), 'HSTS must not request preload');
});

test('content-hashed assets are immutable and the shell is never cached', () => {
  /** The header block Netlify applies to one path pattern. */
  const blockFor = (pattern: string): string => {
    const start = headersFile.indexOf(`\n${pattern}\n`);
    assert.ok(start >= 0, `public/_headers has no rule for ${pattern}`);
    const rest = headersFile.slice(start + pattern.length + 2);
    const end = rest.search(/\n(?:\/[^ \n]|#)/);
    return end >= 0 ? rest.slice(0, end) : rest;
  };

  const assets = blockFor('/assets/*');
  assert.match(assets, /Cache-Control: public, max-age=31536000, immutable/);
  assert.match(assets, /immutable/, 'a hashed file whose name changes with its bytes can be cached forever');

  const shell = blockFor('/index.html');
  assert.match(shell, /no-store/, 'a stale index.html would serve references to chunks that no longer exist');
  assert.ok(!/immutable|max-age=31536000/.test(shell), 'the shell must not be cached');

  const serviceWorker = blockFor('/sw.js');
  assert.match(serviceWorker, /no-store/, 'a cached service worker would pin an old app shell');
});

test('the CSP keeps separate https and wss origins for Supabase', () => {
  // connect-src is what lets the browser reach Supabase over REST and Realtime.
  // The two origins are distinct sources: `https://*.supabase.co` does not cover
  // `wss:`, so Realtime would silently drop if one were folded into the other.
  // This asserts the split in both copies of the CSP, because an operator editing
  // the line by hand is exactly the moment it gets merged or truncated.
  const sources = [
    ['server.ts', cspSources(expressCsp(), 'connect-src')],
    ['public/_headers', cspSources(netlifyWildcardBlock(), 'connect-src')],
  ] as const;

  for (const [label, list] of sources) {
    assert.ok(list.includes("'self'"), `${label}: connect-src lost 'self'`);
    assert.ok(list.includes('https://*.supabase.co'), `${label}: connect-src lost the https Supabase origin`);
    assert.ok(list.includes('wss://*.supabase.co'), `${label}: connect-src lost the wss Supabase origin`);
    for (const source of list) {
      assert.ok(
        !/^https?:.*wss?:|^wss?:.*https?:/.test(source),
        `${label}: "${source}" looks like two origins merged into one source`,
      );
    }
  }
  assert.deepEqual(sources[1][1], sources[0][1], 'the two connect-src lists have drifted apart');
});

