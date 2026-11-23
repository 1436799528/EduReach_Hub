/**
 * Lighthouse, against a real deployment.
 *
 * The repository already enforces performance in two ways that run on every
 * pull request: a byte budget per route (`scripts/perf-audit.ts`) and
 * LCP/CLS/TBT budgets on a throttled mobile profile (`tests/e2e/perf.spec.ts`).
 * Neither is Lighthouse, and neither covers what Lighthouse covers: SEO
 * audits, best-practice audits, and a score a person can compare over time.
 *
 * This runs against a URL, not a fixture, so it belongs to a schedule rather
 * than the pull-request gate — a red gate because a CDN was slow for one minute
 * trains people to ignore the gate. Failures here are recorded: the workflow
 * keeps the HTML and JSON report and fails the run.
 *
 *   npm run lighthouse -- https://edureachhub.netlify.app
 *   npm run lighthouse -- <url> --report-only
 *
 * Thresholds are deliberately below "perfect": the point is to catch a
 * regression, not to chase a number. Raise them when the site earns it.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(root, '.lighthouse');

const THRESHOLDS = {
  performance: 0.8,
  accessibility: 0.95,
  'best-practices': 0.9,
  seo: 0.9,
};

const args = process.argv.slice(2);
const url = args.find((arg) => /^https?:\/\//.test(arg)) || process.env.LIGHTHOUSE_URL || '';
const reportOnly = args.includes('--report-only');

if (!url) {
  console.error('usage: npm run lighthouse -- <https://deployment> [--report-only]');
  process.exit(2);
}

/** Playwright's Chromium is already installed in CI; reuse it instead of a second download. */
async function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    const { chromium } = await import('@playwright/test');
    return chromium.executablePath();
  } catch {
    return undefined;
  }
}

const [{ default: lighthouse }, { launch }] = await Promise.all([import('lighthouse'), import('chrome-launcher')]);

const chrome = await launch({
  chromePath: await chromePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

let exitCode = 0;
try {
  const result = await lighthouse(url, {
    port: chrome.port,
    output: ['html', 'json'],
    logLevel: 'error',
    onlyCategories: Object.keys(THRESHOLDS),
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 360, height: 800, deviceScaleFactor: 2, disabled: false },
    throttlingMethod: 'simulate',
  });

  if (!result) throw new Error('Lighthouse returned no result');

  mkdirSync(OUT_DIR, { recursive: true });
  const reports = Array.isArray(result.report) ? result.report : [result.report];
  writeFileSync(join(OUT_DIR, 'report.html'), String(reports[0]));
  writeFileSync(join(OUT_DIR, 'report.json'), String(reports[1]));

  const scores = result.lhr.categories;
  const rows = Object.entries(THRESHOLDS).map(([key, floor]) => {
    const score = scores[key]?.score ?? 0;
    const passing = score >= floor;
    if (!passing && !reportOnly) exitCode = 1;
    return {
      category: key,
      score: Math.round(score * 100),
      floor: Math.round(floor * 100),
      verdict: passing ? 'pass' : reportOnly ? 'below floor (report only)' : 'FAIL',
    };
  });

  console.log(`\nLighthouse — ${url}\n`);
  for (const row of rows) {
    console.log(
      `  ${row.verdict.padEnd(26)} ${row.category.padEnd(16)} ${String(row.score).padStart(3)} / 100  (floor ${row.floor})`,
    );
  }

  const vitals = result.lhr.audits;
  for (const id of [
    'largest-contentful-paint',
    'cumulative-layout-shift',
    'total-blocking-time',
    'first-contentful-paint',
  ]) {
    const audit = vitals[id];
    if (audit) console.log(`  ${id.padEnd(42)} ${audit.displayValue ?? String(audit.numericValue)}`);
  }
  console.log(`\nreports: .lighthouse/report.html, .lighthouse/report.json`);

  writeFileSync(
    join(OUT_DIR, 'summary.json'),
    JSON.stringify({ url, generatedAt: new Date().toISOString(), thresholds: THRESHOLDS, rows }, null, 2),
  );
} finally {
  await chrome.kill();
}

process.exit(exitCode);
