# Editorial release — scholarships, reviews, FAQ, question-bank console

Date: 2026-11-22 · Branch: `arena/ac491c2e-edureach-hub` (base `6e17a1c`)

This report covers the production functionality and content work. It distinguishes what was
proved in this checkout from what still depends on a hosted Supabase project: no `.env` or
service-role key is present here, so API behaviour against the hosted database was not exercised.

---

## 1. Changed files

### New migrations

| File | What it does |
| --- | --- |
| `supabase/migrations/20261122120000_editorial_lifecycle_reviews_admin_rpcs.sql` | Adds `opportunities.slug/published_at/expires_at/opens_at/status/award/study_level/verified_at`, a unique slug index, the `reviews` table (rating 1–5, text 20–1200, one per user, `pending/approved/rejected/hidden`), `review_rating_summary()`, `admin_set_user_role()`, `admin_question_bank_summary()` and the `review_moderation_queue` view. New table is server-only; both functions are `service_role` only. |
| `supabase/migrations/20261122121000_seed_verified_scholarships.sql` | Slug-keyed, idempotent seed of the five reviewed scholarship rows listed in §2. |

### Schema/testing artefacts

- `supabase/ci/production-validation.sql` — regenerated checklist, now 99 migrations; §9 names both
  new migrations and checks the new columns, table, view and functions.
- `docs/operations/BACKUP_AND_RESTORE.md`, `docs/operations/PRODUCTION_RUNBOOK.md` — migration set
  updated from 97 to 99 with the replayed object fingerprint (71 tables, 988 columns, 95 policies,
  71 tables with RLS).
- `scripts/rls-posture.ts` — `reviews` classified server-only.
- `lib/rate-limit.ts` — `reviewSubmit` (5 per hour).

### Server

- `server.ts`
  - Opportunity lifecycle: `lifecycleOf()` is now imported from `lib/opportunityLifecycle.ts`, the
    default feed and `scope=active` both exclude closed/scheduled rows, `scope=archive` returns
    expired + archived rows, and the three-tier column fallback keeps older databases serving.
  - Reviews: `GET /api/reviews` (approved only, paginated 9 + load-more, summary from
    `review_rating_summary()`), `POST /api/reviews` (authenticated `dashboard.access`, meaningful-use
    check, exact validation, duplicate 409, edits return to `pending`), `GET /api/admin/reviews`
    (`news.read`), `PATCH /api/admin/reviews/:id` (`news.update`, audit, 404 for missing row).
  - `GET /api/admin/question-banks` (`cbt.read`) reads `admin_question_bank_summary()` and maps a
    missing function to 503 with the migration named, never to zeros.
  - Role change now calls `admin_set_user_role`; the inline profile write and client-side path are
    gone. Suspension/unban endpoints are unchanged.

### Client and content

- New pages: `pages/ScholarshipsPage.tsx`, `pages/FaqPage.tsx`, `pages/ReviewsPage.tsx`,
  `pages/AdminReviewsPage.tsx`.
- New shared code: `lib/opportunityLifecycle.ts`, `lib/reviewPolicy.ts`, `src/lib/listingLifecycle.ts`,
  `src/lib/legalSections.ts`, `src/data/scholarshipSeed.ts`, `src/data/socials.ts`,
  `src/data/faq.ts`.
- New admin component: `src/components/admin/AdminQuestionBankOverview.tsx` (dashboard + CBT pages).
- CSS: `src/scholarships.css`, `src/faq.css`, `src/reviews.css`, appends to `src/admin.css` and
  `src/edu-portal.css` (footer social row, legal cards).
- Modified: `src/lib/api.ts` (lifecycle/review/bank clients), `src/lib/capabilities.ts`
  (`review.moderate`), `src/app/routes.tsx`, `src/lib/pageMeta.ts`, `src/lib/seoMeta.ts`,
  `src/server/seo.ts`, `src/components/HubLayout.tsx`, `pages/AdminLayout.tsx`,
  `pages/OpportunityDetailsPage.tsx`, `pages/JobsPage.tsx`, `pages/NewsPage.tsx`,
  `pages/HubHomePage.tsx`, `pages/LegalPage.tsx`, `pages/AboutPage.tsx`, `pages/RefundPolicyPage.tsx`,
  `src/components/SiteFooter.tsx`, `pages/CbtSessionPage.tsx` (inline save indicator).
