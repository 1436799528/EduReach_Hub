/**
 * P2-1 — post-deploy smoke check.
 *
 * The last line of defence against a build that was made without the client
 * contract (or against a deployment whose server key is wrong): ask the running
 * site whether it is actually ready. `GET /api/health/ready` returns 200
 * `{status:"ready"}` only when the server is up, the Supabase variables are
 * present and a real database read succeeds; otherwise 503 `{status:"degraded"}`
 * naming the cause.
 *
 * `--pages` extends the check from "the server is ready" to "the pages actually
 * work". Readiness was green on 2026-11-23 while the FAQ and Reviews sections
 * were serving an error, because those tables had never been migrated: the
 * process was healthy and the pages were not. Each page in the manifest is
 * fetched, and every endpoint it reads is required to answer 200 with JSON.
 *
 * Usage:  npm run smoke -- https://edureach.example
 *         npm run smoke -- https://edureach.example --pages
 *         EDUREACH_SMOKE_URL=https://edureach.example npm run smoke -- --pages
 *
 * Exit 0 only on an explicitly `ready` response and, with `--pages`, only when
 * every probed page and endpoint answered. A smoke check that passes when it
 * cannot tell is not a smoke check.
 */

// `.env` is loaded here as well as in the server: an operator who follows
// `.env.production.example` and writes the values into `.env` must see them
// used by the validator, not a misleading "NOT SET". No value is ever printed.
import 'dotenv/config';
import { PAGE_MANIFEST, pagesWithEndpoints, type PageManifestEntry } from '../src/app/pageManifest';

export interface ReadyVerdict {
  ok: boolean;
  detail: string;
}

export function evaluateReady(status: number, body: unknown): ReadyVerdict {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const state = typeof record.status === 'string' ? record.status : '(no status field)';
  if (status === 200 && state === 'ready') return { ok: true, detail: 'status=ready, http 200' };
  const checks =
    record.checks && typeof record.checks === 'object'
      ? Object.entries(record.checks as Record<string, { ok?: boolean; detail?: string }>)
          .filter(([, value]) => value && value.ok === false)
          .map(([key, value]) => `${key}${value?.detail ? ` (${value.detail})` : ''}`)
          .join('; ')
      : '';
  return {
    ok: false,
    detail: `http ${status}, status=${state}${checks ? `; failing: ${checks}` : ''}`,
  };
}

export interface Probe {
  /** `page /faq` or `api /api/faqs`. */
  target: string;
  ok: boolean;
  detail: string;
}

/**
 * A page passed when it answered 200 with the application shell. The shell is
 * identified by the mount point rather than by a `<title>`, because a rendered
 * error page and a working page share the title.
 */
export function evaluatePage(
  status: number,
  contentType: string | null,
  body: string,
): { ok: boolean; detail: string } {
  if (status !== 200) return { ok: false, detail: `http ${status}` };
  if (!contentType || !contentType.includes('text/html')) {
    return { ok: false, detail: `expected an html page, got ${contentType || 'no content-type'}` };
  }
  if (!body.includes('id="root"')) return { ok: false, detail: 'the response is not the application shell' };
  return { ok: true, detail: 'http 200, application shell' };
}

/**
 * An endpoint passed when it answered 200 with parseable JSON. Row counts are
 * reported but not required: an honest empty list is a correct answer, a 503 is
 * not — and a 503 is exactly what the missing tables produced.
 */
export function evaluateEndpoint(status: number, body: unknown): { ok: boolean; detail: string } {
  if (status !== 200) return { ok: false, detail: `http ${status}` };
  if (typeof body === 'string') return { ok: false, detail: 'the response was not JSON' };
  const rows = Array.isArray(body) ? body.length : null;
  return { ok: true, detail: rows === null ? 'http 200, json' : `http 200, ${rows} row${rows === 1 ? '' : 's'}` };
}

type Fetcher = (url: string) => Promise<{ status: number; contentType: string | null; body: string }>;

const defaultFetcher: Fetcher = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      body: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
};

