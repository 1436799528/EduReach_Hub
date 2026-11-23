# Page audit — 23 November 2026

Every page the router can serve, checked against three questions: does it belong
to a stated product goal, does every link on it resolve, and does it meet the
standard a public education site is held to. Measurements below are from this
repository at `920efa8` plus the changes in this branch; where a check needs a
browser or a live site that this pass could not reach, the row says so instead of
guessing.

**Headline:** no broken internal link exists, and none can now be introduced
without failing CI. Three policy pages were unreachable and are now linked.
Everything else that fails is listed with an owner.

## How this was measured

| Check | Command | Result |
|---|---|---|
| Internal links | `npm run links:audit` (new) | 303 links in 218 files — 0 broken |
| Route table vs router | `npm run routes:check` | in sync |
| Static accessibility | `npm run a11y:audit` | 0 blocking, 11 informational |
| Titles, descriptions, canonical, indexability | `seoForPath()` over all 90 routes | 0 missing metadata, 0 indexable page without a canonical |
| Rendered pages (browser) | `tests/e2e/route-coverage.spec.ts` in CI | 28 pages, desktop + mobile + WebKit, all green on `920efa8` |
| Headers, HSTS, CSP | `tests/headers.test.ts` | passing |
| Sitemap and robots | `tests/seo.test.ts` | passing |
| Page inventory and inbound links | this audit's script | 90 routes; 62 have at least one literal inbound link, 28 do not (most of those are aliases or flow-only screens) |

Not measurable here, and therefore not claimed: a live crawl of production, a
Lighthouse/Core Web Vitals run against a real phone, an HTML validator over
rendered DOM, and any real-device pass (Tecno, Infinix, itel). Section 7 lists
what closing each of those needs.

## 1. The yardstick: what this site is for

From `docs/architecture/00-PRODUCT-DEFINITION.md`, five pillars. Every page must
belong to one, and the trust rules apply to all of them: never imply EduReach is
the government body, never publish an unverified update as fact, always show
whether an update still applies.

| Pillar | Promise | Pages |
|---|---|---|
| **Prepare** | Practise and calculate what determines admission | `/cbt*`, `/past-questions`, `/screening-calculator`, `/tools/cgpa-calculator`, exam hubs |
| **Stay updated** | Know what changed, when, and whether it still applies | `/news*`, `/events` |
| **Find opportunities** | Funding, jobs and programmes still open | `/scholarships*`, `/jobs*`, `/nelfund` |
| **Find your school** | Look up an institution, reach its official source | `/schools*` |
| **Get student support** | Complete a student process, with tracking | `/services*`, `/results`, `/track` |

Account, trust/legal and admin surfaces support those five rather than standing
alone. That is the classification used in section 6.

## 2. Findings

Severity is about student impact, not tidiness: **High** = a student cannot reach
or trust something they need; **Medium** = discoverability or compliance risk;
**Low** = polish.

