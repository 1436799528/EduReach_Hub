# EduReach Hub — master audit (Stage 2)

**Date:** 20 October 2026
**Repository:** `1436799528/EduReach_Hub`, branch `arena/7365cc64-edureach-hub`
**Audited head:** `b0d296a` (Phase 1 and Phase 5 already applied on top of `29fb949`)
**Live site:** https://edureachhub.netlify.app (viewed as a visitor; no production writes)
**Supabase project:** `gjdfatwcoosyuhakrrhh` (migrations read from the repository; no live access from this environment)

This is the Stage 2 deliverable: what is wrong, in what order, with the evidence
that proves it. It is written to be acted on, so every finding carries a status
and the phase that closes it. Nothing here is inferred from memory or from an
earlier report; each claim is tied to a file, a command or a test result.

---

## A. How this audit was done

| Evidence | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | clean (exit 0) |
| Unit/integration tests | `npm test` | **583 tests, 583 pass, 0 fail** |
| Schema replay | `npm test` → `tests/migrations.test.ts` | all 70 migrations apply to a real PostgreSQL (PGlite 18.3) |
| Static schema check | `npm run schema:audit` | no blocking findings |
| RLS posture | `npm run rls:audit` | 45/45 public tables classified, 0 findings |
| Accessibility (static) | `npm run a11y:audit` | 0 blocking, 4 informational |
| Performance budget | `npm run perf:audit` | 10/10 |
| Production build | `npm run build` | exit 0, CSS 293.81 kB (50.82 kB gzip), entry 96.2 kB gzip |
| Dependency audit | `npm audit --audit-level=low` | **was failing** (1 moderate) → fixed in `b0d296a`, now 0 |
| Routes | `src/app/routes.tsx` read in full | 54 path checks; four route families and unconfigured service slugs render `ComingSoonPage` |
| Browser E2E | `npm run test:e2e` | **not run here** — no Chromium in this sandbox. CI installs it and runs the same suite |

Two things this environment cannot do, stated plainly rather than worked around:
there are no Supabase credentials (so nothing was executed against the hosted
database), and there is no browser (so layout, focus order and the rendered
dialog stack were verified by reading code, by JSDOM where the DOM semantics
allow it, and by the CI E2E suite, not by hand).

---

## B. What this audit found, by severity

`S` = severity. Status: **fixed** (in this branch), **open** (scheduled to a
later phase), **accepted** (decision recorded), **blocked** (needs a credential
or a human).

### Critical

| ID | Finding | Evidence | Status |
|---|---|---|---|
| C-1 | **Deleting a CBT result left a modal dialog in the browser top layer.** `CbtHistoryPanel.remove()` cleared React state but never called `dialog.close()`, so the confirmation vanished while its backdrop kept the page unclickable, and `onClose` (the only code that clears the selection) never fired. | `src/components/CbtHistoryPanel.tsx` before `bfafa9d`; reproduced by `tests/cbt-delete-dialog.test.ts` against the old component (2 failures) | **fixed** (`bfafa9d`) |
| C-2 | **The install gate is red.** `npm run ci` ends in `npm audit --audit-level=low`, which exited 1 on GHSA-698v-4r3x-3vcv (vite ≤ 6.4.3, Windows launch-editor argument escaping). A red gate is worse than no gate: it invites bypass. | `npm run audit:ci; echo $?` → 1 | **fixed** (`b0d296a`, vite 6.4.4, audit clean) |

### High

| ID | Finding | Evidence | Status |
|---|---|---|---|
| H-1 | **No legal pages exist.** `/terms`, `/privacy`, `/cookies`, `/contact` and `/accessibility` are not routes; they render `NotFoundPage`. The footer links for Contact, Privacy and Terms are `href="#"`, which scrolls to the top and looks like a broken button. A Nigerian service that collects names, schools, matric numbers and JAMB registration numbers cannot ship without them. | `src/app/routes.tsx` (no such paths); `src/components/HubLayout.tsx:493-495` | open → Phase 9 |
| H-2 | **The footer is hardcoded and partly false.** Brand, links, help destination and copyright live in JSX with inline styles; there is no social configuration, no legal links, no contact details and no way for an administrator to change any of it. | `src/components/HubLayout.tsx:479-500` | open → Phases 7–8 |
| H-3 | **No site-content source of truth.** Branding, footer copy, contact details, social URLs and policy pages cannot be edited from the admin portal because no table stores them. Every migration search for `site_settings`/`site_pages` returns nothing. | `grep -rn "site_settings\|site_pages" supabase/migrations` → empty | open → Phase 7 |
| H-4 | **Admin console can be entered on a self-asserted role.** `verifyAdminSession()`'s offline fallback reads `authSession.user.user_metadata.role`, which any signed-in user can write to their own account. Every API call still re-authorises, so this is not data access — but it contradicts the comment directly above it ("never derive capabilities from anything the browser stored") and it shows a student an admin shell. | `pages/AdminLayout.tsx:114` | open → Phase 7 |
| H-5 | **Dashboard claims measurements it does not have.** With no completed attempts, "Average score" and "Best score" render `0%` — a measurement of nothing. With attempts, the figures are honest. | `pages/StudentDashboardV2.tsx:451-452, 793-794` | open → Phase 6 |
| H-6 | **Results cannot be deleted from the dashboard, never paginate, and are fetched by the browser directly.** The My CBT tab reads 50 attempts straight from PostgREST and renders them all with review/resume links only; the only delete path is the panel on `/cbt`. | `pages/StudentDashboardV2.tsx:313, 579-612, 786-800` | open → Phase 6 |

