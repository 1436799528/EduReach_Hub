/**
 * k6 — public read mix.
 *
 * This is the harness for levels 1–3 of the capacity ladder (25 / 100 / 250
 * virtual users). It is deliberately separate from `scripts/load/load-probe.mjs`,
 * which needs no tooling and is what produced the committed baseline.
 *
 * NOT EXECUTED IN THIS REPOSITORY'S BUILD ENVIRONMENT: the k6 binary is not
 * installable there (release assets are outside the allowed network). Every run
 * must start with a 1-VU smoke (`--vus 1 --duration 30s`) to prove the script
 * itself works before anyone trusts a number it prints.
 *
 *   k6 run --env BASE_URL=https://staging.example --env VUS=25 scripts/load/k6/public-read.js
 *   k6 run --env BASE_URL=http://127.0.0.1:3200 --env VUS=100 --env HOLD=5m scripts/load/k6/public-read.js
 *
 * Thresholds are provisional and are declared before the run, not chosen after
 * it. A non-loopback BASE_URL is refused unless ALLOW_REMOTE=1 is set, because
 * an accidental run against the live site is exactly what the brief forbids.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:3200').replace(/\/$/, '');
const VUS = Number(__ENV.VUS || 25);
const RAMP = __ENV.RAMP || '1m';
const HOLD = __ENV.HOLD || '3m';
const THINK = Number(__ENV.THINK || 2);
const P95_MS = Number(__ENV.P95_MS || 800);
const P99_MS = Number(__ENV.P99_MS || 1500);
const MAX_ERROR_RATE = Number(__ENV.MAX_ERROR_RATE || 0.01);

if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE_URL) && __ENV.ALLOW_REMOTE !== '1') {
  throw new Error(`Refusing to run against ${BASE_URL}. Point BASE_URL at staging and set ALLOW_REMOTE=1 to confirm.`);
}

export const options = {
  scenarios: {
    public_read: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP, target: VUS },
        { duration: HOLD, target: VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: [`rate<${MAX_ERROR_RATE}`],
    http_req_duration: [`p(95)<${P95_MS}`, `p(99)<${P99_MS}`],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const shell = new Trend('shell_duration');
const api = new Trend('api_duration');
const throttled = new Rate('rate_limited');

export function setup() {
  const response = http.get(`${BASE_URL}/`);
  check(response, { 'shell responds 200': (res) => res.status === 200 });
  const match = /\/assets\/[A-Za-z0-9._-]+\.js/.exec(response.body || '');
  if (!match) throw new Error('No hashed entry chunk in the shell — is this a production build?');
  return { asset: match[0] };
}

const MIX = [
  { path: '/', weight: 28, kind: 'shell' },
  { path: '@asset', weight: 22, kind: 'shell' },
  { path: '/api/cbt/exams', weight: 16, kind: 'api' },
  { path: '/api/news', weight: 12, kind: 'api' },
  { path: '/api/opportunities', weight: 12, kind: 'api' },
  { path: '/api/services', weight: 6, kind: 'api' },
  { path: '/api/health', weight: 4, kind: 'api' },
];

function pick() {
  const total = MIX.reduce((sum, item) => sum + item.weight, 0);
  let ticket = Math.random() * total;
  for (const item of MIX) {
    ticket -= item.weight;
    if (ticket <= 0) return item;
  }
  return MIX[MIX.length - 1];
}

export default function (data) {
  const step = pick();
  const path = step.path === '@asset' ? data.asset : step.path;
  const response = http.get(`${BASE_URL}${path}`, {
    tags: { route: path, kind: step.kind },
    headers: { 'accept-encoding': 'identity' },
  });

  if (step.kind === 'shell') shell.add(response.timings.duration);
  else api.add(response.timings.duration);
  throttled.add(response.status === 429);

  check(response, {
    'status is 200': (res) => res.status === 200,
    'not throttled': (res) => res.status !== 429,
  });

  // One URL per pause. Without it the generator measures its own appetite and
  // every "users supported" figure becomes fiction.
  sleep(THINK * (0.7 + Math.random() * 0.6));
}
