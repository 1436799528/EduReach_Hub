/**
 * External links: the ones this repository cannot type-check.
 *
 * Every internal link is checked by `links:audit` against the router. External
 * destinations are different: they belong to JAMB, WAEC, MTN, TotalEnergies and
 * several hundred institutions, and they die silently. A scholarship that still
 * shows a deadline while its application page returns 404 is worse than no
 * listing at all — the student does the work and hits a wall.
 *
 * This script resolves the URLs the site actually publishes:
 *
 *   - the reviewed scholarship seed (`src/data/scholarshipSeed.ts`);
 *   - the WhatsApp channel in `src/data/hubContent.ts`;
 *   - when Supabase credentials are present, the live `opportunities.link_url`
 *     and `institutions.website` columns, which is where production reads from.
 *
 * A URL passes on 2xx/3xx. A 401/403/405 from a HEAD request is retried with GET
 * because many government portals refuse HEAD. Anything else is a failure, and
 * the process exits 1 — `.github/workflows/external-links.yml` turns that into
 * an issue rather than a red PR, because link rot is not caused by the author of
 * the pull request that notices it.
 *
 *   npm run links:external
 *   npm run links:external -- --report link-report.md --timeout 20000
 */

import { writeFileSync } from 'node:fs';

import { EDUREACH_WHATSAPP_CHANNEL } from '../src/data/hubContent';
import { SCHOLARSHIP_SEED } from '../src/data/scholarshipSeed';

export interface ExternalTarget {
  url: string;
  /** Where the URL comes from, so a failure can be fixed without guessing. */
  source: string;
}

export type LinkStatus = 'ok' | 'redirect' | 'client-error' | 'server-error' | 'unreachable';

export interface LinkResult extends ExternalTarget {
  status: LinkStatus;
  /** HTTP status where there was one; 0 when the request never completed. */
  code: number;
  detail: string;
  ok: boolean;
}

const PLACEHOLDER_URL = /^https?:\/\/(example\.(com|org|net)|localhost|127\.0\.0\.1)/i;

/** Static, reviewable sources: the ones a deploy cannot change. */
export function staticTargets(): ExternalTarget[] {
  const targets: ExternalTarget[] = [
    { url: EDUREACH_WHATSAPP_CHANNEL, source: 'hubContent.EDUREACH_WHATSAPP_CHANNEL' },
  ];
  for (const scholarship of SCHOLARSHIP_SEED) {
    if (!scholarship.link_url) continue;
    targets.push({ url: scholarship.link_url, source: `scholarshipSeed:${scholarship.slug}` });
  }
  return dedupe(targets);
}

/** One row per URL, keeping the first source that named it. */
export function dedupe(targets: ExternalTarget[]): ExternalTarget[] {
  const seen = new Map<string, ExternalTarget>();
  for (const target of targets) {
    const url = target.url.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (PLACEHOLDER_URL.test(url)) continue;
    const key = normalise(url);
    if (!seen.has(key)) seen.set(key, { ...target, url });
  }
  return [...seen.values()].sort((a, b) => a.url.localeCompare(b.url));
}