- Tests changed/added: `tests/authorization.test.ts`, `tests/seo.test.ts`, `tests/site-content.test.ts`,
  `tests/perf.test.ts`, new `tests/editorial-surfaces.test.ts`.

---

## 2. Content added, removed and expiry dates

### Scholarships (`20261122121000` + offline mirror `src/data/scholarshipSeed.ts`)

| Slug | Provider | Deadline / expiry | State |
| --- | --- | --- | --- |
| `nnpc-totalenergies-national-merit-scholarship-2026` | NNPC / TotalEnergies (NMSS) | 2026-12-07 | published, open |
| `nnpc-snepco-national-university-scholarship-2026` | NNPC / SNEPCo | 2026-11-30 | published, closing soon |
| `nnpc-totalenergies-international-scholarship-2027` | TotalEnergies | 2027-01-31 | published, open |
| `aliko-dangote-foundation-undergraduate-scholarship` | Aliko Dangote Foundation | no deadline announced | published, stated as an announcement only |
| `mtn-foundation-scholarship-2026` | MTN Foundation | closed 2026-05-31 | **archived** (`is_active=false`) |

- Every live row carries `source_name`, `link_url` (https), `last_verified_at` and `verified_at`
  (2026-11-22). Amounts/awards are copied from the provider wording; ADF has no award or deadline
  because none was announced, and the card says so.
- No 2025 or expired 2026 listing is presented as open. Expired/archived rows leave the active feed
  and appear only through the archive (`scope=archive`, “Past deadlines”) or a direct link; nothing is
  deleted.
- The MTN 2026 cycle is kept as an archived record rather than deleted.

### FAQ

Seven groups with keyboard-operable accordions and a search field: Account, CBT simulator,
JAMB/WAEC/NECO/Post-UTME, Past questions, Scholarships, Payments and access, Privacy and security.
Every answer describes behaviour the application has; no feature is promised that does not exist.

### Reviews and ratings

No fake reviews and no hard-coded total. The page shows `Based on N approved reviews` from
`review_rating_summary()` and a truthful empty state when there are none. Submission requires a
signed-in student with at least one submitted CBT attempt or service request.

### Social presence

`VERIFIED_SOCIAL_LINKS` contains only the existing WhatsApp channel. Admin-added profiles are shown
only when they are `https` and each icon is named (`aria-label="EduReach on WhatsApp (opens in a new
tab)"`). Facebook/Instagram/X/TikTok icons are available but no handle was invented.

### Legal, About, Contact, refunds

Legal pages render one card per top-level `<h2>` (`splitLegalSections`), with the intro in its own
panel. About and Refund now sit in the same card container; Contact already renders through the
legal card system. No policy text was rewritten.

---

## 3. Question banks and the PDF pipeline

Migration-replay counts (`admin_question_bank_summary()` against a PGlite database built only from
the committed migrations, 2026-11-22):

| Exam | Questions | Approved | Needs review | Rejected | Subjects | First/last year |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| JAMB | 121 | 0 | 121 | 0 | 7 | 2026 / 2026 |
| WAEC | 32 | 0 | 32 | 0 | 6 | 2026 / 2026 |
| NECO | 27 | 0 | 27 | 0 | 5 | 2026 / 2026 |
| POST-UTME | 24 | 0 | 24 | 0 | 3 | 2026 / 2026 |
| EDUREACH | 10 | 0 | 10 | 0 | 1 | — |

These are the real seeded rows, not typed constants. That every seeded question is still
`needs_review` is the intended pipeline state: nothing is auto-published, and the console shows the
review counts rather than pretending the bank is approved. A replay fixture that inserted extra
approved rows changed the same figures immediately (JAMB 124 / WAEC 38 / NECO 30), proving the
console is reading rows rather than a stored total.

PDF import remains the staged `UPLOAD → EXTRACT → PARSE → REVIEW → EDIT → VALIDATE → APPROVE →
PUBLISH` pipeline (`question_imports` / `question_import_items` / `commit_question_import`, with
`past_question_sources` provenance in `exam_questions`). The pipeline is covered by the existing
migration and authorization suites; a hosted upload was **not** run because no Supabase credentials
are available in this checkout. The same PDF remains a student-facing Past Questions resource through
`document_bank`/`past_question_resources`; that link was not altered by this release.

