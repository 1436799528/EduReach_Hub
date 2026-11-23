/**
 * One row per page a visitor can reach without an account.
 *
 * The point of this file is that the promise a page makes is written down once
 * and asserted by something, instead of living in five places that drift: the
 * route table in `routes.tsx`, the hand-written route list in the axe spec, the
 * three routes in the performance spec, the sitemap builders and the nav
 * config. Before this file the coverage was "whichever pages someone remembered
 * to name", which is how the FAQ and Reviews sections shipped broken while the
 * whole gate was green.
 *
 * What each field is used for:
 *
 * - `checks: 'full'` — `tests/e2e/route-coverage.spec.ts` opens it in a real
 *   browser and asserts it renders: non-empty root, one `h1`, a title, no page
 *   error, no 4xx asset. Every declared page is held to this now; `'smoke'`
 *   remains for a future page that genuinely cannot be opened without a
 *   configured backend or a signed-in user.
 * - `indexable` — must agree with `seoForPath().indexable`. A test asserts it,
 *   so a page cannot quietly join the sitemap or quietly leave it.
 * - `api` — endpoints the page reads. `npm run smoke -- <url> --pages` asks each
 *   one after a deploy, which is the check that would have caught the missing
 *   FAQ and Reviews tables in thirty seconds.
 * - `overflowSafe` — the page is asserted not to scroll sideways at 320, 768 and
 *   1440 px. Only pages that are laid out by this repository are marked; a page
 *   that legitimately contains a wide table should not be added here without
 *   wrapping that table.
 *
 * Keep this file free of imports: `scripts/smoke-check.ts` loads it in plain
 * Node, outside Vite and outside the browser.
 */

export type PageChecks = 'full' | 'smoke';

export interface PageManifestEntry {
  /** Exact path, as `routes.tsx` matches it. */
  path: string;
  /** Short name used in reports and test titles. */
  name: string;
  /** Anyone can open it without signing in. */
  public: boolean;
  /** Must agree with `seoForPath(path).indexable`. */
  indexable: boolean;
  checks: PageChecks;
  /** API endpoints the page reads; the post-deploy crawl requires a 200 JSON answer. */
  api?: readonly string[];
  /** Selectors that must exist after the page has rendered. */
  landmarks?: readonly string[];
  /** Must not scroll horizontally at 320 / 768 / 1440. */
  overflowSafe?: boolean;
}

export const PAGE_MANIFEST: readonly PageManifestEntry[] = [
  { path: '/', name: 'Home', public: true, indexable: true, checks: 'full', api: ['/api/faqs', '/api/reviews', '/api/news'], landmarks: ['main', 'h1'] },
  { path: '/news', name: 'News index', public: true, indexable: true, checks: 'full', api: ['/api/news'] },
  { path: '/events', name: 'Deadlines and calendar', public: true, indexable: true, checks: 'full' },
  { path: '/scholarships', name: 'Scholarships', public: true, indexable: true, checks: 'full', api: ['/api/opportunities'] },
  { path: '/jobs', name: 'Jobs and internships', public: true, indexable: true, checks: 'full', api: ['/api/opportunities'] },
  { path: '/schools', name: 'School finder', public: true, indexable: true, checks: 'full' },
  { path: '/past-questions', name: 'Past questions', public: true, indexable: true, checks: 'full', api: ['/api/past-questions/resources'] },
  { path: '/services', name: 'Service catalogue', public: true, indexable: true, checks: 'full' },
  { path: '/cbt', name: 'CBT hub', public: true, indexable: true, checks: 'full' },
  { path: '/jamb', name: 'JAMB hub', public: true, indexable: true, checks: 'full' },
  { path: '/waec', name: 'WAEC hub', public: true, indexable: true, checks: 'full' },
  { path: '/neco', name: 'NECO hub', public: true, indexable: true, checks: 'full' },
  { path: '/post-utme', name: 'Post-UTME hub', public: true, indexable: true, checks: 'full' },
  { path: '/faq', name: 'Help centre', public: true, indexable: true, checks: 'full', api: ['/api/faqs'], landmarks: ['.er-faq-layout', '.er-faq-topics'], overflowSafe: true },
  { path: '/reviews', name: 'Student reviews', public: true, indexable: true, checks: 'full', api: ['/api/reviews'], overflowSafe: true },
  { path: '/search', name: 'Site search', public: true, indexable: false, checks: 'full' },
  { path: '/screening-calculator', name: 'Screening calculator', public: true, indexable: true, checks: 'full' },
  { path: '/tools/cgpa-calculator', name: 'CGPA calculator', public: true, indexable: true, checks: 'full' },
  { path: '/about', name: 'About', public: true, indexable: true, checks: 'full', overflowSafe: true },
  { path: '/contact', name: 'Contact', public: true, indexable: true, checks: 'full', overflowSafe: true },
  { path: '/privacy', name: 'Privacy notice', public: true, indexable: true, checks: 'full', overflowSafe: true },
  { path: '/terms', name: 'Terms of use', public: true, indexable: true, checks: 'full', overflowSafe: true },
  { path: '/cookies', name: 'Cookie policy', public: true, indexable: true, checks: 'full' },
  { path: '/accessibility', name: 'Accessibility statement', public: true, indexable: true, checks: 'full' },
  { path: '/disclaimer', name: 'Disclaimer', public: true, indexable: true, checks: 'full' },
  { path: '/refunds', name: 'Refund policy', public: true, indexable: true, checks: 'full' },
  { path: '/login', name: 'Sign in', public: true, indexable: false, checks: 'full' },
  { path: '/register', name: 'Create account', public: true, indexable: false, checks: 'full' },
  { path: '/forgot-password', name: 'Forgot password', public: true, indexable: false, checks: 'full' },
  { path: '/reset-password', name: 'Reset password', public: true, indexable: false, checks: 'full' },
  { path: '/verify-email', name: 'Verify email', public: true, indexable: false, checks: 'full' },
  { path: '/cbt/setup/jamb', name: 'Practice setup (JAMB)', public: true, indexable: false, checks: 'full' },
  { path: '/cbt/setup/waec', name: 'Practice setup (WAEC)', public: true, indexable: false, checks: 'full' },
  { path: '/cbt/setup/neco', name: 'Practice setup (NECO)', public: true, indexable: false, checks: 'full' },
  { path: '/cbt/setup/post-utme', name: 'Practice setup (Post-UTME)', public: true, indexable: false, checks: 'full' },
  { path: '/nelfund', name: 'NELFUND application', public: true, indexable: true, checks: 'full' },
  { path: '/results', name: 'Result checking', public: true, indexable: true, checks: 'full' },
  { path: '/nabteb', name: 'NABTEB (coming soon)', public: true, indexable: false, checks: 'full' },
  { path: '/admission', name: 'Admission support (coming soon)', public: true, indexable: false, checks: 'full' },
  { path: '/tools', name: 'Tools index (coming soon)', public: true, indexable: false, checks: 'full' },
  { path: '/support', name: 'Support (coming soon)', public: true, indexable: false, checks: 'full' },
] as const;

/** Entries the browser spec is expected to open. */
export function fullCoveragePages(): readonly PageManifestEntry[] {
  return PAGE_MANIFEST.filter((entry) => entry.checks === 'full');
}

/** Entries with at least one backing endpoint, for the post-deploy crawl. */
export function pagesWithEndpoints(): readonly PageManifestEntry[] {
  return PAGE_MANIFEST.filter((entry) => (entry.api?.length ?? 0) > 0);
}

export function manifestEntry(path: string): PageManifestEntry | undefined {
  return PAGE_MANIFEST.find((entry) => entry.path === path);
}