### Medium

| ID | Finding | Evidence | Status |
|---|---|---|---|
| M-1 | **The homepage hero promoted a duplicate journey.** Eyebrow "CBT practice", headline, paragraph and two CTAs repeated what the exam grid and the Study Centre card already do, and pushed the search bar and the cards below the fold on a phone. | `pages/HubHomePage.tsx` before `566bfb3` | **fixed** (`566bfb3`, CSS −0.5 kB gzip) |
| M-2 | **A page without a heading is not a fix for a redundant hero.** Removing the section also removed the only `h1`. The homepage now carries one visually-hidden `h1`, which is what it used before the simulator rewrite. | `pages/HubHomePage.tsx:65-68`; pinned by `tests/site-experience.test.ts` | **fixed** (`566bfb3`) |
| M-3 | **Empty or unapproved banks are not blocked at the UI layer everywhere.** The setup wizard uses `cbt_subject_availability()` counts and the server refuses a paper it cannot fill, but the dashboard's "Start practice" and the exam grid still invite a student in before the count is known. The refusal is honest, the invitation is not. | `src/lib/cbt-config.ts:232-258`; `pages/StudentDashboardV2.tsx:786-798`; migration `20261022090000` | open → Phases 6, 7 |
| M-4 | **Search is a literal substring match.** `"jamb slip"` does not find "JAMB…slip", and a fingerprint of punctuation (`"JAMB?"`) finds nothing. Case is handled; word order and punctuation are not. | `pages/SearchPage.tsx:84-87` | open → Phase 10 |
| M-5 | **Search silently loses live results on failure.** `fetchNews/fetchCbtExams/fetchOpportunities` are each `.catch(() => [])`, so a backend outage produces a confident "nothing matches" instead of "some results could not be loaded". | `pages/SearchPage.tsx:113-119` | open → Phase 10 |
| M-6 | **`/nabteb`, `/admission`, `/tools` and `/support` render a coming-soon panel while being linked as if live** from the services catalogue and identity marks. Honest, but the navigation advertises something the product does not do. | `src/app/routes.tsx:136`; `src/data/services.ts:19` | open → Phase 7 (nav review) |
| M-7 | **`.env.example` is incomplete.** `EDUREACH_ADMIN_BOOTSTRAP_EMAIL`, `EDUREACH_SMOKE_URL`, `DISABLE_HMR`, `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_KEY` aliases and `EDUREACH_SITE_URL` are read by code but undocumented there. A new operator cannot configure a working deployment from the file. | `grep process.env` vs `.env.example` | open → Phase 14 |
| M-8 | **The delete confirmation duplicated its success path.** Deletion closed through two different mechanisms (React state and the `close` event) and an error was shown in the page notice behind a modal that stayed open. | `src/components/CbtHistoryPanel.tsx` | **fixed** (`bfafa9d`, one close path, error inside the dialog) |

### Low

| ID | Finding | Evidence | Status |
|---|---|---|---|
| L-1 | The dashboard's saved-item rollback restores a failed deletion to the **front** of the list rather than its original position. | `pages/StudentDashboardV2.tsx` `removeSaved` | open → Phase 6 |
| L-2 | `CbtHistoryPanel` reloads on every window `focus`, which re-renders the panel when a student tabs back from a password manager. | `src/components/CbtHistoryPanel.tsx:63-64` | accepted — it keeps history fresh after a session in another tab |
| L-3 | Six `<img>` elements declare no intrinsic `width`/`height`, so they can shift layout before load; three declare no `loading` attribute. All nine have `alt`. | `grep '<img' pages src` | open → Phase 11 |
| L-4 | Two informational a11y notes remain: decorative `alt=""` images (confirmed labelled beside), and 23 `outline` resets all attributed to a visible focus indicator. | `npm run a11y:audit` | accepted (documented in A11Y-1) |
| L-5 | Working tree noise: `build/`, `dist/` are untracked and ignored, but both exist on disk after a build; `git status` is clean. | `git status --short` | accepted |
| L-6 | `pageTitleFor` and `applyRouteSeo` cover the public routes; the new legal routes must be added there or they inherit a generic title. | `src/lib/pageMeta.ts`, `src/lib/seoMeta.ts` | open → Phase 9 |