| # | Finding | Severity | Owner | State |
|---|---|---|---|---|
| **F1** | **Three published policy pages were unreachable.** `/accessibility` and `/disclaimer` were in the sitemap (so crawlers were told to index them) but no page linked to either. `/refunds` — a real page with its own component — was in neither the footer nor the sitemap. An accessibility statement nobody can reach is not a statement | High | Fixed here | **Fixed** |
| **F2** | **No link could fail CI.** 303 internal links, hand-written, with nothing comparing them to the router. A rename would have shipped as a 404 | High | Fixed here | **Fixed** |
| **F3** | **`/results` is duplicate content with no inbound link.** It renders the same live service as `/services/results`, is indexable, has no canonical pointing at the service URL, is absent from the sitemap, and is linked from nowhere. Either it is the SEO landing page for "check result" searches and should be linked and canonicalised toward, or it is legacy and should redirect | Medium | Product decision | **Open** |
| **F4** | **13 pages render in production but are not held to the browser assertions.** `checks: 'smoke'` pages (auth screens, `/cbt/setup/*`, `/nelfund`, `/results`, `/nabteb`, `/admission`, `/tools`, `/support`) are crawled after deploy but never opened by a spec that asserts one `h1`, one `<main>` and no render error | Medium | Buildable | **Open** |
| **F5** | **18 admin routes have no browser assertion at all.** They are noindex and behind a capability check, but the most consequential screens in the product (import, publish, regrade, reports) are only covered by unit tests | Medium | Buildable | **Open** |
| **F6** | **External destinations are unmonitored.** 5 scholarship links come from seed data and every institution/opportunity record carries a URL from the database. A dead `.gov.ng` link is a trust failure, and nothing checks them | Medium | Buildable | **Open** |
| **F7** | **No HTML validation and no Lighthouse in CI.** Semantics are covered by targeted tests and performance by byte/LCP/CLS/TBT budgets, but there is no whole-document validator and no lab Lighthouse run against a cold mobile profile | Low | Buildable | **Open** |
| **F8** | **9 indexable titles exceed 60 characters and 6 indexable descriptions exceed 160.** Search results truncate; nothing breaks. Cosmetic, but it is the difference between a result that reads as a sentence and one that ends mid-word. (`/jamb`, `/waec`, `/neco`, `/post-utme`, `/schools`, `/services`, `/jobs` and the CGPA calculator, plus its alias.) A further 54 descriptions are over 160 on **noindex** pages, where length does not matter | Low | Buildable | **Open** |
| **F9** | **Four placeholder routes remain public:** `/admission`, `/support`, `/tools`, `/nabteb`. Each is noindex and excluded from the sitemap — honest, but a student who finds one by search gets "coming soon" from a site that claims to help them | Low | Product decision | **Open** |

Two earlier claims in `docs/WORKING_GUIDE_COMPLIANCE.md`'s predecessor notes were
checked and are **not** defects: pages with several `<h1>` in one file
(`StudentDashboardV2`, `LegalPage`, `CbtSessionPage`, `PublicProfilePage`, and
others) render exactly one at a time — each `h1` sits in a mutually exclusive
branch (loading / error / loaded / per-tab). `CbtPracticeEntryPage` has no
heading because it is a redirect shim that forwards to the setup wizard.

## 3. What changed in this pass

1. **`scripts/link-audit.ts` + `npm run links:audit`, wired into `npm run ci`.**
   Reads the route table from the router, extracts every literal internal link
   (`href="..."`, `href={...}`, `href: '...'`, `route: '...'`, `navigate(...)`,
   `window.location`), and fails on a target that is not a route, a prefix, a
   static file or an API path. Template literals are judged by their static head,
   so `` `/news/${slug}` `` needs `/news` to exist.
2. **`tests/link-audit.test.ts`** — 7 cases, including that the checker actually
   fails on a bad path (a checker that only ever passes is a lie) and that every
   link shape in the codebase is detected.
3. **Footer:** Accessibility, Disclaimer and Refunds added to the existing
   compact policy row.
4. **Sitemap:** `/refunds` added to the policy entries; `/accessibility` and
   `/disclaimer` were already there.
5. **Tests extended** so the three links and the sitemap entry cannot silently
   disappear: `tests/site-content.test.ts`, `tests/seo.test.ts`.

## 4. Standard-by-standard scorecard

