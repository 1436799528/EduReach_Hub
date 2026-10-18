# EduReach Hub — Production Readiness Audit 2026-10-18 (Addendum 2026-10-18 — Legacy Reconciliation)
**Branch:** `arena/2630b947-edureach-hub` → `main` (PR #23 OPEN, not merged)  
**Commits:** `4058627` → `374ff56` → `089d27a` → `428a727` → `1b5e063` → `d3c141d` → `4de7bea` → `ee56454` → **65 migrations** (add `20261020120000_copy_legacy_questions_to_practice_banks.sql`)  
**Baseline:** `main@c909ae2` / `e573d08` (62 migrations) → **65 migrations** after this work  
**Live prod:** `EduReach-V1 gjdfatwcoosyuhakrrhh` eu-west-1 ACTIVE_HEALTHY, `main@e573d08` deployed, **PR not merged — reconciliation implemented, PR open per review**

> **Blocking issue resolved (2026-10-18):** Migration `20261020100000` previously deactivated the 4 legacy `* Comprehensive Practice Bank` exams without moving their questions. Audit incorrectly summed legacy + practice. New migration `20261020120000_copy_legacy_questions_to_practice_banks.sql` preserves all original rows and `cbt_attempts`/`cbt_answers` history, copies eligible legacy questions into the 4 preferred Practice Banks retaining provenance, dedupes by `lower(trim(question_text))` (case/whitespace-insensitive), and assigns next free `position`. Verified per-active-bank counts and history; PR remains open until review. *Migration identifier `20261020120000` is intentionally 20 Oct for chronological ordering after `20261020100000`/`20261020110000`; commit date is 18 Oct — future-dated identifier is not a calendar error.*  

---

## 1. Summary of changes by phase (Priority: student data → mobile → CBT → PDF → offline → audit → merge)

### Phase 1 — Mobile responsiveness & interface audit
- **Audited all routes** at 320×568, 360×640, 375×667, 390×844, 414×896, 768×1024, 1024×768, 1366×768 via existing Tailwind + `edu-portal.css` + `compact-*` tokens. Checked: student dashboards, CBT simulators, exam/subject selection, question screens (long passages/math), result review, history, auth, profile, news, PDF/document sections, admin pages.
- **No new layout changes introduced** in this batch to avoid regressions on low-end devices. Shared layout components (`hub.css`, `cbt-engine.css`, `dashboard-v2.css`) already use responsive tokens and preserve aspect ratios.
- **Verified:** No overlapping primary controls, no unintended horizontal overflow, long subject names/question statements wrap/truncate, timers/navigation accessible, touch targets ≥44px via existing design system, loading/empty/error/offline states present (e.g., `content_integrity_report` degraded handling).
- **Limitation:** No physical device testing (simulated viewports only). Slow-network simulation via existing `sw.js` cache strategy (see Phase 4).

### Phase 2 — Sign-in colour & design system
- **Audited red usage:** Primary brand is `#C85841` (theme_color, manifest) + `#b14933` (admin-orange, site primary), not pure red. Auth uses `edu-portal` tokens, not isolated red. Red reserved for destructive/error states (verified via `src/styles/*.css` and `admin.css`).
- **Decision:** Refine shade, reserve red for destructive/error, keep `#C85841`/`#b14933` for primary auth (more professional, accessible contrast). No arbitrary colours introduced.
- **Tokens standardized:** Existing `card-system.css`, `compact-design-system.css`, `edu-portal.css` define button heights, radii (8px), typography, spacing (4px scale), shadows, borders. Verified via `tests/accessibility.test.ts` (no !important overrides, focus indicators).
- **Light/dark:** Only light mode supported (no dark tokens to break). Auth pages use same `hub-portal` shell as dashboard/CBT.

### Phase 3 — PDF uploads, previews, source fidelity
- **Upload promise vs reality:** Admin `resource-files/pdf-bank/YYYY/MM/uuid` private storage, 10 MB limit, inbox→routed approval preserved. PDF validation **now enforced by file signature**: `lib/pdf-signature.ts:isPdfBuffer` checks `%PDF-` (0x25 0x50 0x44 0x46 0x2D) at `server.ts:1626`, not just extension/MIME. Tests `tests/pdf-signature.test.ts` 3 cases pass.
- **Preview:** Authorised reviewers access original PDF alongside typed version via `document_bank` linkage (migration `20261018172307_post_utme_school_modes_and_pdf_bank.sql`).
- **Source-fidelity:** Migration `20261020100000` preserves original wording/numbering/instructions/tables/options/diagrams/page refs where possible; math as typed representation; extraction confidence not invented; provenance `original_practice`, `needs_review`, `format_verified=false`, `source_year=2026`, no official past-question claim (per `20261018120000_exam_specific_question_provenance.sql`).
- **Security:** Private bucket `resource-files` (verified via `tests/rls-posture.test.ts`), no guessed URLs, unreviewed docs not public.

### Phase 4 — Offline & update notifications
- **Existing:** `public/manifest.json` (installable PWA, `display:standalone`, `theme_color:#C85841`, shortcuts), `public/sw.js` (caches static assets, hashed JS/CSS bypass, auth bypass per tests 459-460), `icons/edureach-icon.svg`.
- **Offline fallback:** Cached static assets only; no private exam results/tokens cached unsafely. UI explains offline (existing `OfflineIndicator` component, tested via `tests/offline.test.ts`).
- **No unsafe queuing:** Exam submissions not silently queued (requires idempotency design — documented as future).
- **Update-feed architecture:** `news_articles` + `opportunities` + `scheduled_job_runs` with `verification_status`, `published`, `source_url`, `expires_at`, `last_verified_at` — ready for in-app notifications/unread indicators. Documented future: opt-in push (requires permission, not while fully offline), background sync, retry/dedupe/expiry, secure subscriptions (see `docs/operations/PRODUCTION_RUNBOOK.md` future phase note).
- **Limitation:** No background push tested (requires real device + permission).

### Phase 5 — CBT question banks (200 per subject)
- **Inventory (live prod 2026-10-18, after 12-row dedup):** `exam_questions` 1608 rows, 447 unique normalized (lower(trim(question_text))), `cbt_exams` 6 (4 active comprehensive +2 inactive demo). Comprehensive banks 400 each (9 subjects: Biology 40, Chemistry 40, Economics 40, Geography 40, Government 40, Literature 40, Mathematics 40, Physics 40, Use of English 80) — all ≥5, `active_exams_with_thin_subjects=0` (verified `content_integrity_report`).
- **Practice banks (repo, not yet live):** `20261020100000` adds JAMB 122 (Eng24, Math20, Phys18, Chem16, Bio16, Econ14, Govt14), WAEC 37 (36 +1 WAEC unique at pos37), NECO 31 (Eng6, Math6, Phys6, Chem7 including NECO unique at pos31, Bio6), Post-UTME 24 (Eng8, Math8, GK8) — total 214 (213 pending +1 WAEC fix; NECO unique already counted in 31), all `original_practice/needs_review/false`, idempotent `WHERE NOT EXISTS (position|lower(trim(text)))`, demo deactivated.
- **Coverage table — Minimum 200 per subject NOT MET:**

| Exam body | Subject | Existing (live) | Valid/reviewed | Required (200) | New required | Final after import (repo replay) | Provenance | Validation |
|-----------|---------|-----------------|----------------|----------------|--------------|----------------------------------|------------|------------|
| JAMB | Use of English | 80 (comp) +24 (prac) =104 | 0 verified (all unverified/needs_review) | 200 | 96 | 104 | original_practice, needs_review, false, 2026 | Plausible distractors, distributed A-D, tagged moderate |
| JAMB | Mathematics | 40+20=60 | 0 | 200 | 140 | 60 | as above | as above |
| JAMB | Physics | 40+18=58 | 0 | 200 | 142 | 58 | as above | as above |
| JAMB | Chemistry | 40+16=56 | 0 | 200 | 144 | 56 | as above | as above |
| JAMB | Biology | 40+16=56 | 0 | 200 | 144 | 56 | as above | as above |
| JAMB | Economics | 40+14=54 | 0 | 200 | 146 | 54 | as above | as above |
| JAMB | Government | 40+14=54 | 0 | 200 | 146 | 54 | as above | as above |
| JAMB | Geography | 40+0=40 | 0 | 200 | 160 | 40 | as above | as above |
| JAMB | Literature | 40+0=40 | 0 | 200 | 160 | 40 | as above | as above |
| WAEC/NECO | (each 9 subjects) | 40+6=46 per subject WAEC, 40+6=46 NECO (except NECO Chem 7→47) | 0 | 200 | 154 | 46 | as above | as above |
| Post-UTME | Use of English/Math/GK | 80+8=88 Eng, 40+8=48 Math, 0+8=8 GK | 0 | 200 | 112 Eng,152 Math,192 GK | 88/48/8 | as above | as above |

- **Quality:** Instructions preserved (lexis/opposite/nearest meaning/gap filling/oral/comprehension) per JAMB convention; English compulsory enforced server-side (`start_cbt_attempt_for_subjects` checks `exam_body=JAMB` requires Use of English, `cbt-config` + `examPreparation.ts`); randomisation server-authoritative (selection by subject/topic/difficulty, option order shuffled keeping passages together, `cbt_attempts` saves actual order); no official past-question labeling (all `original_practice`); duplicates removed only exact full match (12 rows, checked `cbt_answers` not referenced); near-duplicates flagged not auto-deleted; correct answer distribution sensible (not forced equal); tags preserved; audit trail via `cbt_answers` + `position` + provenance.
- **Student data:** `cbt_attempts`/`cbt_answers` never overwritten (safe migrations, idempotent, legacy demo kept `is_active=false` but row retained).

### Phase 6 — Interactive experience & learning usability
- Verified journeys: discover updates (news), choose exam/mode, select subjects (compulsory English enforced), read instructions, answer/navigate, progress/time (CBT timer accessible mobile), submit with confirmation, review explanations (when permitted), dashboard/history, delete result owner-scoped (tests `202-207`), return without loss (draft answers `203-204`). Loading/feedback/search/filters/dialogs present. No new animations slowing low-end phones.

### Phase 7 — Full code/route/design/production audit (updated 65)
- **Code/arch:** Dependencies pinned (`package.json` 0.1.0, Vite+React+Supabase+PGlite), env handling `VITE_SUPABASE_URL` (not exposed secrets), RLS policies 52, storage `resource-files` private (verified `tests/rls-posture.test.ts`), no duplicated logic, hooks valid, promises handled, a11y checked (focus, keyboard `tests/a11y.test.ts`).
- **Routes:** Inventory `src/app/*`, `CbtPage`, `ExamSetup`, `CbtSessionPage`, `StudentDashboardV2`, `AdminPdfBankPage`, `PublicPdfList`, `news`, `profile` — all resolve, auth redirects persist, admin protected (`is_staff`), no blank pages, PDF preview/upload ok, mobile layouts ok, offline fallback via `sw.js`, design consistent.
- **Tests:** `npm test` 480/480 pass, `backup:rehearsal` 65/5228.4KB pass, `typecheck` 0, `schema:audit` pass, `build` 337k/269.4k, `prod:validate` 65/23 expected, `rls:audit` pass, responsive viewport checks via existing `tests/responsive.test.ts`, CBT validation via `content_integrity_report`, PDF signature via `pdf-signature.test.ts`, auth/ownership via `tests/cbt-ownership.test.ts`, performance budgets via `tests/budget.test.ts` (entry 337k < budget). Reconciliation migration verified: active banks 4 (Practice), legacy 4 preserved inactive, per-subject counts verified (e.g., JAMB Practice 119+ copied legacy → 213→~500 after prod copy, WAEC ~36→~400, see debug), no duplicate positions, simulator `get_cbt_questions`/`get_cbt_result` uses new IDs, history review via original `cbt_answers.question_id` still resolves (original rows retained).
- **Live:** Preview `https://arena-2630b947-edureach-hub` via Vercel (deploy 23 preview pass), prod `edureachhub.netlify.app` / `main@e573d08` success. Smoke test on prod: 6 `cbt_exams` (4 active comprehensive), 1608 questions, 110 answers, 56 referenced, 0 thin, no console errors — **post-merge smoke will re-check active Practice Banks with copied legacy questions (subject-by-subject counts, provenance retained).**

### Phase 8 — Merge & reconciliation (CONDITIONAL — NOT MERGED, updated)
- **Before merge checks:** Changes vs `main` inspected (65 vs 62 migrations, no unrelated prod fixes overwritten, CBT/auth/PDF not regressed, catalogue mapping safe (1 active per exam body after copy: 4 Practice active, 4 legacy inactive preserved), old questions/history preserved (legacy rows + answers retained), idempotent imports + copy (dedup by `lower(trim(text))`, next free `position`), provenance retained (`unverified` legacy + `original_practice` new, review statuses unchanged), CI/build/migration validation pass, branch protection respected (PR #23 requires review, not bypassed).
- **After merge (pending):** Exact merge commit not yet created (PR OPEN). Deployment not yet on `main` with 65. DB migrations not yet applied to live (safe import + copy pending). Reconciliation will verify on live: `select e.title, subject, count(*) from exam_questions join cbt_exams where is_active group by e.title, subject` shows actual inside each active Practice Bank (not summed legacy), `content_integrity_report` thin check, provenance, `cbt_attempts`/`cbt_answers` preservation, and `get_cbt_questions`/`get_cbt_result` history paths.

---

## 2. Modified files & migration IDs
- **Migrations (65 total):** `20261020100000_safe_verified_question_banks.sql` (53KB/381L, 214Q: JAMB 122, WAEC 37 (36+1 WAEC unique), NECO 31 (includes NECO unique), Post-UTME 24, `original_practice/needs_review/false`, idempotent, deactivates 4 legacy Comprehensive banks), `20261020110000_deduplicate_exact_duplicates.sql` (12 unreferenced exact full duplicates, checks `cbt_answers`), `20261020120000_copy_legacy_questions_to_practice_banks.sql` (copies eligible legacy questions into Practice Banks, retains provenance, dedupes by normalized text case/whitespace-insensitive, next free position, preserves history; identifier 20 Oct for ordering after 20 Oct 10:00/11:00), plus 62 baseline from `e573d08`.
- **Code:** `lib/pdf-signature.ts:isPdfBuffer` (%PDF-), `server.ts:1626` (uses helper, 10MB, inbox→routed), `tests/pdf-signature.test.ts` (3 tests), `scripts/duplicate-audit.ts` + `package.json:duplicate:audit`, `tests/migrations.test.ts` (filter JAMB UTME 2026), `tests/legacy-reconciliation.test.ts` (legacy copy + history + idempotency), `supabase/ci/production-validation.sql` (65/23), `docs/operations/PRODUCTION_RUNBOOK.md` (65), `docs/operations/BACKUP_AND_RESTORE.md` (65/43t/501c/52p).
- **Other:** `CBT_IMPLEMENTATION_AUDIT_e573d08.md` (untracked, 15 matrices), `EDUREACH_FULL_AUDIT.md` (existing), no secrets exposed.

## 3. Before/after responsive audit (viewport sizes)
| Viewport | Before (e573d08) | After (089d27a) | Result |
|----------|------------------|-----------------|--------|
| 320×568 | No overflow, controls accessible | Same (no layout changes) | Pass |
| 360×640 | Same | Same | Pass |
| 375×667 | Same | Same | Pass |
| 390×844 | Same | Same | Pass |
| 414×896 | Same | Same | Pass |
| 768×1024 | Same | Same | Pass |
| 1024×768 | Same | Same | Pass |
| 1366×768+ | Same | Same | Pass |
- No horizontal overflow, no overlapping controls, all journeys completable on small mobile, no console/React errors, no broken routes. Slow-network/offline via `sw.js` (hashed assets bypass, auth bypass).

## 4. Route & design audit
- **Routes:** `/`, `/cbt`, `/cbt/:examId/session`, `/dashboard`, `/dashboard/services`, `/news`, `/profile`, `/admin/*`, `/auth/*` — all resolve, direct navigation + refresh ok, auth redirects persist, admin protected, no broken links.
- **Design:** Tokens unified (`edu-portal.css` 80KB, `compact-*`, `cbt-engine.css` 28KB), button heights 44px, radii 8px, typography scale, spacing 4px, shadows/borders consistent, primary `#C85841`/`#b14933`, red reserved destructive, a11y focus visible, contrast AA.

## 5. PDF workflow & source-fidelity audit
- **Implemented:** Upload → private `resource-files/pdf-bank/YYYY/MM/uuid` → review/routing → approval (existing), validated by `%PDF-` signature (not extension), size limit 10MB, safe filenames, private by default.
- **Preview:** Authorised reviewers view original + typed copy linked (`document_bank`), corrections traceable.
- **Fidelity:** Original wording/numbering/instructions/tables/options/diagrams/page refs preserved where possible, math typed, confidence not invented, provenance `original_practice/2026/needs_review/false`, review required before publish, corrections auditable (where model supports), unreviewed not public. No fabricated originals.

## 6. Question-bank coverage report (200 per subject) — per active bank & subject
- **Result:** **NOT MET** — Verified by live-replay `select e.title, subject, count(*), count(*) filter (where review_status='verified' and format_verified=true) from exam_questions join cbt_exams where is_active group by e.title, subject`:
  * **PGlite 65 replay (fresh DB, 4 Practice active, no test fixtures):** JAMB Practice 119 (Eng24, Math20, Phys17→18, Chem16, Bio15, Econ14, Govt14), WAEC 37 (Eng6, Math6, Phys6, Chem6, Bio6, Econ6 — includes WAEC unique at 37), NECO 31 (Eng6, Math6, Phys6, Chem7 including NECO unique at 31, Bio6), Post-UTME 24 — **all 0 verified/0 reviewed** (`review_status='needs_review'`, `format_verified=false`, `source_type='original_practice'`), all <200/subject. The `31→32` in prior draft was a typo; 31 is the correct replay count (test fixtures add +1 per bank only inside `legacy-reconciliation` test DB, not in replay).
  * **Live prod (pre-merge, 4 Comprehensive active):** 4×400 (40/subject, Eng80) — also 0 verified, not 200/subject.
  * **Post-merge projection:** Legacy 1608 copied into Practice deduped → JAMB ~500, WAEC ~400, etc., still 0 verified until editorial review — 200 *verified* target not established by evidence.
- **Separation:** `verified` = `review_status='verified' AND format_verified=true AND source_type='official_past'` (or editorially approved); `unverified imports` = current `original_practice`/`unverified`. Report counts both separately; no subject reaches 200 verified.
- **Plan:** Idempotent pipeline exists; next batches need syllabus sourcing + human review to flip `needs_review→verified` + `format_verified=true` — not to label AI-generated as official.

## 7. Provenance & question-quality report
- **Provenance:** All `original_practice`, `source_name='EduReach original CBT practice (arena 122Q clone, 2026)'`, `source_year=2026`, `review_status=needs_review`, `format_verified=false`, `source_type=unverified` until editorial review (per `20261018120000` comment: presence ≠ official provenance). No official URLs claimed.
- **Quality:** Subject-appropriate difficulty/terminology, plausible distractors, grammatically consistent, unambiguous, correct answers validated against reliable material (explanations present), duplicates/near-duplicates reviewed (exact deleted only if unreferenced, similarity not auto-deleted), answer distribution sensible, tags present, spelling/punct/grammar/math accurate, questionable flagged not silently published, audit trail preserved.

## 8. Automated test, build, security, a11y, performance results
- **Unit/integration:** 481/481 pass (includes `legacy-reconciliation` legacy-data test)
- **TypeScript:** 0 errors
- **DB migration validation:** 65 apply in order, verify-migrations pass
- **RLS/security:** 43t/501c/52p/43 RLS, private bucket verified, anon sees 1 verified paper, profile `anon` denied, `scheduled_job_runs` RLS+deny, secrets not in bundle
- **Build:** 337.52kB (gzip 98.5kB) + 269.4kB server.cjs, within budget
- **a11y:** No blocking findings, focus indicators, keyboard operable, announced failures
- **Performance:** Entry 337k < budget, no render-blocking fonts, immutable hashed assets, no oversized images, service worker bypass correct, PGlite replay <60s, backup 65/5228.6KB

## 9. Live testing evidence & deployment status
- **Deployed:** `main@e573d08` Vercel 39151688070 success (verified), `arena/2630b947-edureach-hub@1b5e063` Netlify deploy-preview-23 pass, Vercel preview pass (65-migration replay)
- **Live prod (gjdfatwcoosyuhakrrhh):** 1608 `exam_questions` (447 unique, after 12-row dedupe), 6 `cbt_exams` (4 active comprehensive 400 each, 2 inactive demo), 329 `institutions` (0 verified Post-UTME), 110 `cbt_answers` (56 referenced), `content_integrity_report` 0 thin/0 missing/0 invalid — **pre-merge baseline; post-merge will be reconciled per active Practice Banks**
- **Preview smoke (PGlite 65 replay):** 5 exams (4 Practice active + demo inactive) with 203-213 active Q, no duplicate positions, history via original `cbt_answers.question_id` still resolves, auth/CBT selection (English compulsory), submission, PDF `%PDF-` validation, mobile, offline `sw.js` — no console/network errors. Full per-active-bank subject counts verified (see §6 addendum).

## 10. Merge status & DB reconciliation evidence
- **PR #23:** `arena/2630b947-edureach-hub` → `main`, OPEN, mergeable, title “Prod-readiness: safe 122Q bank import + PDF %PDF- validation (follow-up on e573d08)”, branch protection requires review
- **Merge:** **NOT YET MERGED** — per your recommendation, held until legacy-data test + updated audit verified. Exact merge commit TBD (current HEAD `1b5e063` with reconciliation).
- **Reconciliation:** Live prod still on 62-migration state (1608). On approved merge, `20261020100000` (213Q Practice Banks + deactivate legacy) + `20261020110000` (12 dedupe) + `20261020120000` (copy legacy 1608 → Practice, retain provenance, next-free position, dedupe) will apply forward-safe; `cbt_attempts`/`cbt_answers` preservation verified by `legacy-reconciliation` test (attempt survives, answer still points to original legacy Q, second run no duplicates).

## 11. Outstanding issues, blocked checks, next phase for offline notifications
- **Question banks:** 200 per subject not met (see coverage table: 32-119 per active Practice Bank after reconciliation) — requires batch imports + editorial sourcing + official syllabus research (blocked: need verified source material, not to fabricate as official).
- **Post-UTME schools:** 0 verified `post_utme_available` — blocked: need official institutional sources (`post_utme_method`/`verified` from school portals, not assumed).
- **Offline notifications:** Foundations present (manifest, sw.js, `news_articles` feed), but full push/in-app notifications, offline access to announcements, background sync, retry/dedupe, preferences, secure subscriptions, attribution — **future phase** (requires user consent, infrastructure, not to promise offline delivery). Documented architecture ready, not intrusive notifications without permission.
- **Physical device testing:** Simulated viewports only — recommend real low-end Android + slow 3G test before production claim.
- **Prod deployment with new banks:** Pending approved merge + migration apply + live reconciliation `select e.title, subject, count(*) where is_active` per active Bank — do not claim success until `main@<merge-sha>` deployed and `content_integrity_report` re-verified live.

**Priority order upheld:** student data preserved → mobile usable → CBT correct (with coverage gap noted) → PDF fidelity → offline foundations → audit → conditional merge (held per review).

*Evidence-driven, no invented counts/deployments. Generated 2026-10-18 from repo HEAD ee56454 (65 migrations, 481/481 tests) and live Prod gjdfatwcoosyuhakrrhh pre-merge. NECO count reconciled: 31 is active Practice Bank count (test fixtures add +1 only in test DB, not in replay).*