/** Two URLs that differ only by trailing slash, fragment or host case are one check. */
export function normalise(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}`;
  } catch {
    return url.trim();
  }
}

export function classifyStatus(code: number): LinkStatus {
  if (code >= 200 && code < 300) return 'ok';
  if (code >= 300 && code < 400) return 'redirect';
  if (code >= 400 && code < 500) return 'client-error';
  if (code >= 500 && code < 600) return 'server-error';
  return 'unreachable';
}

/** A status only counts as a pass when it is one a browser could follow. */
export function isPassing(status: LinkStatus): boolean {
  return status === 'ok' || status === 'redirect';
}

async function probe(url: string, timeoutMs: number): Promise<{ code: number; detail: string }> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'EduReachHub-LinkCheck/1.0 (+https://edureachhub.netlify.app)' },
      });
      // Drain nothing: GET is only used to learn the status.
      if (method === 'GET' && response.body) await response.body.cancel().catch(() => {});
      return { code: response.status, detail: response.statusText || `HTTP ${response.status}` };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const head = await attempt('HEAD');
    if (head.code !== 405 && head.code !== 403 && head.code !== 401) return head;
    return await attempt('GET');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut = /abort/i.test(message);
    return { code: 0, detail: timedOut ? `no response within ${timeoutMs}ms` : message };
  }
}

export async function checkTarget(target: ExternalTarget, timeoutMs: number): Promise<LinkResult> {
  const { code, detail } = await probe(target.url, timeoutMs);
  const status = code === 0 ? 'unreachable' : classifyStatus(code);
  return { ...target, status, code, detail, ok: isPassing(status) };
}

/** Live sources, only when the run has credentials to read them. */
export async function databaseTargets(): Promise<ExternalTarget[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const read = async (table: string, column: string): Promise<ExternalTarget[]> => {
    const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/${table}?select=${column}&${column}=not.is.null&limit=2000`;
    const response = await fetch(endpoint, {
      headers: { apikey: key, authorization: `Bearer ${key}`, accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${response.statusText}`);
    const rows = (await response.json()) as Array<Record<string, unknown>>;
    return rows
      .map((row) => row[column])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((value) => ({ url: value, source: `database:${table}.${column}` }));
  };

  const [opportunities, institutions] = await Promise.all([
    read('opportunities', 'link_url').catch((error: Error) => {
      console.error(`database opportunities not checked: ${error.message}`);
      return [] as ExternalTarget[];
    }),
    read('institutions', 'website').catch((error: Error) => {
      console.error(`database institutions not checked: ${error.message}`);
      return [] as ExternalTarget[];
    }),
  ]);
  return dedupe([...opportunities, ...institutions]);
}

export function renderReport(results: LinkResult[], generatedAt = new Date().toISOString()): string {
  const failures = results.filter((result) => !result.ok);
  const lines = [
    '# External link check',
    '',
    `Run: ${generatedAt}`,
    `Checked ${results.length} URL${results.length === 1 ? '' : 's'}; ${failures.length} failing.`,
    '',
  ];
  if (failures.length > 0) {
    lines.push('## Failing', '', '| URL | Source | Status | Detail |', '|---|---|---|---|');
    for (const failure of failures) {
      lines.push(
        `| ${failure.url} | \`${failure.source}\` | ${failure.code || '—'} ${failure.status} | ${failure.detail} |`,
      );
    }
    lines.push('');
  }
  lines.push('## All results', '', '| URL | Status | Source |', '|---|---|---|');
  for (const result of results) {
    lines.push(`| ${result.url} | ${result.ok ? '✅' : '❌'} ${result.code || result.status} | \`${result.source}\` |`);
  }
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback: string): string => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
  };
  const timeoutMs = Number(flag('--timeout', '15000'));
  const reportPath = flag('--report', '');
  const concurrency = Math.max(1, Number(flag('--concurrency', '4')));

  const targets = dedupe([...staticTargets(), ...(await databaseTargets())]);
  if (targets.length === 0) {
    console.error('FAIL no external URLs found to check');
    process.exitCode = 1;
    return;
  }

  const results: LinkResult[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      const result = await checkTarget(target, timeoutMs);
      results.push(result);
      console.log(
        `${result.ok ? 'ok  ' : 'FAIL'} ${String(result.code || '—').padEnd(4)} ${result.url}  (${result.source})`,
      );
    }
  });
  await Promise.all(workers);

  results.sort((a, b) => a.url.localeCompare(b.url));
  const failures = results.filter((result) => !result.ok);
  const report = renderReport(results);
  if (reportPath) {
    writeFileSync(reportPath, report);
    console.log(`\nreport written to ${reportPath}`);
  }

  console.log(`\n${results.length - failures.length}/${results.length} external links resolve`);
  if (failures.length > 0) {
    console.error(`${failures.length} dead external link${failures.length === 1 ? '' : 's'}:`);
    for (const failure of failures)
      console.error(`  ${failure.url} — ${failure.code || failure.status} (${failure.source})`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('external-link-check.ts')) {
  void main();
}
