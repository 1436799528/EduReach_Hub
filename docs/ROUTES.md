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
| `/schools/:slug` | Institution detail |
| `/events` | Deadlines and exam dates |
| `/cbt` | CBT hall |
| `/cbt/setup/:exam` | Session setup for `jamb`, `waec`, `neco` or `post-utme` |
| `/cbt/session/:attemptId` | Active session |
| `/cbt/results`, `/cbt/results/:attemptId` | Result and answer review |
| `/past-questions` | CBT bank and material requests |
| `/screening-calculator`, `/calculator` | Screening aggregate calculator |
| `/tools/cgpa-calculator`, `/cgpa-calculator` | CGPA calculator |
| `/jamb`, `/waec`, `/neco`, `/post-utme` | Exam hubs |
| `/search` | Site search |

## Signed in

| Path | Screen |
| --- | --- |
| `/dashboard` | Overview |
| `/dashboard/services`, `/dashboard/applications` | Request history |
| `/dashboard/cbt`, `/dashboard/past-questions` | Practice history |
| `/dashboard/cbt/results/:attemptId` | Saved result |
| `/dashboard/tools`, `/dashboard/saved` | Tools and saved items |
| `/dashboard/notifications` | Notifications |
| `/dashboard/settings`, `/settings` | Account settings |
| `/profile`, `/profile/complete`, `/dashboard/profile` | Profile |

`/dashboard/scholarships` redirects to `/jobs`.

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
