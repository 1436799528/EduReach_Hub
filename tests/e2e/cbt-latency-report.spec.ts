import { expect, test, type Page } from '@playwright/test';

/**
 * CBT latency report — what a throttled connection actually experiences.
 *
 * Every API response is synthetic and delayed by a fixed round trip, so the
 * wall times below are dominated by sequential network waits — exactly what
 * this suite exists to remove. The numbers are printed for every run and
 * asserted loosely: they document the measurement; the round-trip counts are
 * the contract. Reproduce with:
 *
 *   npx playwright test tests/e2e/cbt-latency-report.spec.ts --project=desktop-chromium
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
/** Simulated round trip on every API response (throttled mobile, 4G-ish). */
const RTT_MS = 300;
const ATTEMPT = '11111111-1111-4111-8111-111111111199';

type Stats = { name: string; samples: number[]; apiCalls: number };

function pct(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

function report(stats: Stats) {
  console.log(
    `[cbt-latency] ${stats.name}: n=${stats.samples.length} ` +
      `p50=${pct(stats.samples, 50)}ms p90=${pct(stats.samples, 90)}ms ` +
      `max=${Math.max(...stats.samples)}ms apiCallsPerRun=${stats.apiCalls} ` +
      `samples=[${stats.samples.join(', ')}]`,
  );
}

async function installAuth(page: Page) {
  await page.addInitScript((account) => {
    localStorage.setItem(
      'sb-edureach-unconfigured-auth-token',
      JSON.stringify({
        access_token: 'isolated-test-token',
        refresh_token: 'isolated-test-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: account, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
      }),
    );
    localStorage.setItem('edureach-privacy-preferences-v1', JSON.stringify({ necessary: true, analytics: false, version: 1 }));
  }, ACCOUNT);
  await page.route('**/edureach-unconfigured.supabase.co/**', (route) => route.abort());
}

async function installPaper(page: Page, counters: { apiCalls: number; submits: number }) {
  const paper = {
    serverTime: new Date().toISOString(),
    protocol: { version: 1 },
    attempt: {
      id: ATTEMPT,
      examId: 'test-exam',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      mode: 'practice',
      durationMinutes: 30,
      programme: null,
      subjects: ['Test subject'],
      plan: [],
      totalQuestions: 20,
      questionIndex: 0,
      savedAnswers: {},
      exam: { id: 'test-exam', title: 'Latency report paper', examBody: 'test', subject: 'Test subject' },
    },
    questions: Array.from({ length: 20 }, (_, i) => ({
      position: i + 1,
      subject: 'Test subject',
      id: `test-question-${i + 1}`,
      text: `Test-only question ${i + 1}`,
      options: ['Option one', 'Option two', 'Option three', 'Option four'],
    })),
  };
  await page.route(`**/cbt/attempts/${ATTEMPT}/paper`, async (route) => {
    counters.apiCalls++;
    await new Promise((resolve) => setTimeout(resolve, RTT_MS));
    return route.fulfill({ json: paper });
  });
  await page.route(`**/cbt/attempts/${ATTEMPT}/draft`, async (route) => {
    counters.apiCalls++;
    await new Promise((resolve) => setTimeout(resolve, RTT_MS));
    return route.fulfill({ json: { saved: true, serverTime: new Date().toISOString() } });
  });
  await page.route(`**/cbt/attempts/${ATTEMPT}/submit`, async (route) => {
    counters.apiCalls++;
    counters.submits++;
    await new Promise((resolve) => setTimeout(resolve, RTT_MS));
    return route.fulfill({
      json: { attemptId: ATTEMPT, score: 80, correctAnswers: 16, totalQuestions: 20, breakdown: [] },
    });
  });
}

const latency = { cold: { name: 'paper load (run 1 = cold, runs 2–5 reopen from the device journal)', samples: [], apiCalls: 0 } as Stats, resume: { name: 'resume (refresh)', samples: [], apiCalls: 0 } as Stats, save: { name: 'answer save → acknowledged', samples: [], apiCalls: 0 } as Stats };

test('report: CBT paper load, resume and answer-save latency', async ({ page }) => {
  test.setTimeout(120_000);
  await installAuth(page);
  const counters = { apiCalls: 0, submits: 0 };
  await installPaper(page, counters);

  for (let run = 0; run < 5; run++) {
    // Cold load: navigation to the hall until the paper is on screen.
    let callsBefore = counters.apiCalls;
    const coldStart = Date.now();
    await page.goto(`/cbt/session/${ATTEMPT}`);
    const consent = page.getByRole('button', { name: 'Reject optional' });
    if (await consent.isVisible()) await consent.click();
    await expect(page.getByRole('heading', { name: 'Test-only question 1' })).toBeVisible();
    latency.cold.samples.push(Date.now() - coldStart);
    latency.cold.apiCalls = counters.apiCalls - callsBefore;

    // Resume: refresh the same hall — the paper must be on screen again.
    callsBefore = counters.apiCalls;
    const resumeStart = Date.now();
    await page.reload();
    if (await consent.isVisible()) await consent.click();
    await expect(page.getByRole('heading', { name: 'Test-only question 1' })).toBeVisible();
    latency.resume.samples.push(Date.now() - resumeStart);
    latency.resume.apiCalls = counters.apiCalls - callsBefore;

    // Answer save: choose an option; the answer must be acknowledged by the
    // server (response received — the save stays backgrounded throughout).
    // A quiet period first, so the measured response belongs to this click.
    await page.waitForTimeout(1_300);
    callsBefore = counters.apiCalls;
    const saveStart = Date.now();
    const ack = page.waitForResponse((r) => r.url().includes('/draft') && r.ok());
    await page.getByRole('radio', { name: /Option two/ }).first().click();
    await ack;
    latency.save.samples.push(Date.now() - saveStart);
    latency.save.apiCalls = 1;
    await expect.poll(() => counters.apiCalls - callsBefore, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
    // Let the debounced flush settle between runs.
    await page.waitForTimeout(800);
  }

  report(latency.cold);
  report(latency.resume);
  report(latency.save);
  // Sanity only — these numbers document, the round-trip counts are the guard.
  expect(latency.cold.samples.length).toBe(5);
  expect(pct(latency.resume.samples, 50)).toBeLessThan(15_000);
});