### Verified good (do not "fix")

These were checked because a rewrite would be tempting, and rewriting working
security code is how projects lose it:

- **Role resolution is server-side and fail-closed.** `lib/auth.ts` resolves capabilities only from `profiles.role`, refuses on a profile read error, and never consults `user_metadata`. Column-level grants (`20260903_restrict_profile_client_columns.sql`) stop a student writing `role` to their own row; no later migration re-grants it.
- **CBT deletion is ownership-checked in the database.** `delete_cbt_attempt(uuid)` is `security definer`, `set search_path = ''`, selects `for update` by `id AND user_id`, and the server passes the caller's token, not the service role.
- **Question serving honours editorial state.** Rejected questions are excluded from availability, planning and every paper; `needs_review` items are served *and labelled* as unverified practice material (migration `20261022090000`).
- **Rich HTML is sanitised on the render side** with an allowlist, safe URL schemes and `rel="noopener noreferrer nofollow"`. Both `dangerouslySetInnerHTML` call sites pass through it.
- **Uploads check the bytes, not the label.** Image and PDF signatures are verified server-side after capability checks; 2 MB image cap; no `data:` blobs in stored content.
- **PostgREST filter injection is handled** in every `or()`/`ilike()` built from user input (`server.ts:352, 1104`).
- **CSP, HSTS, nosniff, frame-ancestors, Referrer-Policy** are set both by Express and by `public/_headers`, and the production CSP has no `unsafe-inline` for scripts.
- **Deployment topology is coherent:** `dist` publish dir, `/*` → `index.html` last, `/api/*` → function first, `/robots.txt` and `/sitemap.xml` before the SPA fallback, hashed assets immutable, `index.html` no-store.

---

## C. Backend and data audit (brief phase 4)

### Schema and migrations

- 70 migrations, applied in filename order by `tests/migrations.test.ts` against a real PostgreSQL 18.3 (PGlite), with Supabase's `auth`/`storage` surface shimmed. A syntax error, a bad policy or a broken `do` block fails the suite.
- The baseline (`20260830000000`) is deliberately conservative: it enables RLS only where the repository defines policies, creates fail-closed stubs for two legacy routines it does not have the bodies for, and reports rather than guesses.
- Column-level grants restrict what a signed-in student may write to `profiles`: `full_name, school, faculty, department, level, session, matric_number` only.
- Foreign keys on student-owned data cascade from `profiles(id)` (`student_saved_items`, `student_notifications`, `student_cgpa_*`, `service_requests`), and `cbt_answers.attempt_id → cbt_attempts(id) on delete cascade`. `cbt_attempts.user_id` references `auth.users(id)` directly, which is the account-deletion path; `admin_audit_logs.admin_user_id` uses `on delete restrict` so an audit trail cannot be erased by removing a staff account.
- One-attempt-in-progress per user/exam is enforced by a partial unique index (`cbt_attempts_one_in_progress_per_user_exam`), so a double-tap cannot start two papers.
- `cbt_answers` is unique on `(attempt_id, question_id)`; `exam_questions` is unique on `(exam_id, position)`.

### RLS (45 tables, 45 classified)

- Browser-readable: `profiles` (own row), `service_requests` (own rows), `student_saved_items`, `student_notifications`, `student_cgpa_*` (own rows), `institutions`, `news_articles`, `opportunities`, `service_catalog`, `past_question_resources` (published rows only).
- Server-only (RLS on, no client grants): `exam_questions`, `cbt_attempts`, `cbt_answers`, `question_imports`, `question_import_items`, `payment_events`, `rate_limit_hits`, `site_analytics_events`, `admin_audit_logs`, `edureach_audit_logs`.
- Deny-by-default: `courses`, `resources`, `news_ingest_*`, `scheduled_job_runs`, `national_programme_catalogue`.
- **Tested as `anon`, `authenticated` and `admin`** in `tests/past-question-resources.test.ts` and `tests/rls-posture.test.ts` using `set role` plus `request.jwt.claim.sub`, which is how Supabase's `auth.uid()` resolves.

