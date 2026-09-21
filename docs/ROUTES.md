# EduReach — Route Inventory & Quality Status

All application routes are registered centrally in `src/app/routes.tsx` and resolved dynamically in `src/app/App.tsx`.

## Canonical Route Table & Quality Status

| Route | Canonical Path | Primary Responsibility | Quality Gate Status |
|---|---|---|---|
| **Home** | `/` | Portal gateway, noticeboard, featured services | 🟢 PASS |
| **Services Catalog** | `/services` | Filterable academic service catalog | 🟢 PASS |
| **Service Apply** | `/services/apply/:slug` | Submit service application request | 🟢 PASS |
| **Service Tracker** | `/services/track` | Track application processing status | 🟢 PASS |
| **CBT Hall** | `/cbt` | Exam selection and practice starter | 🟢 PASS |
| **CBT Practice** | `/cbt/practice` | Active timed practice exam simulator | 🟢 PASS |
| **CBT Results** | `/cbt/results` | Scorecard corrections and answer review | 🟢 PASS |
| **Screening Calculator**| `/screening-calculator` | Admission screening aggregate estimation | 🟢 PASS |
| **News & Noticeboard** | `/news` | Campus news, JAMB/WAEC announcements | 🟢 PASS |
| **News Article** | `/news/:slug` | Full announcement article details | 🟢 PASS |
| **Scholarships / Grants**| `/jobs` | Student funding and scholarship directory | 🟢 PASS |
| **Sign In** | `/login`, `/signin` | Student login with password visibility | 🟢 PASS |
| **Register** | `/register`, `/signup`| Strict 8-field privacy-first registration | 🟢 PASS |
| **Password Recovery** | `/forgot-password` | Password recovery request form | 🟢 PASS |
| **Reset Password** | `/reset-password` | New password creation and confirmation | 🟢 PASS |
| **Email Verification** | `/verify-email` | Email verification notice and resend | 🟢 PASS |
| **Profile Onboarding** | `/profile/complete` | Post-registration academic profile setup | 🟢 PASS |
| **Student Dashboard** | `/dashboard` | Personal student workspace & tools | 🟢 PASS |
| **Admin Dashboard** | `/admin` | Operational admin overview | 🟢 PASS |
| **Admin Queue** | `/admin/queue` | Service request processing pipeline | 🟢 PASS |
| **Admin CBT** | `/admin/cbt` | CBT questions management | 🟢 PASS |
| **Admin Vouchers** | `/admin/vouchers` | Voucher and scratch card inventory | 🟢 PASS |
| **Admin Users** | `/admin/users` | Student profile records management | 🟢 PASS |
| **Admin Newsroom** | `/admin/news` | News write/edit/publish/delete CMS | 🟢 PASS |
| **Admin Analytics** | `/admin/analytics` | Metrics, audit and reports | 🟢 PASS |
| **Exam Hubs** | `/jamb`, `/waec`, `/neco`, `/post-utme` | Exam information centres | 🟡 REVISE |
| **Coming Soon** | `/nabteb`, `/support`, `/schools`, `/admission`, `/admission/*`, `/tools`, `/tools/*`, `/services/<inactive-slug>` | Honest placeholder panels for planned sections; each links to active services, tracker and noticeboard | 🟢 PASS |

## Routing Quality Criteria

1. **Deep Linking**: Direct browser navigation to any route above must resolve immediately to that page.
2. **Browser Titles**: `App.tsx` dynamically sets `EduReach — [Page Title]` on every route change.
3. **404 Handling**: Unmatched URLs render `<NotFoundPage />` with clear return links.
4. **Zero Page Redundancy**: No two routes perform the same function.
