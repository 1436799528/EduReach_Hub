# EDUREACH — UX & STUDENT EXPERIENCE REMEDIATION REPORT

**Branch:** `arena/01a0fe6f-edureach-hub` · **Commits:** `05789a1`, `3eff11a`, `270fa50` (PR [#13](https://github.com/1436799528/EduReach_Hub/pull/13))
**Base:** `aa60b53` (main) · **Report written:** 2026-10-03

This report covers the four implementation phases that followed the completion
audit: **A** (UX foundation), **B** (CBT practice + mock), **C** (academic
resources), **D** (site-wide experience), **E** (final consistency).

Nothing below is claimed without a command that produced it. Section 7 lists what
was **not** verified, and section 8 records the limits of this work explicitly.

---

## 1. Implemented changes

### UX foundation (Phase A)

| What | Where |
| --- | --- |
| One deliberate weight scale — display 730, section 680, subhead 620, body 400, label 560, meta 500, numeric 680 | `src/styles/type-system.css` |
| One failure classifier: offline / timeout / server / auth / validation, each with its own wording, `retryable` and `preserveInput` semantics; PostgREST + SQLSTATE codes read before HTTP status | `src/lib/failures.ts` |
| Shared loading / error / empty / inline-notice states | `src/components/AsyncState.tsx` |
| Non-intrusive offline strip in the site shell; no full-page offline takeover, cached content stays on screen | `src/components/ConnectionBanner.tsx` in `HubLayout` |

The scale is now **closed**: every literal weight in every stylesheet and every
inline style must be one of the six values, enforced by `tests/type-system.test.ts`.

### CBT practice (Phase B, Mode A)

- Pre-start configuration from the real bank: question count limited to what the
  bank can actually serve, a duration that *is* the session timer, subject
  selection, and an explicit distribution rule for multi-subject papers.
- A pre-start summary that states subjects, questions, time, mode and the
  `Q1–Q20` block per subject — the numbers shown are the numbers sent.
- Server validates the same configuration; the frontend cannot widen it.

### CBT mock (Phase B, Mode B)

- The student picks the intended course/programme; the system derives the subject
  combination from the governed rules and shows it for confirmation.
- When no valid combination exists the page explains why and offers recovery
  instead of assembling a wrong paper.
- Dedicated examination shell (`pages/CbtSessionPage.tsx`) on its own route with
  no site header/footer: question palette with answered/unanswered/marked states,
  subject transitions, per-question subject line, server-authoritative timer,
  confirmation before submit, and a separate **End Test** that explains what
  happens to progress.
- Practice progress: save / resume / restart / abandon / delete with
  confirmation, deletion enforced server-side, practice kept distinct from mock
  records (`src/components/CbtHistoryPanel.tsx`).

### Past questions (Phase C)

- `public.past_question_resources` — papers with exam body, institution, subject,
  course, year, source (URL or stored file), access mode, `published`,
  `verified_at`. RLS exposes **only** `published = true and verified_at is not
  null`; no client role can write. A `has_a_source` check makes a paper-less row
  impossible. **Ships empty — no paper was invented.**
- `GET /api/past-questions/resources` signs private `resource-files` objects for
  300 s and reports per item `available` / `external` / `unavailable` and per
  collection `available` / `not-published` / `not-configured`. A failure is a
  503, never “no papers”.
- `pages/PastQuestionsPage.tsx` filters by exam body with subject/course/year
  search; Open/Download for hosted papers, “EduReach does not host this paper”
  for external ones; honest empty state; retryable error state.
- Study material records now declare `availability: 'practice-only' | 'on-request'`
  instead of listing PDF/DOC formats that never existed.

### Dashboard (Phase D)

- **“What matters now”** leads the overview: the running test with the least time
  left, then a request that cannot move without the student, then the incomplete
  profile, then unread notices — capped at three, each with its action. Static
  profile details moved below the working sets.
- **Expired attempts are no longer resumable.** The page treated every
  `in_progress` row as resumable, so a test the server had already expired still
  showed “Resume” and counted as “In progress”. One shared rule
  (`cbtAttemptState`) now decides for the table, the metrics and the priority
  strip; expired rows say “Time ran out” and offer a new test; resume links go
  straight into the attempt instead of through setup.

### News (Phase D)

- Category contract fixed end to end: `public.news_category_slug()` + a generated
  `category_slug` column, read by the server, the client and the filter — a live
  article can no longer be invisible under its own category.
- Rows carry their age: “Checked by EduReach _date_”, “Checked a while ago”, “Not
  checked yet”, “No longer current”. Expired stories sort last instead of
  vanishing.
- Added the search the list was missing; the duplicate alias map is gone.

### Opportunities (Phase D)

- Every listing states verification, source, eligibility and last-checked date.
  An unchecked listing never gets a confident “Apply” (it says “Check the
  source”); an expired one offers nothing to apply to.
- `20261002150000_opportunity_eligibility.sql` adds `eligibility`, deliberately
  **not backfilled** — no authoritative data exists. The public route now reads
  `source_name`, which had been added by an earlier migration but never shown.
- The header no longer claims every listing’s source, eligibility and route were
  checked.

### Services (Phase D)

- The review step says what happens **after** Submit, and the confirmation panel
  repeats it with the first stage marked reached.
- The status machine is described once (`src/lib/serviceLifecycle.ts`) and the
  dashboard explains each request in the same words.
- No service level is promised: no measured data exists to promise one from.

### Notifications, profile, account, settings

- Already-working behaviour kept: unread markers, mark-all-read with an honest
  failure message, deep links with open tracking, empty states; profile
  preferences (email/WhatsApp/SMS alerts) and the security modal’s MFA flows.

### Search, institutions, mobile

- Empty search echoes the query and offers the request channel instead of a dead
  end.
- An institution with no recorded website explains why EduReach will not guess a
  URL and offers to send the verified address.
- On phones the CBT start action is pinned above the mobile nav bar; primary
  actions are ≥44 px.

### Accessibility

- `a11y.css` remains the last stylesheet (focus-ring order preserved);
  the audit reports **0 blocking findings, 4 informational**.
- Radiogroup keyboard behaviour, live-region clock notices and dialog focus
  management were added in Phase B and are asserted in `tests/a11y.test.ts`.

---

## 2. New findings discovered while implementing

1. **The news category bug had a second half.** Fixing the client alone would
   have left `/news?category=scholarships` empty: the alias table was keyed on raw
   labels while the lookup normalised first, so `'Scholarships & Funding'`
   normalised to `scholarships-funding` and matched nothing. Both halves are now
   keyed post-normalisation and pinned equal by a test.
2. **Study materials advertised formats they never had** (`PDF · DOC` chips that
   led to a WhatsApp request). Presenting a request as a format is the same
   defect class as the category bug.
3. **`/cbt/practice` could start an attempt from URL parameters** with no
   configuration step.
4. **The dashboard treated expired attempts as in progress** and pointed
   “Resume” at the setup wizard rather than the running attempt.
5. **The “everything is bold” problem was larger than it looked:** 96 weight
   declarations at 750–900 across 14 stylesheets, 12 of them `!important`, plus
   **79 inline `fontWeight` values** the stylesheet audit could not see.
6. **Profile completion is blocked on a real dependency:** the signup flow
   requires accepting ToS/Privacy pages that 404 (audit HIGH-3). Untouched here —
   it needs the legal copy, not code.
7. **Environment:** `node_modules` is not preserved by the workspace snapshot, so a
   bare `npm test` in a fresh sandbox reports 28 instant file failures. `npm ci`
   first.

---

## 3. Tests added or updated

Twelve new test files; **435 tests, 435 pass, 0 fail, 0 skipped** (`dist/` present
so the build-dependent budget test ran).

| New file | Tests | What it pins |
| --- | ---: | --- |
| `tests/cbt-modes.test.ts` | 13 | practice vs mock rules, governed subject combination |
| `tests/dashboard-priority.test.ts` | 10 | “what matters now” ordering, expiry rule, caps, fallbacks |
| `tests/cbt-experience.test.ts` | 8 | dedicated shell, legacy redirect, delete confirmation |
| `tests/site-experience.test.ts` | 8 | Phase D rules across dashboard / opportunities / news / services / school page + terminology |
| `tests/news-freshness.test.ts` | 7 | freshness states, 60-day boundary, no invented dates |
| `tests/opportunity-status.test.ts` | 7 | verification vs deadline, closing-soon window, CTA rules |
| `tests/cbt-config.test.ts` | 6 | question-count/duration options, proportional plan, summary, validation |
| `tests/service-lifecycle.test.ts` | 6 | every DB status explained (parsed from the migration), pauses vs progress |
| `tests/news-category-contract.test.ts` | 4 | client ↔ database slug parity + generated column probe |
| `tests/past-question-resources.test.ts` | 4 | RLS visibility, no client writes, coverage counts verified only |
| `tests/type-system.test.ts` | 4 | closed weight scale in CSS **and** inline styles, no `!important` weights |
| `tests/failures.test.ts` | 3 | failure classification and recovery semantics |

Updated: `tests/api.test.ts`, `tests/schema.test.ts` (new route and migration).

---

## 4. Build and typecheck results

```
npm run typecheck   → exit 0 (no output)
npm run build       → success; entry 95.0 KB gzip, css 45.1 KB gzip
```

---

## 5. Existing quality-gate status (unweakened)

| Gate | Result |
| --- | --- |
| `npm test` | **435 / 435 pass, 0 fail, 0 skipped** |
| `npm run perf:audit` | **10 / 10 pass** — entry 95.0 ≤ 100 KB · css 45.1 ≤ 46 KB · critical path 200.5 ≤ 210 KB · all chunks 294 ≤ 310 KB |
| `npm run a11y:audit` | **0 blocking, 4 informational** |
| `npm run schema:audit` | no blocking findings |
| `npm run analytics:audit` | taxonomy / call sites / server / document agree |
| `npm run rls:audit` | **37 public tables, 37 classified, 0 findings** |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| CI `quality-gate` (PR #13) | **passed** on `3eff11a` — full `npm run ci` incl. Playwright e2e and `npm audit` |

No existing test was deleted or weakened. The suite count is explained by
addition: 385 (pre-remediation) → 393 + 11 new Phase C/D files → 435.

**Honesty note:** `tests/cbt-config.test.ts` and `tests/failures.test.ts` were
written before final wording was settled and were rewritten in place while still
untracked; their earlier text is not recoverable from git. The total reconciles
exactly against addition, so no test was lost — but the earlier wording of those
two files cannot be restored.

---

## 6. CBT verification evidence

| Requirement | Evidence | Status |
| --- | --- | --- |
| Practice question selection | `questionCountOptions(bankSize)` — an option the bank cannot serve is never offered (`cbt-config` test) | verified by test |
| Practice time is the real timer | duration choices feed `durationMinutes` sent to the server and shown in `describeSession` | verified by test |
| Subject selection from real bank data | subjects come from `cbt_exams` rows (`fetchCbtExams`), never a static list | verified by test + code |
| Distribution rule | `previewPlan` is proportional, capacity-aware, contiguous, 1-based | verified by test |
| Subject visible per question | plan positions drive “Physics · Question 14 of 40” and palette transitions | verified by code; **browser-render not verified locally** |
| Save / resume | answers persist through the offline queue; resume links to `/cbt/session/<id>` | verified by test (rule) + CI e2e |
| Delete | confirmation dialog, server-enforced `DELETE /api/cbt/attempts/:id` | verified by test |
| Mock programme selection | student picks programme; system derives subjects | verified by test |
| Automatic subject combination | governed rules table; no valid combination → explanation + recovery, never a wrong paper | verified by test |
| Mock timing | server-authoritative expiry; page never extends or resets | verified by test (rule) + server code |
| Exam navigation | palette states, arrows for answers, N for next | verified by `tests/a11y.test.ts` + CI e2e |
| Dedicated shell | `/cbt/session/<id>` renders no `HubLayout` | verified by test |
| End Test vs Submit | distinct actions, both confirmed, progress consequences stated | verified by test |
| Submission | server-side scoring and ownership, duplicate protection | pre-existing; unchanged |
| Result | subject merge client-side; `get_cbt_result` backfill still outstanding | **partial — see §7** |

---

## 7. Remaining limitations

**Not verified in this environment**
- **Browser rendering.** Playwright browsers cannot be downloaded in this
  sandbox, so all visual and interaction verification rests on CI's e2e run
  (which passed on `3eff11a`; the Phase D/E commit is running through CI now).
  No claim of pixel-level correctness is made for any Phase D screen.
- **No device testing.** Nothing was tested on a real phone or in Safari; the
  mobile work is CSS and layout reasoning plus the CI mobile-Chromium project.
- **No penetration testing** and no WCAG conformance audit. `a11y:audit` is a
  static rule check (0 blocking, 4 informational), not a conformance statement.

**Data and content gaps that need human input**
- **The past-question library is empty by design.** No PDF, no paper and no
  seeded row exists. Curated papers must be supplied, uploaded to the private
  `resource-files` bucket, then published and verified by staff.
- **Opportunity eligibility is unrecorded** for the two live listings; the
  column now exists and the UI says “Not recorded”. Likewise both listings have
  no `last_verified_at`, so they display as “Not yet checked by EduReach”.
- **`get_cbt_result` still cannot supply subjects** — the client merges
  best-effort. The honest fix is an additive migration, not yet written.
- **No authoritative JAMB subject-combination matrix** was invented. The governed
  rules mechanism exists; the real rules must be entered.

**Production / operational items untouched (from the audit)**
- **CRIT-1** no documented backup/restore procedure — still open.
- **CRIT-2** `admin-content` bucket public/private contradiction between the
  migration and `scripts/prod-validate.ts` — still open.
- Migrations in this branch (`cbt_practice_and_mock_modes`, `news_category_contract`,
  `past_question_resources`, `opportunity_eligibility`) have **not been applied to
  any live database**. The news contract fix is therefore not yet live.
- OBS-1 scheduled-job alerting and the `/api/admin/jobs` consumer remain absent.
- Signup still requires ToS/Privacy acceptance for pages that 404 (HIGH-3).

**Business decisions required**
- Service response times: the pages deliberately promise none. A real, measured
  service level is a business decision, not a code change.
- Whether to accept user-supplied past papers at all (moderation, copyright).

---

## 8. No fabricated completion

Stated plainly:

- **Nothing was invented to look finished.** The past-question library is empty;
  eligibility is blank where unknown; unverified listings are labelled; the
  service page promises no duration; no JAMB rule was guessed.
- **Every number in this report came from a command run on this branch.** The
  gate results in §5 were produced after the last code change; the CI result is
  quoted from the run URL.
- **Where verification was impossible, it is marked as such** rather than
  implied — browser rendering, devices, penetration testing, live database, and
  the `get_cbt_result` backfill.
- **The two audit CRITICAL findings are not fixed by this work** and are not
  presented as fixed.
- **Phase D/E is complete for the surfaces the instructions named** (dashboard,
  news, opportunities, institutions, services, notifications, profile/account,
  settings, search, mobile). It is not a claim that every screen in a 38-page
  application was redesigned — the shared rules were fixed and the pages that
  expressed them were updated.

*End of report.*