### Deletion behaviour

- Account-owned rows cascade from `profiles`.
- CBT attempts are deleted only through the ownership-checked RPC; the API maps "not found" to 404 rather than confirming whether another student's attempt exists.
- Students may delete their own practice **and** mock attempts. The UI offers deletion only for finished sessions; the RPC also permits an owner to discard an in-progress attempt, which is the same thing as abandoning a paper and is harmless.

### Gaps found in this phase

1. **No table for admin-managed site content** (H-3). This is the single structural gap that blocks Phase 7, 8 and 9.
2. **No revision history for any content that is not news.** `admin_content_versions` covers news only; policy pages will need their own history or a shared one.
3. **`institutions` is public-read in full**, including `admission_portal_url`, `post_utme_source_url` and verification flags. That is intended (a school directory), but it means any future private column must be added to a view, not to this table.

---

## D. Phase-by-phase readiness

| Phase | State after this branch | What remains |
|---|---|---|
| 1 Hero cleanup | **done** (`566bfb3`) | — |
| 2 Full audit | **this document** | keep it current as later phases land |
| 3 Humanise copy | largely already done in earlier work; no AI-tell phrases match (`seamless/elevate/empower/unlock/journey/…` → 0 hits) | copy pass over the new admin and legal screens |
| 4 Backend audit | **done above**; one structural gap (site content) | migration for site content + revisions |
| 5 Delete result modal | **done** (`bfafa9d`, regression test) | dashboard delete path (Phase 6) |
| 6 Student dashboard | not started in this round | honest empty states, review/delete, pagination, saved-item rollback position |
| 7 Admin as source of truth | blocked on H-3 | site settings + policy editor + capability-gated API, remove `user_metadata` fallback |
| 8 Footer | blocked on H-3 | replace hardcoded footer, URL validation, real legal links |
| 9 Legal pages | blocked on H-3 | six real routes, NDPA-aware drafts, revision history, footer links |
| 10 Navigation/search | partially done | punctuation/word-order matching, partial-failure states, `/nabteb` honesty |
| 11 Security/perf/a11y | reviewed; no critical gaps | image dimensions, 320 px verification |
| 12 Testing | 583/583, schema and RLS exercised, E2E exists but **not run here** | add scenarios for legal/footer; run E2E in CI |
| 13 Deployment validation | static review complete | live Netlify/Supabase checks are **blocked** (no credentials) |
| 14 Documentation | README and ops docs exist and are unusually good | env table, legal-content runbook, this audit |

---

## E. Security, privacy and accessibility notes

- **No tracking cookies.** Analytics writes one `sessionStorage` UUID per tab and posts an event with a path, a sanitised referrer and declared metadata only — never what a student typed. There is no third-party script and no ad pixel. A cookie banner would therefore be claiming a problem the site does not have; the privacy policy must describe the first-party event log instead.
- **No secrets in the repository or the bundle.** The service key is read only in server files (`lib/supabase-config.ts`, `lib/auth.ts`, `server.ts`); the browser client uses the publishable key and a fake fallback host when unconfigured, and `scripts/client-env-check.ts` fails a production build when the client variables are missing.
- **Data collected from a student:** name, email, school, faculty, department, level, matric/JAMB number (optional), service-request details and uploaded documents, CBT answers and scores, saved items, CGPA entries. Each of these has a table and an owner-only RLS policy.
- **Accessibility:** one `h1` per rendered view, skip link, visible two-tone focus ring, 44 px touch targets on primary controls, reduced-motion honoured, no colour-only status, contrast documented in `docs/features/UI-4.md` (only the disabled-text pair is below 4.5:1, which WCAG exempts).
- **Performance:** entry 96.2 kB gzip (budget 100), CSS 49.6 kB (budget 51), route-level splitting keeps the admin console out of the student bundle, every image decisioned in the perf audit.

---

## F. What would make this NOT READY today

1. A public site with no privacy policy, terms or contact route while collecting identity documents (**H-1**).
2. A footer whose Contact/Privacy/Terms links are `#` (**H-1**, **H-2**).
3. Admin-managed content that only a developer can change (**H-3**).
4. Dashboard figures that read as measurements when nothing has been measured (**H-5**).

Everything else is either fixed, low, or a documented limitation.

---

## G. Deployment decision (interim)

**NOT READY** at `b0d296a`. The blockers are the four in section F, and three of
them are the same missing feature: admin-managed site content. Phase 7–9 will
close them; the final verdict is recorded in `docs/DEPLOYMENT_DECISION.md` after
Stage 5, and it will say which items are verified and which are not.
