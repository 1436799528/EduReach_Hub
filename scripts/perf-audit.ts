import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// PERF-1: the performance budget, checked against the thing that ships.
//
// Two kinds of number live here. The first kind is exact: bytes on disk after
// `npm run build`, which are the same on every machine, in CI and on a laptop,
// and are therefore budgeted tightly. The second kind is a decision that is
// invisible in a byte count — is the font chain render-blocking, are the hashed
// assets cached, does every image declare how it should be loaded — and those
// are checked as facts rather than measured.
//
// Nothing here measures paint. That is `tests/e2e/perf.spec.ts`, in a throttled
// browser, and it is deliberately coarser: a shared CI runner is not a phone.
//
// See docs/features/PERF-1.md. `tests/perf.test.ts` proves each check fails when
// it should.

export interface PerfCheck {
  id: string;
  label: string;
  measured: string;
  budget: string;
  ok: boolean;
  detail?: string;
}

export interface DistFile {
  /** repo-relative path */
  path: string;
  raw: number;
  gzip: number;
  text: string;
}

export interface PerfInput {
  /** `dist/assets/*.js` and `*.css` — what the browser downloads */
  assets: Map<string, DistFile>;
  /** every raster file under `public/`, which is copied into the deploy as-is */
  images: Map<string, number>;
  indexHtml: string;
  headers: string;
  /** jsx sources, for the image-loading rule */
  sources: Map<string, string>;
}

/**
 * Budgets, each next to the measurement that set it. A budget without its
 * baseline is decoration: this comment is what makes the slack reviewable.
 */
export const BUDGETS = {
  entryJsGzip: 100 * 1024, // measured 90.6 KB
  supabaseChunkGzip: 60 * 1024, // measured 56.2 KB — the session client, on every page by design
  criticalPathGzip: 210 * 1024, // measured 192.7 KB: entry + react + supabase + bundle CSS
  totalJsGzip: 310 * 1024, // measured 280.9 KB across 58 chunks
  // Measured 46.0 KB. The budget used to be 46 KB, i.e. an exact tie with the
  // measurement, so the gate failed on any CSS addition at all — a budget with
  // no headroom stops being a reviewable threshold and becomes an accident
  // (audit P3-1). Raised deliberately; the stylesheet consolidation that would
  // let this come back down is tracked in the audit's P3-5.
  cssGzip: 50 * 1024,
  largestImage: 64 * 1024, // measured 60.6 KB (news photo); was 139 KB before PERF-1
  totalImages: 320 * 1024, // measured 291.9 KB; was 532 KB before PERF-1
} as const;

/** Images that are deliberately eager: small, dimensioned, above the fold. */
const IMG_LOADING_ALLOWLIST = new Map<string, string>([
  ['pages/ExamSetupPage.tsx', 'setup hero emblem: 48×48, explicit dimensions, above the fold'],
  ['pages/ProfileCompletionPage.tsx', 'account avatar: 64×64 box fixed in CSS, above the fold'],
  ['pages/StudentDashboardV2.tsx', "dashboard avatar: fixed box, above the fold, a remote URL that is the student's own"],
  ['src/components/BrandLogo.tsx', 'the brand mark itself, an SVG pulled from /logo; SVG needs no decode step'],
]);

const KB = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

function fileEntry(path: string, full: string): DistFile {
  const bytes = readFileSync(full);
  return { path, raw: bytes.byteLength, gzip: gzipSync(bytes, { level: 6 }).byteLength, text: bytes.toString('utf8') };
}

/** Everything the audit judges, read from disk. */
export function readPerfInput(root: string): PerfInput {
  const assets = new Map<string, DistFile>();
  const images = new Map<string, number>();
  const sources = new Map<string, string>();

  const assetDir = join(root, 'dist/assets');
  if (existsSync(assetDir)) {
    for (const entry of readdirSync(assetDir)) {
      if (!/\.(js|css)$/.test(entry)) continue;
      assets.set(entry, fileEntry(`dist/assets/${entry}`, join(assetDir, entry)));
    }
  }

  const walk = (dir: string, into: (full: string, repoPath: string) => void): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, into);
      else into(full, relative(root, full).split('\\').join('/'));
    }
  };
  walk(join(root, 'public'), (full, repoPath) => {
    if (/\.(png|jpe?g|webp|gif|avif)$/i.test(repoPath)) images.set(repoPath, statSync(full).size);
  });
  for (const dir of ['src', 'pages']) {
    walk(join(root, dir), (full, repoPath) => {
      if (repoPath.endsWith('.tsx')) sources.set(repoPath, readFileSync(full, 'utf8'));
    });
  }

  const indexHtml = readFileSync(join(root, 'dist/index.html'), 'utf8');
  const headers = readFileSync(join(root, 'public/_headers'), 'utf8');
  return { assets, images, indexHtml, headers, sources };
}

