# 01 — Information Architecture

Route inventory taken from `src/app/routes.tsx` on the current branch. This
document is the map, not the wish list: a route appears here because it exists in
the renderer, and every route is classified so aliases cannot quietly multiply.

## Public

| Route | Renders | Purpose | Indexable |
|---|---|---|---|
| `/` | `HubHomePage` | Pillar entry point: search, services, updates | Yes |
| `/news` | `NewsPage` | Verified updates feed with category filters | Yes |
| `/news/:slug` | `NewsArticlePage` | Article detail with source, freshness, advisory | Yes |
| `/events` | `EventsPage` | Calendar items from `edureach_deadlines` | Yes |
| `/jobs` | `JobsPage` | Opportunities (scholarships, grants, jobs, fellowships, competitions) | Yes |
| `/scholarships` | `JobsPage` | Alias of `/jobs` filtered view | Canonicalise → `/jobs` |
| `/schools` | `SchoolFinderPage` | Institution directory (`institutions`) | Yes |
| `/schools/:slug` | `SchoolDetailsPage` | Institution detail | Yes |
| `/services` | `ServicesCatalogPage` | Service catalogue | Yes |
| `/services/:slug` | `ServiceApplyPage` | Service detail / entry, or honest coming-soon when no workflow exists | Yes |
| `/cbt` | `CbtPage` | Exam selection | Yes |
| `/past-questions` | `PastQuestionsPage` | Practice entry and material notes | Yes |
| `/jamb`, `/waec`, `/neco`, `/post-utme` | `ExamHubPage` | Examination hubs | Yes |
| `/nabteb` | `ComingSoonPage` | Declared, no content yet | No (noindex until real) |
| `/search` | `SearchPage` | Cross-entity search | No (noindex) |
| `/screening-calculator`, `/calculator` | `ScreeningCalculatorPage` | Screening aggregate tool | Yes (canonical `/screening-calculator`) |
| `/tools/cgpa-calculator`, `/cgpa-calculator` | `CgpaCalculatorPage` | CGPA tool | Yes (canonical `/tools/cgpa-calculator`) |
| `/admission`, `/admission/*`, `/tools`, `/tools/*`, `/support` | `ComingSoonPage` | Declared, no content yet | No (noindex until real) |

## Authentication (public, session-aware)

| Route | Renders | Purpose |
|---|---|---|
| `/login`, `/signin` | `AuthPageV2 mode="signin"` | Sign in |
| `/register`, `/signup` | `AuthPageV2 mode="signup"` | Create account |
| `/forgot-password` | `AuthPageV2 mode="forgot"` | Password recovery |
| `/reset-password` | `AuthPageV2 mode="reset"` | Set a new password |
| `/verify-email` | `AuthPageV2 mode="verify"` | Email verification |

## Student (authenticated)

Every route below is wrapped in `ProtectedRoute` and renders inside
`StudentDashboardV2` — one workspace with four tabs, not four separate pages.

| Route | Tab | Purpose |
|---|---|---|
| `/dashboard`, `/dashboard/notifications` | Overview | What matters now: updates, deadlines, requests, CBT, saved items |
| `/dashboard/services`, `/dashboard/applications`, `/services/track`, `/track` | My Requests | Service request tracking |
| `/dashboard/cbt`, `/dashboard/past-questions` | My CBT | Attempts, results, practice |
| `/dashboard/tools`, `/dashboard/saved` | Tools & Saved | Calculators and saved items |
| `/dashboard/cbt/results`, `/dashboard/cbt/results/:attemptId` | CBT result | Result detail |
| `/cbt/results`, `/cbt/results/:attemptId` | Public scorecard / saved attempt | Guest result or signed-in attempt |
| `/profile`, `/profile/complete`, `/dashboard/profile` | Profile completion | Academic profile |
| `/settings`, `/dashboard/settings` | Settings | Account preferences |
| `/services/apply/:slug` | Service wizard | Authenticated application flow (live slugs: `nelfund-loan`, `results`, `jamb-slip`, `admission-letters`) |
| `/cbt/setup/jamb|waec|neco|post-utme` | Setup | Subject selection and instructions |
| `/cbt/practice` | Attempt | Active CBT session |

## Administration (staff)

`/admin` and children render outside the student shell. Every one of these routes
is protected server-side by `requireAdmin`, not by the router.

| Route | Purpose |
|---|---|
| `/admin` | Operations dashboard |
| `/admin/analytics` | Usage analytics |
| `/admin/queue` | Service request queue |
| `/admin/cbt` | Exam and question-bank management |
| `/admin/news` | Newsroom CMS + ingestion review queue |
| `/admin/users` | Student accounts, suspension |
| `/admin/content` | Events and key dates |
| `/admin/opportunities` | Opportunities catalogue |
| `/admin/schools` | Institution catalogue |
| `/admin/services` | Service catalogue |
| `/admin/content-manager` | Bulk data import/export |

## Alias and redirect policy

Aliases increase SEO duplication, fragment analytics and confuse navigation. The
policy is one canonical URL per resource:

| Kind | Rule | Current examples |
|---|---|---|
| Canonical | One permanent public URL, indexable | `/news/:slug`, `/schools/:slug`, `/services/:slug` |
| Alias | Renders the same component; must emit `rel=canonical` to the canonical URL and must not be indexed separately | `/signin`, `/signup`, `/track`, `/calculator`, `/scholarships`, `/dashboard/applications` |
| Redirect | Replaces history; never indexed | `/dashboard/scholarships` → `/jobs` |
| Placeholder | Server-rendered but `noindex` until real content exists | `/nabteb`, `/admission`, `/tools`, `/support` |
| Internal | Never indexed, never linked publicly | `/cbt/practice`, `/cbt/results/*` |
| Admin | Never indexed, no public links | `/admin/*` |

Adding a route requires: a pillar, a canonical decision, an indexability decision,
and an entry in this table. A route added without them is a defect.

## Navigation model

| Surface | Behaviour |
|---|---|
| Public | Header with pillar navigation; search always reachable; mobile sticky compact nav; zero horizontal overflow at 360px |
| Student | Single workspace shell (`StudentDashboardV2`) with tab navigation; deep links resolve to the correct tab so a shared link opens the right place |
| Admin | Separate shell with its own navigation; never reachable from student navigation |

## Indexability summary

Index: `/`, `/news`, `/news/:slug`, `/events`, `/jobs`, `/schools`,
`/schools/:slug`, `/services`, `/services/:slug`, `/cbt`, `/past-questions`,
examination hubs, both calculators (via canonical).

Do not index: `/search`, `/admin/*`, all dashboard and profile routes, auth
routes, `/cbt/practice`, `/cbt/results/*`, alias paths, and placeholder pages.

SEO implementation status is tracked in `07-FEATURE-CATALOGUE.md` (SEO-1 is
🔴 — the repository has no `sitemap.xml`, no `robots.txt`, no per-route canonical
or structured data yet; `index.html` currently declares a single site-wide
`index,follow`).