`AdminQuestionBankOverview` is mounted on the admin dashboard and the CBT manager, reads
`/api/admin/question-banks`, shows per-exam counts, subject list, year range and last-updated time,
and displays an empty bank as empty. There are no literal counts in any admin component.

---

## 4. Roles, suspension and audit

Replayed on PGlite with real `profiles` rows:

- `admin_set_user_role(admin, student, 'content_editor')` returned
  `previous_role=student, new_role=content_editor`.
- `profiles.role` for the target changed to `content_editor`.
- `admin_audit_logs` received exactly one new row:
  `action=user_role_change`, `entity_type=profile`, metadata `{"from":"student","to":"content_editor"}`.
- The API still refuses a non-`super_admin` with 403, an unknown role with 400, and self-change with
  400 before any database call. These are asserted in `tests/authorization.test.ts`.
- Role changes are audited inside the same transaction as the write; the audit metadata contains no
  password, token or secret.
- Suspension/unban routes are untouched; their capability gates and audit calls still pass the
  authorization suite.

Authorization tests also verify a student cannot reach admin review routes, that moderation without
`news.update` is refused, and that a missing review is a 404 rather than a silent success.

---

## 5. Review moderation and rating calculation

Replayed on PGlite:

- Two `approved` reviews (5 and 3 stars) plus one `pending` review.
- `review_rating_summary()` returned `review_count=2, average_rating=4.00` — the pending row was
  ignored.
- `GET /api/reviews` selects from `review_moderation_queue` with `status=approved`, so unmoderated or
  rejected text never reaches the public page.
- Submitting with a duplicate user hits the one-per-user constraint and is mapped to 409; editing an
  approved review resets `status` to `pending` and clears the moderator fields, so an approved
  flattering review cannot be rewritten and stay approved.
- Moderation updates one row by id, records `review_approved` / `review_rejected` /
  `review_hidden` in `admin_audit_logs`, and returns 404 when the row does not exist.

---

## 6. Verification results

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass (0 errors) |
| `npm run lint` | 0 errors, 115 pre-existing `any` warnings |
| `npm run format:check` | pass |
| `npm test` | **1405 tests, 1405 pass, 0 fail** |
| `tests/migrations.test.ts` (PGlite replay) | pass |
| `tests/rls-posture.test.ts` | 7 pass |
| `npm run rls:audit` | 71 tables, 71 classified, 0 findings |
| `npm run schema:audit` | no blocking findings |
| `npm run a11y:audit` | 0 blocking findings, 8 informational |
| `npm run perf:audit` | every budget passes (see note below) |
| `npm run migrations:checklist` | all 99 migrations listed |
| `npm run backup:rehearsal` | 99 migrations, 6,000.1 KB archive, restored fingerprint identical |
| `npm run build` | pass (client + server bundle) |
| HTTP smoke (`npm run dev`) | `/`, `/scholarships`, `/faq`, `/reviews`, `/about`, `/contact`, `/refunds`, `/jobs`, `/admin/reviews` return 200; `/api/reviews` returns the truthful empty payload; `/api/admin/question-banks` returns 401 without a session |

Performance budgets were raised deliberately, with the old and new measurements recorded next to
each constant: critical path 214 → 220 KB (measured 216.0 KB; the new route CSS is bundled with the
rest of the stylesheet even though the routes are lazy) and total JS 402 → 432 KB (measured 417.1 KB
across 77 lazy chunks). The entry chunk is still 54.6 KB against its own 100 KB cap, and the
critical-path cap still fails if lazy code leaks into the first load. The `perf.test.ts` fixture was
moved from 216 to 226 KB so it continues to exercise the same over-budget traversal rule.

New focused tests in `tests/editorial-surfaces.test.ts` cover: server-clock lifecycle and feed
visibility, derived card labels, review validation/bounding, legal section splitting, FAQ structure,
seed invariants (unique slugs, https sources, archived MTN), API gate/audit/404 wiring, and the rule
that rating and question totals come from the API rather than literals.

---

## 7. Not verified here (honest gaps)

- No hosted Supabase project: review submission/moderation, role changes and question-bank RPCs were
  proved against a replayed schema, not a live project. The service-role key is absent by design.
- PDF upload → extraction → approval was not run end-to-end in this environment; the SQL/authorization
  behaviour is covered by the existing suites, but a staging upload is still required.
- Browser E2E and performance projects were not run (Playwright browsers are not installed here);
  component/static accessibility checks pass, and the production build succeeds.