| Standard | Applies to | Status | Evidence | Gap |
|---|---|---|---|---|
| **WCAG 2.2 AA** | All public pages | ✅ measured | axe over 28 declared pages on desktop + mobile in CI; `a11y:audit` 0 blocking; 44 px touch targets, visible focus, reduced motion, skip link, labelled controls asserted statically | No manual screen-reader pass; no real-device pass |
| **HTML semantics** | Shell + pages | ✅ measured | `lang="en"`, one `<main>`, one `h1` per page, landmarks, titled documents — asserted per page in `route-coverage` | No whole-document validator |
| **SEO — metadata** | 90 routes | ✅ measured | title + description on all 90; canonical on all 36 indexable; indexability agrees with the manifest (test) | 9 indexable titles > 60 chars, 6 indexable descriptions > 160 |
| **SEO — crawling** | Site | ✅ measured | `robots.txt` disallows admin/dashboard/api; sitemap built from static entries + database content, escaped, deduplicated, sorted | Production must serve the new 404 status (deploy) |
| **Core Web Vitals** | Public pages | ◐ budgeted, not lab-measured | JS byte budget per route fails the build; LCP/CLS/TBT budgets in the Playwright perf spec on a throttled mobile profile | No Lighthouse run, no field data (no RUM) |
| **Mobile** | All pages | ✅ measured | 320/360/768/1440 width assertions, overflow-safe pages, no hover-only interactions | Real low-end Android untested |
| **Security headers** | All responses | ✅ measured | HSTS, CSP, `X-Content-Type-Options`, referrer policy asserted in `tests/headers.test.ts` | — |
| **Privacy / consent** | All pages | ◐ | Cookie banner + preference centre; data inventory and retention documented | No consent record, no DPIA sign-off, minors' consent undecided |
| **Structured data** | Indexable pages | ✅ | JSON-LD per route in `seoMeta` (`Organization`, `WebSite`, `Article`, institution) | Not validated by a schema linter |

Legend: ✅ measured here or in CI · ◐ partly measured · ✗ not measured.

## 5. Page inventory

Grouped by pillar — the section that answers "is every page aligned with the
site's goals". `Browser` is the strongest assertion that exists for the page:
**full** = opened in Chromium, mobile and WebKit with `h1`/`main`/title/asset
assertions; **smoke** = declared and crawled after deploy only; **—** = no page
assertion. `In` = literal inbound links elsewhere in the source.

### Prepare (20)

| Route | Index | Browser | In | Note |
|---|---|---|---|---|
| `/cbt` | index | full | 27 | the most-linked page after home |
| `/cbt/setup/jamb` `/waec` `/neco` `/post-utme` | noindex | smoke | 2–3 | wizard steps; no browser assertion |
| `/cbt/practice` | noindex | — | 0 | redirect shim to the wizard — correct |
| `/cbt/results` | noindex | — | 1 | per-attempt result |
| `/past-questions` | index | full | 8 | |
| `/screening-calculator` | index | full | 10 | |
| `/calculator` | index → canonical | — | 0 | alias of the above |
| `/tools/cgpa-calculator` | index | full | 4 | |
| `/cgpa-calculator` | index → canonical | — | 0 | alias |
| `/tools` | noindex | smoke | 0 | placeholder |
| `/jamb` `/waec` `/neco` | index | full / smoke | 1 | exam hubs, linked from the services directory |
| `/nabteb` | noindex | smoke | 0 | placeholder |
| `/post-utme` | index | smoke | 2 | |
| `/results` | index | smoke | 0 | **F3** — duplicate, unlinked |
| `/search` | noindex | — | 0 | reached by the search box (F: no literal link) |

### Stay updated (2 + dynamic)

| Route | Index | Browser | In | Note |
|---|---|---|---|---|
| `/news` | index | full | 18 | `/news/:slug` covered by prefix + browser spec |
| `/events` | index | full | 1 | deadlines calendar |

### Find opportunities (3 + dynamic)

| Route | Index | Browser | In | Note |
|---|---|---|---|---|
| `/scholarships` | index | full | 7 | detail by slug |
| `/jobs` | index | full | 6 | detail by slug |
| `/nelfund` | index | smoke | 1 | |

### Find your school (1 + dynamic)

| Route | Index | Browser | In | Note |
|---|---|---|---|---|
| `/schools` | index | full | 7 | `/schools/:slug` in the prefix table |

### Get student support (4 + dynamic)

| Route | Index | Browser | In | Note |
|---|---|---|---|---|
| `/services` | index | full | 12 | `/services/:slug`, `/services/apply/:slug` |
| `/track` `/services/track` | noindex | — | 0 | legacy aliases |
| `/admission` | noindex | smoke | 0 | placeholder |

### Account (24)

All noindex, all behind `ProtectedRoute` except the auth screens.