/** Probe one page and every endpoint it reads. */
export async function probeEntry(
  origin: string,
  entry: PageManifestEntry,
  fetcher: Fetcher = defaultFetcher,
): Promise<Probe[]> {
  const probes: Probe[] = [];
  const page = await fetcher(`${origin}${entry.path}`);
  const pageVerdict = evaluatePage(page.status, page.contentType, page.body);
  probes.push({ target: `page ${entry.path}`, ok: pageVerdict.ok, detail: pageVerdict.detail });

  for (const endpoint of entry.api ?? []) {
    const response = await fetcher(`${origin}${endpoint}`);
    let body: unknown = response.body;
    try {
      body = JSON.parse(response.body);
    } catch {
      // Left as text: evaluateEndpoint reports it as "not JSON".
    }
    const verdict = evaluateEndpoint(response.status, body);
    probes.push({ target: `api  ${endpoint} (${entry.path})`, ok: verdict.ok, detail: verdict.detail });
  }

  return probes;
}

/** Probe every page that declares a backing endpoint. */
export async function probeAll(origin: string, fetcher: Fetcher = defaultFetcher): Promise<Probe[]> {
  const probes: Probe[] = [];
  const probedEndpoints = new Set<string>();

  for (const entry of pagesWithEndpoints()) {
    const page = await fetcher(`${origin}${entry.path}`);
    const verdict = evaluatePage(page.status, page.contentType, page.body);
    probes.push({ target: `page ${entry.path}`, ok: verdict.ok, detail: verdict.detail });

    // Several pages read the same endpoint (`/api/opportunities` backs both
    // scholarships and jobs). Asking once is enough: the crawl reports the
    // endpoint, not the pair.
    for (const endpoint of entry.api ?? []) {
      if (probedEndpoints.has(endpoint)) continue;
      probedEndpoints.add(endpoint);
      const response = await fetcher(`${origin}${endpoint}`);
      let body: unknown = response.body;
      try {
        body = JSON.parse(response.body);
      } catch {
        // Left as text: evaluateEndpoint reports it as "not JSON".
      }
      const endpointVerdict = evaluateEndpoint(response.status, body);
      probes.push({ target: `api  ${endpoint}`, ok: endpointVerdict.ok, detail: endpointVerdict.detail });
    }
  }

  return probes;
}

async function fetchJson(url: string, timeoutMs = 10_000): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // A non-JSON body is reported as-is in the failure detail.
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const withPages = args.includes('--pages');
  const base = args.find((arg) => !arg.startsWith('--')) || process.env.EDUREACH_SMOKE_URL;
  if (!base) {
    console.error('usage: npm run smoke -- <deployment-url> [--pages]   (or set EDUREACH_SMOKE_URL)');
    process.exitCode = 2;
    return;
  }

  let origin: string;
  try {
    origin = new URL(base).origin;
  } catch {
    console.error(`FAIL "${base}" is not a valid URL.`);
    process.exitCode = 2;
    return;
  }

  try {
    const health = await fetchJson(`${origin}/api/health`);
    if (health.status !== 200) {
      console.error(`FAIL ${origin}/api/health → http ${health.status}`);
      process.exitCode = 1;
      return;
    }
    console.log(`ok      ${origin}/api/health → http 200`);

    const ready = await fetchJson(`${origin}/api/health/ready`);
    const verdict = evaluateReady(ready.status, ready.body);
    if (!verdict.ok) {
      console.error(`FAIL    ${origin}/api/health/ready → ${verdict.detail}`);
      process.exitCode = 1;
      return;
    }
    console.log(`ok      ${origin}/api/health/ready → ${verdict.detail}`);

    if (withPages) {
      console.log(
        `\nPages (${pagesWithEndpoints().length} with a backing endpoint, of ${PAGE_MANIFEST.length} declared)\n`,
      );
      const probes = await probeAll(origin);
      for (const probe of probes) {
        console.log(`${probe.ok ? 'ok  ' : 'FAIL'}    ${probe.target} → ${probe.detail}`);
      }
      const failures = probes.filter((probe) => !probe.ok);
      if (failures.length > 0) {
        console.error(`\nSmoke check failed: ${failures.length} of ${probes.length} probes did not answer.`);
        process.exitCode = 1;
        return;
      }
      console.log(`\nSmoke check passed: ${probes.length} page and endpoint probes answered.`);
      return;
    }

    console.log('\nSmoke check passed: the deployment is ready.');
  } catch (error) {
    console.error(`FAIL could not reach ${origin}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('smoke-check.ts')) {
  void main();
}
