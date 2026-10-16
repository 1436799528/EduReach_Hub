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
 * Usage:  npm run smoke -- https://edureach.example
 *         EDUREACH_SMOKE_URL=https://edureach.example npm run smoke
 *
 * Exit 0 only on an explicitly `ready` response. A 200 that does not say
 * `ready`, or any network error, is a failure — a smoke check that passes when
 * it cannot tell is not a smoke check.
 */

export interface ReadyVerdict {
  ok: boolean;
  detail: string;
}

export function evaluateReady(status: number, body: unknown): ReadyVerdict {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const state = typeof record.status === 'string' ? record.status : '(no status field)';
  if (status === 200 && state === 'ready') return { ok: true, detail: 'status=ready, http 200' };
  const checks = record.checks && typeof record.checks === 'object'
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
  const base = process.argv[2] || process.env.EDUREACH_SMOKE_URL;
  if (!base) {
    console.error('usage: npm run smoke -- <deployment-url>   (or set EDUREACH_SMOKE_URL)');
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
    console.log(`ok   ${origin}/api/health → http 200`);

    const ready = await fetchJson(`${origin}/api/health/ready`);
    const verdict = evaluateReady(ready.status, ready.body);
    if (!verdict.ok) {
      console.error(`FAIL ${origin}/api/health/ready → ${verdict.detail}`);
      process.exitCode = 1;
      return;
    }
    console.log(`ok   ${origin}/api/health/ready → ${verdict.detail}`);
    console.log('\nSmoke check passed: the deployment is ready.');
  } catch (error) {
    console.error(`FAIL could not reach ${origin}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('smoke-check.ts')) {
  void main();
}
