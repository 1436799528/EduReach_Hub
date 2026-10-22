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
  // The old ceiling was 8000 ms, taken from the first CI measurement, and it
  // passed even when every route painted in 4.7–6.5 s: it documented the
  // measurement instead of enforcing the metric. The causes were found (see
  // docs/features/PERF-1.md, "Mobile LCP investigation") and the routes now
  // paint in ~1.5–2.1 s on this profile, so the ceiling is set where a real
  // Core Web Vitals regression fails: 2.5 s is the "good" boundary and 3000 ms
  // leaves the runner noise a 20 % wobble needs.
  lcpMs: 3000,
  cls: 0.1,
  longTaskMs: 3000, // the total-blocking-time definition, summed over 50 ms long tasks
  // 863 KB was transferred on `/` before the server compressed its own
  // responses; 221–236 KB after. The budget is the regression guard for that
  // fix, not a restatement of the number.
  transferBytes: 400_000,
  requests: 90,
};

test.afterEach(async ({}, testInfo) => {
  annotateFailure(testInfo);
});

test.describe('throttled mobile profile', () => {
  test.skip(({ isMobile }) => !isMobile, 'the perf profile is measured on the mobile project only');

  /** `asset.js:gzip` for every hashed entry asset this page requested. */
  let encodings: string[] = [];

  test.beforeEach(async ({ page }) => {
    encodings = [];
    // Whether the server compresses its own responses is part of the profile:
    // the hosted build is compressed by Netlify, the self-hosted build is
    // compressed by Express (`app.use(compression(...))` in server.ts). If that
    // middleware is dropped, the bytes below triple — this asserts it directly
    // instead of leaving the transfer budget to infer it.
    page.on('response', async (response) => {
      const url = response.url();
      if (!/\/assets\/index-.*\.(js|css)$/.test(url)) return;
      const encoding = (await response.allHeaders())['content-encoding'] ?? '';
      encodings.push(`${url.split('/').pop()}:${encoding || 'identity'}`);
    });
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
      // Attribution, not just the score: a failing CLS assertion has to name the
      // element that moved, or the fix is a guess.
      const perf = {
        lcp: 0, cls: 0, longTaskMs: 0, longTasks: 0,
        shifts: {} as Record<string, { value: number; count: number }>,
        // When and how far: a source name alone cannot tell a placeholder
        // collapsing from content arriving late.
        log: [] as Array<{ t: number; value: number; node: string; dy: number | null }>,
      };
      (window as unknown as { __perf: typeof perf }).__perf = perf;
      const describeNode = (node: Node | null): string => {
        if (!node) return '(node removed)';
        if (node.nodeType !== 1) return `${node.nodeName.toLowerCase()} (text)`;
        const element = node as Element;
        const id = element.id ? `#${element.id}` : '';
        const raw = (element as HTMLElement).className;
        const classes = typeof raw === 'string' && raw ? `.${raw.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
        return `${element.tagName.toLowerCase()}${id}${classes}`;
      };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) perf.lcp = Math.max(perf.lcp, entry.startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        type ShiftSource = { node: Node | null; previousRect?: DOMRectReadOnly; currentRect?: DOMRectReadOnly };
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: ShiftSource[] }>) {
          if (entry.hadRecentInput) continue;
          perf.cls += entry.value;
          const sources = entry.sources?.length ? entry.sources : [{ node: null }];
          for (const source of sources) {
            const key = describeNode(source.node);
            const record = (perf.shifts[key] ??= { value: 0, count: 0 });
            record.value += entry.value / sources.length;
            record.count += 1;
          }
          if (perf.log.length < 12) {
            const biggest = [...sources].sort((left, right) => (right.currentRect?.width ?? 0) * (right.currentRect?.height ?? 0) - (left.currentRect?.width ?? 0) * (left.currentRect?.height ?? 0))[0];
            perf.log.push({
              t: Math.round(entry.startTime),
              value: Number(entry.value.toFixed(4)),
              node: describeNode(biggest?.node ?? null),
              dy: biggest?.previousRect && biggest?.currentRect
                ? Math.round(biggest.currentRect.top - biggest.previousRect.top)
                : null,
            });
          }
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

  // The three routes are measured one after another, in one test.
  //
  // They used to be three parallel tests, and the runner's own contention showed
  // up in the number: the same route measured 1.7 s alone and 2.5 s with two
  // other 4×-throttled Chromium pages competing for the cores. A lab number that
  // depends on how many tests happen to be running is not a measurement of the
  // page. Measuring serially makes each number mean what it claims, and every
  // route is still measured before any assertion runs, so one slow route does
  // not hide the other two.
  test('performance profile: /, /news, /past-questions', async ({ page }) => {
    const measured: Array<{ path: string; metrics: any; assets: string[] }> = [];

    for (const path of ['/', '/news', '/past-questions']) {
      await test.step(`measure ${path}`, async () => {
        encodings = [];
        await page.goto(path, { waitUntil: 'load' });
        // Let the observers flush and late layout shifts land before reading.
        await page.waitForTimeout(1200);

        const metrics = await page.evaluate(() => {
          const perf = (window as unknown as {
            __perf: {
              lcp: number; cls: number; longTaskMs: number; longTasks: number;
              shifts: Record<string, { value: number; count: number }>;
              log: Array<{ t: number; value: number; node: string; dy: number | null }>;
            };
          }).__perf;
          const shiftSources = Object.entries(perf.shifts)
            .map(([node, record]) => ({ node, ...record }))
            .sort((left, right) => right.value - left.value)
            .slice(0, 4);
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
            shiftLog: perf.log,
            anatomy: (['.er-late-region', '.er-sim-grid', '.er-sim-card', '.er-news-list', '.er-section', '.er-two-col', 'main', 'footer']
              .flatMap((selector) => Array.from(document.querySelectorAll(selector)).slice(0, 3))
              .map((element) => {
                const rect = element.getBoundingClientRect();
                const raw = (element as HTMLElement).className;
                const classes = typeof raw === 'string' && raw ? `.${raw.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
                return `${element.tagName.toLowerCase()}${classes}@${Math.round(rect.top)}+${Math.round(rect.height)}`;
              })),
            fontCssRequested: resources.some((entry) => entry.name.includes('fonts.googleapis.com')),
            shiftSources,
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
          `shift sources: ${metrics.shiftSources.map((source: any) => `${source.node} ${source.value.toFixed(3)}x${source.count}`).join(' + ') || 'none'}`,
          `shift log: ${metrics.shiftLog.map((entry: any) => `t=${entry.t}ms ${entry.value} ${entry.node} dy=${entry.dy}`).join(' | ') || 'none'}`,
          `compression: ${encodings.join(' ') || 'no hashed asset seen'}`,
        ].join(' | '));

        measured.push({ path, metrics, assets: [...encodings] });
      });
    }

    for (const { path, metrics, assets } of measured) {
      expect(metrics.fontCssRequested, `${path}: the font stylesheet should be requested by the document`).toBe(true);
      expect(metrics.lcp, `${path}: largest contentful paint`).toBeLessThanOrEqual(BUDGET.lcpMs);
      const sources = metrics.shiftSources.map((source: any) => `${source.node} ${source.value.toFixed(3)}x${source.count}`).join(' + ') || 'none';
      const timeline = metrics.shiftLog.map((entry: any) => `t=${entry.t}ms ${entry.value} ${entry.node} dy=${entry.dy}`).join(' | ') || 'none';
      expect(
        metrics.cls,
        `${path}: cumulative layout shift — sources: ${sources} ;; timeline: ${timeline} ;; anatomy: ${metrics.anatomy.join(' ')}`,
      ).toBeLessThanOrEqual(BUDGET.cls);
      expect(metrics.longTaskMs, `${path}: total blocking time`).toBeLessThanOrEqual(BUDGET.longTaskMs);
      expect(metrics.transferBytes, `${path}: bytes over the wire`).toBeLessThanOrEqual(BUDGET.transferBytes);
      expect(metrics.requests, `${path}: requests`).toBeLessThanOrEqual(BUDGET.requests);
      // The entry script and stylesheet are the two largest first-load bytes; a
      // server that stops compressing them is the regression the transfer budget
      // exists to catch, and this names it when it happens.
      const uncompressed = assets.filter((entry) => entry.endsWith(':identity'));
      expect(assets.length, `${path}: the hashed entry script and stylesheet were requested`).toBeGreaterThanOrEqual(2);
      expect(uncompressed, `${path}: these first-load assets were served uncompressed: ${uncompressed.join(', ')}`).toEqual([]);
    }
  });
});
