# EduReach — Route Inventory & Quality Status

All application routes are registered centrally in `src/app/routes.tsx` and resolved dynamically in `src/app/App.tsx`.

## Canonical Route Table & Quality Status

| Route | Canonical Path | Primary Responsibility | Quality Gate Status |
|---|---|---|---|
| **Home** | `/` | Portal gateway, noticeboard, featured services | 🟢 PASS |
| **Services Catalog** | `/services` | Filterable academic service catalog with first-result search targeting | 🟢 PASS |
| **Site Search** | `/search?q=...` | Direct results across services, exams, CBT banks, materials, news and opportunities | 🟢 PASS |
| **Service Apply** | `/services/apply/:slug` | Submit service application request | 🟢 PASS |
| **My Requests** | `/dashboard/services` | Authenticated request history and status; `/services/track` and `/track` are protected compatibility aliases | 🟢 PASS |
| **CBT Hall** | `/cbt` | Exam selection and practice starter | 🟢 PASS |
| **Past Questions & Materials** | `/past-questions` | CBT question-bank mode plus configured PDF/DOC/material request mode | 🟢 PASS |
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
| **Profile & Edit Profile** | `/profile`, `/profile?edit=1`, `/profile/complete` | Saved student details with explicit edit mode and Supabase/local persistence | 🟢 PASS |
| **School Finder** | `/schools`, `/schools/:slug` | Maintained institution search, autocomplete, honest detail destinations | 🟢 PASS |
| **Student Dashboard** | `/dashboard` | Personal student workspace, request history, CBT resume and tools | 🟢 PASS |
| **Admin Overview** | `/admin` | Control-centre overview: live queue/users/traffic KPIs, needs-attention actions, staff audit trail, 14-day attention analytics | 🟢 PASS |
| **Admin Queue** | `/admin/queue` | Service request processing pipeline | 🟢 PASS |
| **Admin CBT** | `/admin/cbt` | CBT questions management | 🟢 PASS |
| **Admin Users** | `/admin/users` | Student profile records management | 🟢 PASS |
| **Admin Newsroom** | `/admin/news` | News write/edit/publish/delete CMS with rich-text editor, image upload, drafts and preview | 🟢 PASS |
| **Admin Events & Key Dates** | `/admin/content` | Deadlines and exam dates CRUD feeding /events and the home noticeboard | 🟢 PASS |
| **Admin Schools** | `/admin/schools` | Institutions CRUD feeding the public School Finder | 🟢 PASS |
| **Admin Services Catalogue** | `/admin/services` | Service catalogue visibility/content management (four supported keys) | 🟢 PASS |
| **Admin Analytics** | `/admin/analytics` | Metrics, real traffic/attention telemetry, audit and reports | 🟢 PASS |
| **Exam Hubs** | `/jamb`, `/waec`, `/neco`, `/post-utme` | Exam information centres | 🟡 REVISE |
| **Coming Soon** | `/nabteb`, `/support`, `/admission`, `/admission/*`, `/tools`, `/tools/*`, `/services/<inactive-slug>` | Honest unavailable panels for planned or unconfigured sections; each keeps active services, noticeboard and direct support available | 🟢 PASS |

## Routing Quality Criteria

1. **Deep Linking**: Direct browser navigation to any route above must resolve immediately to that page.
2. **Browser Titles**: `App.tsx` dynamically sets `EduReach — [Page Title]` on every route change.
3. **404 Handling**: Unmatched URLs render `<NotFoundPage />` with clear return links.
4. **Zero Page Redundancy**: No two routes perform the same function.
