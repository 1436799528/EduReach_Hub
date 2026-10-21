#!/usr/bin/env node
/**
 * Capacity probe — a dependency-free load generator for the EduReach HTTP layer.
 *
 * Why this exists in addition to the k6 plan in `scripts/load/k6/`:
 * the k6 binary cannot be downloaded inside every environment that builds this
 * repository (release assets are not always reachable from the build network),
 * while Node 22 is already a hard requirement. This probe therefore uses only
 * `node:http`, so the baseline in
 * `docs/audit/PRODUCTION-SCALE-AUDIT-2026-10.md` can be reproduced by anyone
 * with the repository and no extra tooling.
 *
 * It is a probe, not a load-testing framework. It keeps one keep-alive socket
 * pool per run, records wall-clock latency per request, and reports exact
 * percentiles. It cannot drive more concurrency than one Node process on the
 * test machine can generate, so every number it prints is a statement about
 * the *pair* of machines involved. The report says so; do not quote its output
 * as the capacity of the product.
 *
 * Safety rail: a non-loopback target is refused unless `--allow-remote` is
 * passed. The audit brief forbids uncontrolled tests against the live site, and
 * a default that cannot be tripped by a typo is worth more than a comment.
 *
 *   node scripts/load/load-probe.mjs --base-url http://127.0.0.1:3200 --vus 25 --duration 20
 *
 * Exit code 0 only when every threshold passed. A breached threshold, a
 * network error or a refused target all exit non-zero, so the probe can gate a
 * staging deploy in CI.
 */

import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

const WEIGHTS = {
  // Public read mix, shaped from the request pattern of the pages themselves:
  // the shell and its hashed entry chunk dominate; the JSON endpoints that the
  // setup wizard and the hub call follow; the health probe is what a monitor
  // would add.
  public: [
    { path: '/', weight: 28, label: 'home shell' },
    { path: '@asset', weight: 22, label: 'entry chunk' },
    { path: '/api/cbt/exams', weight: 16, label: 'CBT catalogue' },
    { path: '/api/news', weight: 12, label: 'news feed' },
    { path: '/api/opportunities', weight: 12, label: 'opportunities' },
    { path: '/api/services', weight: 6, label: 'service catalogue' },
    { path: '/api/health', weight: 4, label: 'liveness' },
  ],
  // One endpoint at a time, for isolating a single route's ceiling.
  api: [{ path: '/api/cbt/exams', weight: 1, label: 'CBT catalogue' }],
};

function parseArgs(argv) {
  const defaults = {
    baseUrl: 'http://127.0.0.1:3200',
    scenario: 'public',
    vus: 25,
    duration: 20,
    thinkTimeMs: 2000,
    p95: 800,
    p99: 1500,
    maxErrorRate: 0.01,
    allowRemote: false,
    json: false,
  };
  const args = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`Missing value for ${token}`);
      index += 1;
      return value;
    };
    switch (token) {
      case '--base-url': args.baseUrl = next(); break;
      case '--scenario': args.scenario = next(); break;
      case '--vus': args.vus = Number(next()); break;
      case '--duration': args.duration = Number(next()); break;
      case '--think-time-ms': args.thinkTimeMs = Number(next()); break;
      case '--p95': args.p95 = Number(next()); break;
      case '--p99': args.p99 = Number(next()); break;
      case '--max-error-rate': args.maxErrorRate = Number(next()); break;
      case '--allow-remote': args.allowRemote = true; break;
      case '--json': args.json = true; break;
      case '--help': args.help = true; break;
      default: throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (!WEIGHTS[args.scenario]) throw new Error(`Unknown scenario "${args.scenario}". Use one of: ${Object.keys(WEIGHTS).join(', ')}.`);
  if (!Number.isFinite(args.vus) || args.vus < 1) throw new Error('--vus must be a positive integer.');
  if (!Number.isFinite(args.duration) || args.duration < 1) throw new Error('--duration must be at least 1 second.');
  if (!Number.isFinite(args.thinkTimeMs) || args.thinkTimeMs < 0) throw new Error('--think-time-ms must be zero or more.');
  return args;
}

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || /^127\./.test(hostname);
}