| Route | Browser | Note |
|---|---|---|
| `/login` `/register` | full | `AuthPageV2`, one component five modes |
| `/forgot-password` `/reset-password` `/verify-email` | smoke | reached by email or redirect, never by a link — correct |
| `/signin` `/signup` | — | aliases |
| `/profile` `/profile/complete` | full / — | `/profile/complete` follows signup |
| `/settings` `/dashboard/settings` | full / — | alias pair |
| `/dashboard` + 5 tabs | full (some) | tab routes share one page |
| `/dashboard/applications` `/dashboard/requests` | — | legacy aliases of the services tab |
| `/dashboard/past-questions` `/dashboard/saved` `/dashboard/scholarships` `/dashboard/cbt/results` | — | canonicalised elsewhere |

### Trust & support (16)

| Route | Index | Browser | In | Note |
|---|---|---|---|---|
| `/about` `/contact` `/faq` `/reviews` | index | full | 2–10 | |
| `/privacy` `/terms` `/cookies` | index | full | 4–6 | |
| `/accessibility` `/disclaimer` `/refunds` | index | full / — | 1 | **F1 — linked for the first time here; `/refunds` added to the sitemap** |
| `/privacy-policy` `/terms-of-service` `/cookie-policy` `/contact-us` `/help` `/refund-policy` | alias | — | 0 | all canonicalise to the page above |
| `/support` | noindex | smoke | 0 | placeholder |

### Admin (18) — internal

No index, no browser assertion (**F5**), capability-gated server-side with
`tests/authorization.test.ts` as the enforcement evidence.

## 6. What is left, by who can do it

### For the owner (decisions or dashboard work)

1. **Decide `/results` (F3).** Link it and canonicalise the duplicate toward the
   URL you want ranked, or redirect it to `/services/results`. Right now it is
   indexed, unlinked and unlisted.
2. **Decide the placeholders (F9).** Keep `/admission`, `/support`, `/tools`,
   `/nabteb` as "coming soon", or remove them from the router until they ship.
3. **Apply `20261107120000` in production.** Until then readiness answers 503,
   post-deploy smoke cannot pass, and CBT v2 is unavailable to students — which
   is why the pages that depend on it are only partially validated.
4. **Run one live crawl after that deploy:**
   `npm run smoke -- https://edureachhub.netlify.app --pages` — it opens all 41
   declared pages and their endpoints and is the only check that sees the real
   deployment. It cannot pass today, for the reason above.
5. **Real-device pass (F6 in the standards table).** One Tecno, one Infinix, one
   iPhone SE, 2G throttled, on home, CBT session, results and services.
6. **Account and settings items carried from the compliance record:** Sentry +
   uptime accounts, leaked-password protection, Netlify variable re-scoping,
   one restore rehearsal, branch protection check.

### For me, buildable without you

1. **Browser assertions for the 13 smoke pages (F4)** — promote them to `full`
   where deterministic, and where the data is not deterministic, assert the shell
   and the state rather than skipping the page.
2. **A render test for the 18 admin routes (F5)** — one spec that opens each with
   an admin session and asserts it renders, is titled and has one `h1`.
3. **External link checker (F6)** — a scheduled workflow that resolves every URL
   in the opportunity and institution tables and opens an issue on a failure.
4. **Title and description pass (F8)** — shorten the 9 indexable titles and the
   6 indexable descriptions, then add a length limit to `tests/seo.test.ts` so a
   new page cannot join the site with a truncated title.
5. **HTML validation (F7)** — validate the built shell and the rendered DOM of
   one page per template.
6. **Lighthouse (F7)** — a budgeted run against the preview deploy, reported but
   not blocking until the budgets are calibrated.

## 7. How to re-run this audit

```bash
npm run links:audit          # every internal link against the router
npm run a11y:audit           # static accessibility rules
npm run routes:check         # route table vs router
npm test                     # includes seo, headers, footer, link-audit suites
npm run smoke -- <url> --pages   # the live crawl; needs a deployment
```

The page inventory in section 5 is generated from `src/app/pageManifest.ts`,
`src/app/routePaths.generated.ts` and `seoForPath()`, so it re-derives itself as
pages are added — nothing in it is hand-maintained except this prose.
