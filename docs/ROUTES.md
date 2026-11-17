# Routes

Every path is resolved in `src/app/routes.tsx` by `renderRoute(pathname)`. A
trailing slash is ignored and unmatched paths render `NotFoundPage`.

## Public

| Path | Screen |
| --- | --- |
| `/` | Home: services, noticeboard, featured content |
| `/login`, `/signin` | Sign in |
| `/register`, `/signup` | Create an account |
| `/forgot-password` | Request a password reset |
| `/reset-password` | Set a new password |
| `/verify-email` | Email verification notice |
| `/services` | Service catalogue |
| `/services/:slug` | Service application, or the coming-soon panel when the service is not live |
| `/services/apply/:slug` | Application form for a live service |
| `/nelfund`, `/results` | Short links to the two most used forms |
| `/services/track`, `/track` | Signed-in only; renders the dashboard request list |
| `/news` | News feed |
| `/news/:slug` | Article |
| `/jobs`, `/scholarships` | Opportunities catalogue |
| `/jobs/:id` | Opportunity detail |
| `/schools` | School finder |
| `/schools/:slug` | Institution detail; resolves by canonical `id` when present, otherwise by slug, legacy slug or acronym (see `docs/data/INSTITUTION-FRONTEND-CONTRACT.md` §5) |
| `/events` | Deadlines and exam dates |
| `/cbt` | Practice: every published CBT simulator, one card each |
| `/cbt/setup/:exam` | Session setup for `jamb`, `waec`, `neco` or `post-utme` |
| `/cbt/session/:attemptId` | Active session |
| `/cbt/results`, `/cbt/results/:attemptId` | Result and answer review |
| `/past-questions` | Past-question papers and material requests (linked from Practice; not a primary tab) |
| `/screening-calculator`, `/calculator` | Screening aggregate calculator |
| `/tools/cgpa-calculator`, `/cgpa-calculator` | CGPA calculator |
| `/jamb`, `/waec`, `/neco`, `/post-utme` | Exam hubs |
| `/search` | Site search |
| `/u/:slug` | Opt-in public student profile (academic identity only; not indexed) |

## Signed in

| Path | Screen |
| --- | --- |
| `/dashboard` | Overview: the student's own homepage (preparation focus, selected exams, CBT quick access, recent activity, results summary, progress, selected institutions, notifications) |
| `/dashboard/cbt` | CBT: the same simulator hub as `/cbt`, plus a resume card for an unfinished paper |
| `/dashboard/results` | Results: completed sessions, scores, answer review and performance analysis |
| `/dashboard/results/:attemptId` | One saved result |
| `/dashboard/profile` | Profile: personal, academic, account, preferences, public profile, privacy and data |
| `/dashboard/tools`, `/dashboard/saved` | Tools and saved items (existing utilities only) |
| `/dashboard/services`, `/dashboard/applications`, `/dashboard/requests` | Request history (secondary) |
| `/dashboard/notifications` | Notifications (secondary) |
| `/dashboard/settings`, `/settings` | Account settings |
| `/profile`, `/profile/complete` | The same profile page, outside the dashboard shell (onboarding) |

Legacy paths redirect rather than 404:

| Old path | Redirects to |
| --- | --- |
| `/dashboard/cbt/results`, `/dashboard/cbt/results/:attemptId` | `/dashboard/results`, `/dashboard/results/:attemptId` |
| `/dashboard/past-questions` | `/past-questions` |
| `/dashboard/scholarships` | `/jobs` |

The dashboard's five primary destinations are Overview · CBT · Results ·
Profile · Tools. Service requests, notifications, help and account utilities sit
in secondary navigation. A shared profile link uses `/u/:slug`.

## Admin

All admin paths require a signed-in staff account with the matching capability.
`/admin` itself is the overview.

| Path | Screen |
| --- | --- |
| `/admin` | Queue, users, traffic and content KPIs |
| `/admin/queue` | Service request processing |
| `/admin/cbt` | Question bank and exam configuration |
| `/admin/news` | News CMS |
| `/admin/content` | Events and key dates |
| `/admin/opportunities` | Opportunity catalogue |
| `/admin/schools` | Institution catalogue |
| `/admin/services` | Service catalogue |
| `/admin/users` | Student accounts |
| `/admin/analytics` | Traffic and usage analytics |
| `/admin/content-manager` | Bulk content tables |
| `/admin/pdf-bank` | Past-question documents |
| `/admin/question-imports` | Upload a past paper, review extracted questions, save approved ones |

## Placeholders

`/nabteb`, `/support`, `/admission` and `/admission/*`, `/tools/*` and any
`/services/:slug` without a live workflow render `ComingSoonPage`. These paths
are excluded from the sitemap and from search indexing.