/** Pick the first hashed entry chunk out of the built shell. */
async function discoverAsset(baseUrl, client) {
  const body = await client.get(baseUrl + '/', { text: true });
  const match = /\/assets\/[A-Za-z0-9._-]+\.js/.exec(body.text || '');
  return match ? match[0] : null;
}

function makeClient(baseUrl, sockets) {
  const url = new URL(baseUrl);
  const transport = url.protocol === 'https:' ? https : http;
  const agent = new transport.Agent({ keepAlive: true, maxSockets: sockets });
  const origin = url.origin;

  return {
    get(path, options = {}) {
      const target = path.startsWith('http') ? path : origin + path;
      return new Promise((resolve, reject) => {
        const started = performance.now();
        const request = transport.get(target, {
          agent,
          headers: { accept: '*/*', 'accept-encoding': 'identity', 'user-agent': 'edureach-load-probe' },
        }, (response) => {
          let length = 0;
          const chunks = [];
          response.on('data', (chunk) => {
            length += chunk.length;
            if (options.text && chunks.length < 200) chunks.push(chunk);
          });
          response.on('end', () => resolve({
            status: response.statusCode || 0,
            ms: performance.now() - started,
            bytes: length,
            text: options.text ? Buffer.concat(chunks).toString('utf8') : undefined,
          }));
          response.on('error', reject);
        });
        request.setTimeout(30_000, () => request.destroy(new Error('client timeout after 30000 ms')));
        request.on('error', reject);
      });
    },
    close() { agent.destroy(); },
  };
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pick(plan) {
  const total = plan.reduce((sum, step) => sum + step.weight, 0);
  let ticket = Math.random() * total;
  for (const step of plan) {
    ticket -= step.weight;
    if (ticket <= 0) return step;
  }
  return plan[plan.length - 1];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/load/load-probe.mjs [--base-url URL] [--scenario public|api] [--vus N] [--duration S] [--think-time-ms N]');
    console.log('       [--p95 MS] [--p99 MS] [--max-error-rate 0..1] [--allow-remote] [--json]');
    return 0;
  }

  const url = new URL(args.baseUrl);
  if (!isLoopback(url.hostname) && !args.allowRemote) {
    console.error(`Refusing to load-test ${url.hostname}: only loopback targets are allowed without --allow-remote.`);
    console.error('The audit brief forbids uncontrolled tests against the production site; point this at a staging host you own and approve first.');
    return 2;
  }

  const client = makeClient(args.baseUrl, args.vus);
  const scenario = WEIGHTS[args.scenario];

  let assetPath = null;
  if (scenario.some((step) => step.path === '@asset')) {
    assetPath = await discoverAsset(args.baseUrl, client);
    if (!assetPath) {
      console.error('Could not find a hashed entry chunk in the shell — is this a production build (dist/ present)?');
      client.close();
      return 2;
    }
  }

  const plan = scenario.map((step) => ({ ...step, path: step.path === '@asset' ? assetPath : step.path }));
  const statuses = new Map();
  const latencies = [];
  const perStep = new Map(plan.map((step) => [step.path, { count: 0, ms: [], errors: 0 }]));
  let requests = 0;
  let errors = 0;
  let bytes = 0;

  const deadline = performance.now() + args.duration * 1000;
  const startedAt = performance.now();

  // A virtual user is one browser tab that requests one URL and then reads the
  // page before the next one. Without the pause the probe measures the
  // generator's appetite, not a student's session, and every published
  // "users supported" figure becomes a fiction. Jitter keeps the workers from
  // marching in lockstep and creating a synthetic burst every cycle.
  const pause = () => new Promise((resolve) => {
    const jitter = (Math.random() * 0.6) - 0.3;
    setTimeout(resolve, Math.max(0, args.thinkTimeMs * (1 + jitter)));
  });

  const worker = async () => {
    while (performance.now() < deadline) {
      const step = pick(plan);
      try {
        const result = await client.get(step.path);
        requests += 1;
        bytes += result.bytes;
        latencies.push(result.ms);
        statuses.set(result.status, (statuses.get(result.status) || 0) + 1);
        const bucket = perStep.get(step.path);
        bucket.count += 1;
        bucket.ms.push(result.ms);
        // 4xx other than 429 is a client-shape error, not a capacity error,
        // but it still means the endpoint did not serve the request.
        if (result.status >= 500 || result.status === 429) {
          errors += 1;
          bucket.errors += 1;
        }
      } catch (error) {
        requests += 1;
        errors += 1;
        const bucket = perStep.get(step.path);
        bucket.count += 1;
        bucket.errors += 1;
        statuses.set('network', (statuses.get('network') || 0) + 1);
      }
      if (performance.now() < deadline) await pause();
    }
  };

  await Promise.all(Array.from({ length: args.vus }, worker));
  const elapsed = (performance.now() - startedAt) / 1000;
  client.close();

  latencies.sort((a, b) => a - b);
  const summary = {
    target: args.baseUrl,
    scenario: args.scenario,
    vus: args.vus,
    think_time_ms: args.thinkTimeMs,
    duration_s: round(elapsed, 1),
    requests,
    requests_per_second: round(requests / elapsed, 1),
    error_rate: requests ? round(errors / requests, 4) : 1,
    latency_ms: {
      p50: round(percentile(latencies, 0.5)),
      p95: round(percentile(latencies, 0.95)),
      p99: round(percentile(latencies, 0.99)),
      max: round(latencies[latencies.length - 1] || 0),
    },
    statuses: Object.fromEntries([...statuses.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))),
    payload_mb: round(bytes / 1024 / 1024, 2),
    per_step: Object.fromEntries([...perStep.entries()].map(([path, bucket]) => [path, {
      requests: bucket.count,
      errors: bucket.errors,
      p95_ms: round(percentile(bucket.ms.sort((a, b) => a - b), 0.95)),
    }])),
    thresholds: { p95: args.p95, p99: args.p99, max_error_rate: args.maxErrorRate },
  };
  summary.verdict = {
    p95: summary.latency_ms.p95 <= args.p95 ? 'pass' : 'fail',
    p99: summary.latency_ms.p99 <= args.p99 ? 'pass' : 'fail',
    error_rate: summary.error_rate <= args.maxErrorRate ? 'pass' : 'fail',
  };
  summary.passed = Object.values(summary.verdict).every((value) => value === 'pass');

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`target      ${summary.target}`);
    console.log(`scenario    ${summary.scenario}   vus ${summary.vus}   think ${summary.think_time_ms} ms   ${summary.duration_s}s`);
    console.log(`requests    ${summary.requests}   ${summary.requests_per_second}/s   ${summary.payload_mb} MB`);
    console.log(`latency     p50 ${summary.latency_ms.p50} ms   p95 ${summary.latency_ms.p95} ms   p99 ${summary.latency_ms.p99} ms   max ${summary.latency_ms.max} ms`);
    console.log(`errors      ${(summary.error_rate * 100).toFixed(2)}%   ${JSON.stringify(summary.statuses)}`);
    for (const [path, bucket] of Object.entries(summary.per_step)) {
      console.log(`  ${path.padEnd(24)} ${String(bucket.requests).padStart(7)} req  ${String(bucket.errors).padStart(6)} err  p95 ${bucket.p95_ms} ms`);
    }
    const verdict = Object.entries(summary.verdict).map(([key, value]) => `${key}=${value}`).join('  ');
    console.log(`thresholds  ${verdict}   -> ${summary.passed ? 'PASS' : 'FAIL'}`);
  }

  return summary.passed ? 0 : 1;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
