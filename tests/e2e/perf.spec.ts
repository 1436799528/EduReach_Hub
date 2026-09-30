import { expect, test } from '@playwright/test';
import { annotateFailure } from './report';

// PERF-1: what a throttled browser actually experiences.
//
// The byte budgets in `scripts/perf-audit.ts` are exact and tight; the numbers
// here are lab measurements on a shared runner, so they are reported in full and
// asserted loosely. A 20 % wobble must not fail an honest pull request — a
// doubled critical path, a missing lazy image or a layout that jumps must.
//
// The profile is the one the product is for: a mid-range Android on 4G
// (~1.6 Mbps, 150 ms RTT) with a 4× CPU slowdown. Fonts are answered locally so
// the measurement does not depend on the internet being reachable from CI; the
// font *chain* is still exercised (the stylesheet request is counted).
//
// Runs on the mobile project only — the desktop run would be a different
// profile wearing the same assertions.

const MB = 1024 * 1024;

/**
 * Ceilings, not targets. The tight guard on bytes is the static budget in
 * `scripts/perf-audit.ts`, which is exact; these exist to catch the kind of
 * regression a byte count cannot see — a render-blocking chain, a layout that
 * jumps, a main thread that stalls — without failing an honest change on a
 * noisy runner. The measured values are printed for every run.
 */
const BUDGET = {
  lcpMs: 8000, // first CI measurement: see docs/features/PERF-1.md Evidence
  cls: 0.1,
  longTaskMs: 3000, // the total-blocking-time definition, summed over 50 ms long tasks
  transferBytes: 1_200_000,
  requests: 90,
};

test.afterEach(async ({}, testInfo) => {
  annotateFailure(testInfo);
});

test.describe('throttled mobile profile', () => {
  test.skip(({ isMobile }) => !isMobile, 'the perf profile is measured on the mobile project only');

  test.beforeEach(async ({ page }) => {
    // The font CSS is answered locally: CI has no guarantee of reaching Google,
    // and a blocked stylesheet would measure the network, not this app.
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '@font-face { font-family: "Inter"; src: local("Arial"); font-display: swap; }',
      }),
    );
    await page.route('https://fonts.gstatic.com/**', (route) => route.abort());

    await page.addInitScript(() => {
      const perf = { lcp: 0, cls: 0, longTaskMs: 0, longTasks: 0 };
      (window as unknown as { __perf: typeof perf }).__perf = perf;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) perf.lcp = Math.max(perf.lcp, entry.startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
          if (!entry.hadRecentInput) perf.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          perf.longTasks += 1;
          perf.longTaskMs += Math.max(0, entry.duration - 50); // the total-blocking-time definition
        }
      }).observe({ type: 'longtask', buffered: true });
    });

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * MB) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  });

  for (const path of ['/', '/news', '/past-questions']) {
    test(`performance profile: ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      // Let the observers flush and late layout shifts land before reading.
      await page.waitForTimeout(1200);

      const metrics = await page.evaluate(() => {
        const perf = (window as unknown as { __perf: { lcp: number; cls: number; longTaskMs: number; longTasks: number } }).__perf;
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const transferBytes = resources.reduce((total, entry) => total + (entry.transferSize || 0), 0) + (navigation?.transferSize || 0);
        return {
          lcp: Math.round(perf.lcp),
          cls: Number(perf.cls.toFixed(4)),
          longTaskMs: Math.round(perf.longTaskMs),
          longTasks: perf.longTasks,
          ttfb: Math.round(navigation?.responseStart ?? 0),
          domContentLoaded: Math.round(navigation?.domContentLoadedEventEnd ?? 0),
          transferBytes,
          requests: resources.length,
          fontCssRequested: resources.some((entry) => entry.name.includes('fonts.googleapis.com')),
        };
      });

      console.log([
        `[perf] ${path}`,
        `LCP ${metrics.lcp} ms`,
        `CLS ${metrics.cls}`,
        `TBT ${metrics.longTaskMs} ms (${metrics.longTasks} long tasks)`,
        `TTFB ${metrics.ttfb} ms`,
        `DCL ${metrics.domContentLoaded} ms`,
        `transfer ${(metrics.transferBytes / 1024).toFixed(0)} KB in ${metrics.requests} requests`,
        `font css requested: ${metrics.fontCssRequested}`,
      ].join(' | '));

      expect(metrics.fontCssRequested, 'the font stylesheet should be requested by the document').toBe(true);
      expect(metrics.lcp, 'largest contentful paint').toBeLessThanOrEqual(BUDGET.lcpMs);
      expect(metrics.cls, 'cumulative layout shift').toBeLessThanOrEqual(BUDGET.cls);
      expect(metrics.longTaskMs, 'total blocking time').toBeLessThanOrEqual(BUDGET.longTaskMs);
      expect(metrics.transferBytes, 'bytes over the wire for this route').toBeLessThanOrEqual(BUDGET.transferBytes);
      expect(metrics.requests, 'requests for this route').toBeLessThanOrEqual(BUDGET.requests);
    });
  }
});