/** Every `<img>` in the JSX sources, with the attributes written on it. */
export function imgElements(sources: Map<string, string>): Array<{ file: string; line: number; attributes: string[]; srcIsSvgOrData: boolean }> {
  const found: Array<{ file: string; line: number; attributes: string[]; srcIsSvgOrData: boolean }> = [];
  for (const [file, text] of sources) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node): void => {
      const opening = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : undefined;
      if (opening && ts.isIdentifier(opening.tagName) && opening.tagName.text === 'img') {
        const attributes = opening.attributes.properties
          .filter((property): property is ts.JsxAttribute => ts.isJsxAttribute(property))
          .map((property) => property.name.getText(source));
        const src = opening.attributes.properties.find(
          (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(source) === 'src',
        );
        // `src={...}` may be a string, a template literal, or a prop. A literal
        // is read directly; anything else is judged on its source text, which is
        // enough to recognise an inline SVG data URL. Whatever is left is treated
        // as a raster image and must declare a loading strategy (or be allowlisted).
        const value = src?.initializer;
        const literal = value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
          ? value.text
          : value?.getText(source) ?? '';
        found.push({
          file,
          line: source.getLineAndCharacterOfPosition(opening.getStart(source)).line + 1,
          attributes,
          srcIsSvgOrData: /data:/i.test(literal) || /\.svg['"`]?\s*$/i.test(literal),
        });
      }
      node.forEachChild(visit);
    };
    visit(source);
  }
  return found;
}

