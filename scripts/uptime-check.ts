/**
 * MONT-3 - an uptime probe that any scheduler can run.
 *
 * External uptime monitoring is a provider, not a script, but a probe with an
 * exit code is what makes the provider's configuration reviewable and what makes
 * the interim check (`.github/workflows/uptime.yml`) possible without a second
 * account. It measures the two endpoints as the guide defines them:
 *
 *  - `/api/health`        liveness. A non-200, a timeout or a missing body fails
 *                         the run - this is the "is the site down" signal.
 *  - `/api/health/ready`  readiness. Reported always; it fails the run only when
 *                         `--strict-readiness` (or `UPTIME_READINESS_STRICT=1`)
 *                         is set, because the deployed project currently answers
 *                         503 for a known, documented reason (the CBT protocol
 *                         column is not applied in production). Alerting on that
 *                         today would be a permanent false alarm, and silencing
 *                         the check instead would defeat it.
 *
 * Usage:
 *   tsx scripts/uptime-check.ts                       # human summary
 *   tsx scripts/uptime-check.ts --json                # machine summary
 *   tsx scripts/uptime-check.ts --strict-readiness    # readiness failure exits 1
 *   PROBE_BASE_URL=https://… tsx scripts/uptime-check.ts
 *
 * Exit codes: 0 healthy (or readiness-only failure without --strict), 1 the
 * liveness probe failed (or readiness with --strict), 2 the probe could not run.
 */

const DEFAULT_BASE = 'https://edureachhub.netlify.app';
const TIMEOUT_MS = Number(process.env.UPTIME_TIMEOUT_MS || 15_000);

interface ProbeResult {
  name: string;
  url: string;
  ok: boolean;
  status: number | null;
  duration_ms: number | null;
  detail: string;
}

async function probe(name: string, url: string, expect: (status: number, body: unknown) => string | null) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    const failure = expect(response.status, body);
    const result: ProbeResult = {
      name,
      url,
      ok: failure === null,
      status: response.status,
      duration_ms: Date.now() - started,
      detail: failure ?? 'ok',
    };
    return result;
  } catch (error) {
    const result: ProbeResult = {
      name,
      url,
      ok: false,
      status: null,
      duration_ms: Date.now() - started,
      // Never the error message: a fetch error can quote the URL, and this
      // output is written into a build summary a third party can be linked to.
      detail: error instanceof Error && error.name === 'AbortError' ? `timed out after ${TIMEOUT_MS}ms` : 'unreachable',
    };
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<number> {
  const base = (process.env.PROBE_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  const strict = process.argv.includes('--strict-readiness') || process.env.UPTIME_READINESS_STRICT === '1';
  const json = process.argv.includes('--json');

  // Production must be https. Loopback is allowed so the probe can be tested
  // (and run) against a local server without weakening the real check.
  const isLoopback = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base);
  if (!/^https:\/\//.test(base) && !isLoopback) {
    process.stderr.write('PROBE_BASE_URL must be an https origin (http is allowed for loopback only)\n');
    return 2;
  }

  const liveness = await probe('liveness', `${base}/api/health`, (status, body) => {
    if (status !== 200) return `expected 200, got ${status}`;
    const status_ = (body as { status?: unknown } | null)?.status;
    if (status_ !== 'ok') return 'response did not carry status:ok';
    return null;
  });

  const readiness = await probe('readiness', `${base}/api/health/ready`, (status, body) => {
    const failing = (body as { checks?: Record<string, { ok?: boolean }> } | null)?.checks;
    const names = failing
      ? Object.entries(failing)
          .filter(([, check]) => check?.ok === false)
          .map(([name]) => name)
      : [];
    if (status === 200) return null;
    return `status ${status}${names.length ? ` (failing: ${names.join(', ')})` : ''}`;
  });

  const failure = !liveness.ok || (strict && !readiness.ok);
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ base, strict, at: new Date().toISOString(), probes: [liveness, readiness], ok: !failure }, null, 2)}\n`,
    );
  } else {
    for (const result of [liveness, readiness]) {
      process.stdout.write(
        `${result.ok ? 'ok  ' : 'FAIL'} ${result.name.padEnd(9)} ${String(result.status ?? '-').padStart(3)} ${String(
          result.duration_ms ?? '-',
        ).padStart(6)}ms  ${result.detail}\n`,
      );
    }
    if (!readiness.ok && !strict) {
      process.stdout.write('note: readiness failure is reported but not fatal here (KNOWN-1 CBT schema blocker)\n');
    }
  }
  return failure ? 1 : 0;
}

process.exitCode = await main();
