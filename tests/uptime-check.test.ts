import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * The interim uptime probe is the one thing between a deployed outage and nobody
 * noticing, so its exit code is the contract: 0 means "a maintainer can go back
 * to sleep", 1 means "page someone?", 2 means "the probe itself is broken".
 * A probe that always exits 0 is worse than no probe.
 */

const root = join(import.meta.dirname, '..');
const loader = join(root, 'node_modules', 'tsx', 'dist', 'loader.mjs');
const script = join(root, 'scripts', 'uptime-check.ts');

const BASE_ENV = { PATH: process.env.PATH, HOME: process.env.HOME };

/** Run the probe against a throwaway server that answers with fixed statuses. */
async function probeServer(
  statuses: { liveness: number; ready: number },
  args: string[] = [],
  env: Record<string, string> = {},
) {
  const server = createServer((req, res) => {
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url === '/api/health') {
      return json(statuses.liveness, { status: statuses.liveness === 200 ? 'ok' : 'down', service: 'edureach' });
    }
    return json(
      statuses.ready,
      statuses.ready === 200
        ? { status: 'ready', checks: { database: { ok: true } } }
        : { status: 'degraded', checks: { cbt_protocol_schema: { ok: false } } },
    );
  });
  server.keepAliveTimeout = 1;
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no test port');
  try {
    // Asynchronous on purpose: `spawnSync` blocks this process's event loop, and
    // the stub server lives here, so a synchronous spawn would starve the very
    // server the probe is calling.
    return await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(process.execPath, ['--import', `file://${loader}`, script, ...args], {
        cwd: root,
        env: { ...BASE_ENV, PROBE_BASE_URL: `http://127.0.0.1:${address.port}`, ...env },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
      const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ status: code, stdout, stderr });
      });
    });
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

test('a healthy deployment exits 0 and reports both probes', async () => {
  const result = await probeServer({ liveness: 200, ready: 200 }, ['--json']);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.deepEqual(
    summary.probes.map((probe: { name: string; ok: boolean }) => [probe.name, probe.ok]),
    [
      ['liveness', true],
      ['readiness', true],
    ],
  );
});

test('a failed liveness probe exits 1', async () => {
  const result = await probeServer({ liveness: 503, ready: 503 });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL liveness/);
});

test('a readiness failure is reported but not fatal until strict mode is on', async () => {
  const lenient = await probeServer({ liveness: 200, ready: 503 });
  assert.equal(lenient.status, 0, 'the documented KNOWN-1 blocker must not page every 15 minutes');
  assert.match(lenient.stdout, /FAIL readiness/);
  assert.match(lenient.stdout, /KNOWN-1/);
  assert.match(lenient.stdout, /cbt_protocol_schema/, 'the failing check is named');

  const strict = await probeServer({ liveness: 200, ready: 503 }, [], { UPTIME_READINESS_STRICT: '1' });
  assert.equal(strict.status, 1);
});

test('a non-https, non-loopback target is refused rather than silently probed', () => {
  const result = spawnSync(process.execPath, ['--import', `file://${loader}`, script], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...BASE_ENV, PROBE_BASE_URL: 'http://edureachhub.netlify.app' },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /https origin/);
});