/** The budget table. Pure: it judges the input it is given and nothing else. */
export function auditPerf(input: PerfInput): PerfCheck[] {
  const checks: PerfCheck[] = [];
  const byName = (pattern: RegExp): DistFile | undefined =>
    [...input.assets.values()].find((file) => pattern.test(file.path.split('/').pop() ?? ''));
  const sumGzip = (files: DistFile[]): number => files.reduce((total, file) => total + file.gzip, 0);

  const entry = byName(/^index-.*\.js$/);
  const supabase = byName(/^supabase-.*\.js$/);
  const react = byName(/^react-.*\.js$/);
  const css = byName(/^index-.*\.css$/);
  const allJs = [...input.assets.values()].filter((file) => file.path.endsWith('.js'));

  if (!entry || !css) {
    return [
      {
        id: 'artefacts',
        label: 'build output present',
        measured: `${input.assets.size} asset(s) under dist/assets`,
        budget: 'dist/index-*.js and dist/index-*.css',
        ok: false,
        detail: 'run `npm run build` first — the budget is checked against the artefact that ships, not the source',
      },
    ];
  }

  checks.push({
    id: 'entry-js',
    label: 'entry chunk (gzip)',
    measured: KB(entry.gzip),
    budget: `≤ ${KB(BUDGETS.entryJsGzip)}`,
    ok: entry.gzip <= BUDGETS.entryJsGzip,
    detail: `react + router + the app shell — ${entry.path}`,
  });

  if (supabase) {
    checks.push({
      id: 'supabase-chunk',
      label: 'supabase client chunk (gzip)',
      measured: KB(supabase.gzip),
      budget: `≤ ${KB(BUDGETS.supabaseChunkGzip)}`,
      ok: supabase.gzip <= BUDGETS.supabaseChunkGzip,
      detail: 'loaded on every page because AuthProvider resolves the session in the shell — a deliberate cost, budgeted so it cannot grow unnoticed',
    });
  }

  checks.push({
    id: 'css',
    label: 'bundle css (gzip)',
    measured: KB(css.gzip),
    budget: `≤ ${KB(BUDGETS.cssGzip)}`,
    ok: css.gzip <= BUDGETS.cssGzip,
  });

  const critical = sumGzip([entry, react, supabase, css].filter((file): file is DistFile => Boolean(file)));
  checks.push({
    id: 'critical-path',
    label: 'critical path (gzip)',
    measured: KB(critical),
    budget: `≤ ${KB(BUDGETS.criticalPathGzip)}`,
    ok: critical <= BUDGETS.criticalPathGzip,
    detail: 'entry + react + supabase + css: what the landing page must download before it is interactive',
  });

  const totalJs = sumGzip(allJs);
  checks.push({
    id: 'total-js',
    label: 'all chunks (gzip)',
    measured: KB(totalJs),
    budget: `≤ ${KB(BUDGETS.totalJsGzip)}`,
    ok: totalJs <= BUDGETS.totalJsGzip,
    detail: `${allJs.length} chunks; the route chunks are lazy, so this is not a first-load number`,
  });

  const largest = [...input.images.entries()].sort((a, b) => b[1] - a[1])[0];
  checks.push({
    id: 'largest-image',
    label: 'largest image',
    measured: largest ? `${KB(largest[1])} (${largest[0]})` : 'no raster images',
    budget: `≤ ${KB(BUDGETS.largestImage)} each`,
    ok: !largest || largest[1] <= BUDGETS.largestImage,
  });

  const totalImages = [...input.images.values()].reduce((total, size) => total + size, 0);
  checks.push({
    id: 'total-images',
    label: 'raster images in the deploy',
    measured: KB(totalImages),
    budget: `≤ ${KB(BUDGETS.totalImages)}`,
    ok: totalImages <= BUDGETS.totalImages,
    detail: `${input.images.size} files under public/`,
  });

  // The font chain: a <link> the browser can start immediately, not a CSS
  // @import that waits for the bundle.
  const preconnects = (input.indexHtml.match(/rel="preconnect"/g) ?? []).length;
  const fontLink = /<link[^>]+rel="stylesheet"[^>]+fonts\.googleapis\.com[^>]*>/.test(input.indexHtml);
  const variableRange = /family=Inter:wght@[^"'&]*\.\.[^"'&]*/.test(input.indexHtml);
  const swap = /display=swap/.test(input.indexHtml);
  const cssImports = [...input.assets.values()].filter((file) => file.path.endsWith('.css')).flatMap((file) => file.text.match(/@import[^;]+;/g) ?? []);
  checks.push({
    id: 'font-chain',
    label: 'font chain',
    measured: `${preconnects} preconnect(s), ${fontLink ? 'stylesheet link' : 'no link'}${variableRange ? ', variable range' : ''}${swap ? ', display=swap' : ''}, ${cssImports.length} css @import(s)`,
    budget: '≥ 2 preconnects, stylesheet link, 0 @import',
    ok: preconnects >= 2 && fontLink && cssImports.length === 0,
    detail: cssImports.length ? `@import found: ${cssImports[0]}` : 'the font starts in parallel with the bundle',
  });

  // Caching: hashed assets are immutable, the shell and the worker are not.
  const assetsRule = /\/assets\/\*[^\n]*\n\s*Cache-Control:\s*([^\n]+)/.exec(input.headers);
  const immutable = Boolean(assetsRule && /max-age=(\d{6,})/.test(assetsRule[1]) && /immutable/.test(assetsRule[1]));
  const htmlNoStore = /\/index\.html[^\n]*\n\s*Cache-Control:[^\n]*no-store/.test(input.headers);
  const swNoStore = /\/sw\.js[^\n]*\n\s*Cache-Control:[^\n]*no-store/.test(input.headers);
  checks.push({
    id: 'asset-cache',
    label: 'asset caching headers',
    measured: `assets ${immutable ? 'immutable' : 'not immutable'}, index.html ${htmlNoStore ? 'no-store' : 'cached'}, sw.js ${swNoStore ? 'no-store' : 'cached'}`,
    budget: '/assets/* immutable; /index.html and /sw.js no-store',
    ok: immutable && htmlNoStore && swNoStore,
    detail: 'filenames are content-hashed, so the bytes can never be stale; a cached shell or worker can be',
  });

  // Every raster image states how it should be loaded.
  const imgs = imgElements(input.sources).filter((img) => !img.srcIsSvgOrData);
  const undecided = imgs.filter((img) => {
    if (img.attributes.includes('loading') || img.attributes.includes('fetchPriority')) return false;
    return !IMG_LOADING_ALLOWLIST.has(img.file);
  });
  checks.push({
    id: 'img-loading',
    label: 'image loading strategy',
    measured: `${undecided.length} of ${imgs.length} raster <img> without loading/fetchPriority`,
    budget: 'every raster <img> declares one, or is on the allowlist with a reason',
    ok: undecided.length === 0,
    detail: undecided.length
      ? `${undecided.slice(0, 3).map((img) => `${img.file}:${img.line}`).join(', ')} — add loading="lazy" below the fold or fetchPriority="high" above it`
      : `${IMG_LOADING_ALLOWLIST.size} eager image(s) allowlisted: ${[...IMG_LOADING_ALLOWLIST.keys()].map((key) => key.split('/').pop()).join(', ')}`,
  });

  return checks;
}

function table(checks: PerfCheck[]): string {
  const width = Math.max(...checks.map((check) => check.label.length));
  return checks
    .map((check) => `${check.ok ? 'ok  ' : 'FAIL'} ${check.label.padEnd(width)}  ${check.measured.padEnd(34)} ${check.budget}${check.detail ? `\n     ↳ ${check.detail}` : ''}`)
    .join('\n');
}

function main(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  if (!existsSync(join(root, 'dist/index.html'))) {
    console.error('PERF-1: no build to measure — run `npm run build` first.');
    process.exit(1);
  }
  const checks = auditPerf(readPerfInput(root));
  console.log(`PERF-1 performance budget — ${checks.filter((check) => check.ok).length}/${checks.length} checks pass\n`);
  console.log(table(checks));
  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error(`\nPERF-1: ${failed.length} budget check(s) failed.`);
    process.exit(1);
  }
  console.log('\nEvery performance budget passes.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
