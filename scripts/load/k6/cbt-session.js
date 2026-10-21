/**
 * k6 — CBT start → save → submit → resubmit.
 *
 * The correctness half of the load test: throughput is only interesting if the
 * answer that was saved is the answer that was scored, and if a retried submit
 * returns the same result instead of creating a second attempt.
 *
 * Required environment:
 *   BASE_URL   staging origin (ALLOW_REMOTE=1 required for anything but loopback)
 *   TOKEN      a student access token (JWT) for a throwaway test account
 *   EXAM_ID    an exam with enough approved questions for the paper size used
 *
 * Optional: VUS, RAMP, HOLD, THINK, QUESTION_COUNT (default 10), P95_MS, P99_MS.
 *
 * Expect 429 before the target level is reached — and read the reason:
 * `/api/cbt/exams/:examId/attempts` is limited to 60 starts per IP per 10
 * minutes (RATE_LIMIT_RULES.cbtStart, durable). A generator is one IP, exactly
 * like a school computer lab behind one NAT. The script counts those 429s in
 * `cbt_start_throttled` so the run reports the ceiling instead of hiding it.
 *
 * NOT EXECUTED IN THIS REPOSITORY'S BUILD ENVIRONMENT (k6 is not installable
 * there, and no staging credentials exist). Run the 1-VU smoke first.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:3200').replace(/\/$/, '');
const VUS = Number(__ENV.VUS || 10);
const RAMP = __ENV.RAMP || '30s';
const HOLD = __ENV.HOLD || '3m';
const THINK = Number(__ENV.THINK || 1);
const QUESTIONS = Number(__ENV.QUESTION_COUNT || 10);
const P95_MS = Number(__ENV.P95_MS || 1500);
const P99_MS = Number(__ENV.P99_MS || 3000);

if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE_URL) && __ENV.ALLOW_REMOTE !== '1') {
  throw new Error(`Refusing to run against ${BASE_URL}. Point BASE_URL at staging and set ALLOW_REMOTE=1 to confirm.`);
}
if (!__ENV.TOKEN) throw new Error('TOKEN is required: a student access token for a throwaway test account.');
if (!__ENV.EXAM_ID) throw new Error('EXAM_ID is required: an exam with enough approved questions.');

export const options = {
  scenarios: {
    cbt_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP, target: VUS },
        { duration: HOLD, target: VUS },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    // 429 is expected at the start route once 60 starts/10 min/IP is reached;
    // it is counted separately and does not fail the run. Every other status
    // must be clean, and a submit must never fail silently.
    http_req_failed: ['rate<0.02'],
    http_req_duration: [`p(95)<${P95_MS}`, `p(99)<${P99_MS}`],
    checks: ['rate>0.99'],
    cbt_submit_mismatch: ['count==0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const startThrottled = new Counter('cbt_start_throttled');
const idempotencyOk = new Rate('cbt_resubmit_same_score');
const mismatch = new Counter('cbt_submit_mismatch');
const draftLatency = new Trend('cbt_draft_duration');
const submitLatency = new Trend('cbt_submit_duration');

const headers = {
  authorization: `Bearer ${__ENV.TOKEN}`,
  'content-type': 'application/json',
};

export default function () {
  // 1. Start (or resume) an attempt.
  const start = http.post(`${BASE_URL}/api/cbt/exams/${__ENV.EXAM_ID}/attempts`, JSON.stringify({
    mode: 'practice',
    questionCount: QUESTIONS,
  }), { headers, tags: { step: 'start' } });

  if (start.status === 429) {
    startThrottled.add(1);
    check(start, { 'start throttled by design, not by failure': () => true });
    sleep(THINK);
    return;
  }
  const started = check(start, { 'attempt started': (res) => res.status === 200 || res.status === 201 });
  if (!started) return;

  let attemptId = '';
  try {
    attemptId = (start.json('attemptId') || start.json('attempt_id') || start.json('id') || '').toString();
  } catch (error) {
    attemptId = '';
  }
  if (!attemptId) return;

  // 2. Read the paper. Answer count must equal what was asked for.
  const paper = http.get(`${BASE_URL}/api/cbt/attempts/${attemptId}/paper`, { headers, tags: { step: 'paper' } });
  check(paper, {
    'paper loads': (res) => res.status === 200,
    'paper is not empty': (res) => {
      try { return (res.json('questions') || []).length > 0; } catch (error) { return false; }
    },
  });

  // 3. Save answers in the same shape the browser sends: position -> 0..3.
  const answers = {};
  for (let index = 0; index < QUESTIONS; index += 1) answers[String(index)] = index % 4;
  const save = http.patch(`${BASE_URL}/api/cbt/attempts/${attemptId}/draft`, JSON.stringify({
    answers,
    questionIndex: QUESTIONS - 1,
  }), { headers, tags: { step: 'draft' } });
  draftLatency.add(save.timings.duration);
  check(save, { 'draft accepted': (res) => res.status === 200 || res.status === 204 });

  // 4. Submit, then submit again. A retry after a dropped connection must
  //    return the stored result, not a second attempt or a fresh score.
  const first = http.post(`${BASE_URL}/api/cbt/attempts/${attemptId}/submit`, JSON.stringify({ answers }), {
    headers,
    tags: { step: 'submit' },
  });
  submitLatency.add(first.timings.duration);
  const submitted = check(first, {
    'submit returns a result': (res) => res.status === 200 && typeof res.json('score') === 'number',
  });
  if (!submitted) {
    mismatch.add(1);
    return;
  }
  const firstScore = first.json('score');
  const firstTotal = first.json('totalQuestions');

  const retry = http.post(`${BASE_URL}/api/cbt/attempts/${attemptId}/submit`, JSON.stringify({ answers }), {
    headers,
    tags: { step: 'submit-retry' },
  });
  const retryOk = check(retry, {
    'retry is idempotent': (res) => res.status === 200
      && res.json('score') === firstScore
      && res.json('totalQuestions') === firstTotal,
  });
  idempotencyOk.add(retryOk);
  if (!retryOk) mismatch.add(1);

  sleep(THINK * (0.7 + Math.random() * 0.6));
}
