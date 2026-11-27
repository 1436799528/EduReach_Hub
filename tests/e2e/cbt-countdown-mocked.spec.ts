import { expect, test, type Page } from '@playwright/test';

/**
 * The visible CBT countdown, proven in a real browser.
 *
 * The paper, its deadline and every API response are synthetic and stay inside
 * the browser — no real server, database or candidate data is involved. What
 * is real is the exam hall page, its clock and its submission flow.
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

type PaperOptions = {
  attemptId: string;
  mode?: 'practice' | 'mock';
  /** Milliseconds from "now" until the server deadline, or null for untimed. */
  expiresInMs: number | null;
  durationMinutes: number | null;
};

async function installAuth(page: Page, clockSkewMs = 0) {
  if (clockSkewMs !== 0) {
    // The device clock is wrong from before the first paint: an NTP accident
    // or a manual setting gone astray.
    await page.addInitScript((skew) => {
      const realNow = Date.now;
      Date.now = () => realNow() + skew;
      const RealDate = Date;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).Date = class extends RealDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) super(realNow() + skew);
          else super(...(args as []));
        }
        static now() {
          return realNow() + skew;
        }
      };
    }, clockSkewMs);
  }
  await page.addInitScript((account) => {
    localStorage.setItem(
      'sb-edureach-unconfigured-auth-token',
      JSON.stringify({
        access_token: 'isolated-test-token',
        refresh_token: 'isolated-test-refresh',
        // Evaluated after any device-clock override, so the session is valid
        // in the device's own (possibly wrong) time.
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

async function installPaper(page: Page, options: PaperOptions) {
  const counters = { submits: 0, drafts: 0 };
  const startedAt = new Date().toISOString();
  const expiresAt = options.expiresInMs === null ? null : new Date(Date.now() + options.expiresInMs).toISOString();
  await page.route(`**/cbt/attempts/${options.attemptId}/paper`, (route) =>
    route.fulfill({
      json: {
        serverTime: new Date().toISOString(),
        protocol: { version: 1 },
        attempt: {
          id: options.attemptId,
          examId: 'test-exam',
          status: 'in_progress',
          startedAt,
          expiresAt,
          mode: options.mode ?? 'practice',
          durationMinutes: options.durationMinutes,
          programme: null,
          subjects: ['Test subject'],
          plan: [],
          totalQuestions: 1,
          questionIndex: 0,
          savedAnswers: {},
          exam: { id: 'test-exam', title: 'Countdown test paper', examBody: 'test', subject: 'Test subject' },
        },
        questions: [{ position: 1, subject: 'Test subject', id: 'test-question', text: 'Test-only question', options: ['Option one', 'Option two'] }],
      },
    }),
  );
  await page.route(`**/cbt/attempts/${options.attemptId}/draft`, (route) => {
    counters.drafts++;
    return route.fulfill({ json: { saved: true, serverTime: new Date().toISOString() } });
  });
  await page.route(`**/cbt/attempts/${options.attemptId}/submit`, (route) => {
    counters.submits++;
    return route.fulfill({
      json: {
        attemptId: options.attemptId,
        score: 100,
        correctAnswers: 1,
        totalQuestions: 1,
        breakdown: [{ question: 1, subject: 'Test subject', selected: 0, correct: 0, explanation: null }],
      },
    });
  });
  return counters;
}

async function openHall(page: Page, attemptId: string) {
  await page.goto(`/cbt/session/${attemptId}`);
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('heading', { name: 'Test-only question' })).toBeVisible();
}

const timerText = (page: Page) => page.locator('.er-exam-timer b');

function parseClock(text: string): number {
  const parts = text.trim().split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

test('the visible timer counts down second by second', async ({ page }) => {
  await installAuth(page);
  await installPaper(page, { attemptId: 'countdown-tick', expiresInMs: 120_000, durationMinutes: 2 });
  await openHall(page, 'countdown-tick');

  const first = parseClock((await timerText(page).textContent())!);
  await page.waitForTimeout(2_200);
  const second = parseClock((await timerText(page).textContent())!);
  expect(first).toBeGreaterThan(0);
  expect(second).toBeLessThan(first);
  expect(first - second).toBeGreaterThanOrEqual(1);
  expect(first - second).toBeLessThanOrEqual(3);
});

test('refreshing preserves the remaining time instead of resetting the clock', async ({ page }) => {
  await installAuth(page);
  await installPaper(page, { attemptId: 'countdown-refresh', expiresInMs: 180_000, durationMinutes: 3 });
  await openHall(page, 'countdown-refresh');

  await page.waitForTimeout(3_000);
  const before = parseClock((await timerText(page).textContent())!);
  await page.reload();
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('heading', { name: 'Test-only question' })).toBeVisible();
  const after = parseClock((await timerText(page).textContent())!);

  // The deadline is server-owned: a reload continues from where the clock was
  // (within a second of rounding), it never restarts at the full duration.
  expect(after).toBeLessThanOrEqual(before);
  expect(after).toBeGreaterThanOrEqual(before - 6);
});

test('an incorrect device clock does not change the deadline', async ({ page }) => {
  await installAuth(page, 2 * 60 * 60 * 1000); // device clock two hours fast
  await installPaper(page, { attemptId: 'countdown-skew', expiresInMs: 120_000, durationMinutes: 2 });
  await openHall(page, 'countdown-skew');

  // The server deadline (two real minutes) governs: the skewed clock can
  // neither shorten it to zero nor extend it to two hours.
  const first = parseClock((await timerText(page).textContent())!);
  expect(first).toBeGreaterThan(110);
  expect(first).toBeLessThanOrEqual(120);
  await page.waitForTimeout(2_200);
  const second = parseClock((await timerText(page).textContent())!);
  expect(second).toBeLessThan(first);
  expect(second).toBeGreaterThan(105);
});

test('backgrounding and reopening the tab does not freeze the timer', async ({ page }) => {
  await installAuth(page);
  await installPaper(page, { attemptId: 'countdown-suspend', expiresInMs: 120_000, durationMinutes: 2 });
  await openHall(page, 'countdown-suspend');

  const before = parseClock((await timerText(page).textContent())!);
  // Suspend the tab (the interval is throttled), wait, then reopen it.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(4_000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // The clock corrects itself to the real elapsed time — it did not freeze.
  await expect
    .poll(async () => parseClock((await timerText(page).textContent())!), { timeout: 5_000 })
    .toBeLessThanOrEqual(before - 3);
  // And it keeps counting after the resume.
  await page.waitForTimeout(1_500);
  const later = parseClock((await timerText(page).textContent())!);
  expect(later).toBeLessThanOrEqual(before - 4);
});

test('reaching zero stops answers and submits through the server exactly once', async ({ page }) => {
  await installAuth(page);
  const counters = await installPaper(page, {
    attemptId: 'countdown-expiry',
    expiresInMs: 3_500,
    durationMinutes: 1,
  });
  await openHall(page, 'countdown-expiry');

  // The deadline passes: exactly one submission, through the idempotent flow.
  await expect(page).toHaveURL(/\/cbt\/results\/countdown-expiry/, { timeout: 15_000 });
  expect(counters.submits).toBe(1);
  // Waiting longer never fires a second submission.
  await page.waitForTimeout(3_000);
  expect(counters.submits).toBe(1);
});

test('no timed mode bypasses the countdown: practice and mock both tick', async ({ page }) => {
  for (const [attemptId, mode] of [
    ['countdown-practice', 'practice'],
    ['countdown-mock', 'mock'],
  ] as const) {
    await installAuth(page);
    await installPaper(page, { attemptId, mode, expiresInMs: 90_000, durationMinutes: mode === 'mock' ? 120 : 2 });
    await openHall(page, attemptId);
    const first = parseClock((await timerText(page).textContent())!);
    await page.waitForTimeout(1_500);
    const second = parseClock((await timerText(page).textContent())!);
    expect(first, `${mode} session shows a countdown`).toBeGreaterThan(0);
    expect(second, `${mode} session countdown ticks`).toBeLessThan(first);
  }
});

test('an untimed session says there is no limit instead of freezing at 00:00', async ({ page }) => {
  await installAuth(page);
  await installPaper(page, { attemptId: 'countdown-untimed', expiresInMs: null, durationMinutes: null });
  await openHall(page, 'countdown-untimed');
  await expect(timerText(page)).toHaveText('No limit');
  // A frozen "00:00 remaining" is the bug this replaces.
  await page.waitForTimeout(2_000);
  await expect(timerText(page)).toHaveText('No limit');
  await expect(page.locator('.er-exam-timer-track')).toHaveCount(0);
});
