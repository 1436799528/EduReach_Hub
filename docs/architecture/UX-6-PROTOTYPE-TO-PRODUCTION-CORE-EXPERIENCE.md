# UX-6 — Prototype to production: core experience, CBT journey and real usability verification

**Branch:** `arena/3b294b85-edureach-hub`  
**Base:** `47f3e24` (merge of UX-5, PR #42)  
**Implementation commit:** the branch HEAD containing this document (`git log -1`)
**Scope:** migrate the approved UX-5 designs into the existing production app; no new visual system.

This document is the UX-6 record. It does not replace the UX-5 design system
(`UX-5-PRODUCT-DESIGN-AND-RESPONSIVE-SYSTEM.md`) or the UX-5 design bundle in
`docs/design/ux-5/`; it records what changed in production and what was actually
verified.

## A. Status

| Area | Production state | Evidence | Remaining limitation |
| :--- | :--- | :--- | :--- |
| CBT setup | **Migrated.** One paper plan with subject/required/optional/limit/count/duration/mode/instructions/start/current selections; sticky summary; mobile action region. | Browser run at 1440/1024/768/390/320, 0 page errors; no horizontal overflow; single column ≤960; sticky actions ≤760. | Real-hosted bank data was not used; the JAMB fixture is synthetic. |
| Exam surface | **Migrated and extended.** Authored timer, answer persistence, four-state palette (plus answered+marked), flag/clear/prev/next, disabled explanations, submit counts, no success before server confirmation. | Browser at 1440/390/320; real page + synthetic API Playwright suite. | Flags are browser-local because the v2 protocol carries no flag field (documented below). |
| v2 finalisation | **Closed at the client and server boundary.** Leased finalize gateway, durable operation key, revision check, session lease. | Authorization test, IndexedDB seal test, mocked browser finalize test. | v2 remains a **local-rehearsal** path; hosted PostgREST/JWT behaviour was not exercised. No hosted rollout authorisation. |
| Result | **Migrated.** Score ring, percentage, counts, subject comparison, honest guidance, review/practice/MyCBT actions. | Browser at 1440/768/390/320, 0 page errors; no overflow. | Best/average/trend stay in My CBT, where the history exists; not fabricated here. |
| My CBT | **Verified existing production implementation.** Seven summary cards read owner-scoped `cbt_attempts`; submitted results refresh from the server. | Code path review; existing dashboard tests; server result RPC is owner-scoped. | Not re-screenshot in this pass. |
| Profile summary | **Completeness count added.** Avatar, name, verification, institution, course/department/faculty/level, public-link status, edit action. | Static review + typecheck + profile unit tests. | Not exercised in a browser session against a real account in this pass. |
| Notifications | **Changed.** Opening the panel no longer blanket-marks every notification read; mark-all is explicit, per-item read remains optimistic with rollback. | Browser run at 1280: 2 unread stayed 2 after opening; dot stayed on the bell. | The panel was mocked at the REST boundary, not against a hosted project. |
| Services | **Reviewed; no code change required.** Existing discovery → requirements → submit → reference → track → update flow retained. | Route/E2E coverage and source review. | No new end-to-end service request was submitted in this pass. |
| Admin | **Reviewed; no code change required.** Dense tables, drawer/detail, destructive separation and focus return retained from UX-5. | Existing admin tests and source review. | No new admin browser scenario in this pass. |
| Real usability | **No real-user validation performed.** 0 participants. | — | No findings are claimed. This is not a substitute for the plan in UX-5. |

## B. CBT setup

Route: `/cbt/setup/:examBody` (`pages/ExamSetupPage.tsx`).

The existing production wizard was kept; UX-6 changed its composition, not its
rules:

- The paper plan is a two-column layout: configuration on the left, a sticky
  **Before you start** summary on the right at ≥961 px. At ≤960 px it collapses
  to one column; at ≤760 px the action region becomes a safe-area-aware sticky
  bar above the mobile tab bar.
- The subject line is a polite live region: `Subjects (n of limit selected)`.
  A second line states how many optional slots remain, or that all are used.
- English is still preselected by the bank rule, shown with **Required**, and
  has no remove control. The limit comes from the server's `limits` payload via
  `subjectLimitFor`, not from a hard-coded client number.
- Count, duration, mode, instructions, warning notices and the start action stay
  on the same screen. The summary repeats mode, subjects, question count,
  duration, per-subject quota and the start action.
- The start action validates through the existing form and server rules. No
  selection is silently changed by the layout.

The prototype's single tall card is **not** copied literally. Production keeps
the bank banner, the "How this CBT session works" explainer, the
exam-format-unverified notice and the signed-out account notice. They are real
content that the prototype omitted; removing them to match a drawing would be a
regression. This is the intentional visual difference for this screen.

## C. Exam surface

Route: `/cbt/session/:attemptId` (`pages/CbtSessionPage.tsx`,
`pages/CbtSessionPage.css`).

### What already existed and was preserved

- The countdown comes from the server's `attempt.expiresAt` plus a server-time
  offset. It is not a client-supplied duration and it survives re-renders,
  navigation and refresh.
- Answers persist through the existing legacy draft queue or the v2 leased
  journal. A failed save is shown as pending/error, never as saved.
- Palette: current, answered, unanswered, marked; quick navigation; keyboard
  `1–4`/`A–D`, arrows and `M`.
- Confirmation dialogs separate return, submit and end test. Auto-submit happens
  once at expiry.

### UX-6 changes

1. **Flag persistence.** Flags are stored per attempt in
   `edureach-cbt-flags:<attemptId>`. They survive refresh and navigation, are
   reversible, and never alter answers or scoring. This is explicit storage, not
   a fake server write: the v2 protocol has no flag column.
2. **Non-colour selected state.** The chosen option keeps its check icon and
   `aria-checked`, so selection is not conveyed by the green tint alone.
3. **Palette both-state.** Answered + marked cells get a green inset edge and a
   legend item "n answered + marked"; the accessible name includes both states.
4. **Crimson discipline.** Current-question outline is the primary green, not
   crimson. Submit is green. End Test remains the destructive crimson action.
5. **Previous explanation.** On the first question, Previous has an accessible
   name and title explaining that this is the first question.
6. **Submit confirmation.** Both dialogs now state marked-for-review count
   alongside answered/unanswered counts.
7. **Exam bar.** The bar was transparent in the UX-5 cascade because
   `--er-exam-ink` was only defined on the old `.er-exam` scope. It is now
   explicitly opaque on `.er-exam-shell`; the shell is offset by the site header;
   `overflow-x: clip` replaces the hidden overflow that broke `position: sticky`.
   The compact ≤480 px bar keeps the timer, Calculator, Questions and labelled
   End Test while hiding only the repeated candidate name (the candidate group
   keeps an accessible label). This removes the 60 px underlap and keeps the
   timer visible while scrolling.
8. **v2 submission.** See below.

### v2 finalisation gap

Before this pass, a v2 paper could be answered but not submitted: the client
disabled End Test and Submit, `submit()` and `endTest()` early-returned, and the
server deliberately returned 503 for `/finalize`.

The database already contained the reviewed scoring core
`cbt_candidate_finalize_core` and the lease-aware
`cbt_candidate_finalize_leased`, but no authenticated gateway. UX-6 adds:

- `supabase/migrations/20261114120000_cbt_v2_finalize_gateway.sql` — a
  `SECURITY DEFINER` gateway owned by `cbt_v2_executor`, executable by
  `authenticated`, which passes `auth.uid()` and calls the internal leased
  finalizer. The internal core/finalizer remain non-executable by clients.
- `server.ts` — validates the common operation and calls
  `cbt_v2_finalize_gateway` for `POST /api/cbt/v2/attempts/:id/finalize`.
  It never falls back to the service role.
- `src/lib/useCbtPageWriter.ts` — `finalize()` drains the journal first, refuses
  if any answer is pending/conflicted/closed, reads or creates a durable
  submission seal, and sends the sealed operation key. A conflict clears the
  seal only for an explicit retry; a timeout keeps it so a repeated request
  cannot double-score.
- `pages/CbtSessionPage.tsx` — Submit is enabled when the writing session is
  active and every answer is acknowledged; the server's `submitted`,
  `replayed` or `already_submitted` outcome is the only thing that navigates to
  the result. No success is shown before that outcome.

This closes the **client** gap and adds the missing authorization boundary. It
does **not** enable v2 in production: `cbtV2LocalRehearsalEnabled()` still
requires the local, non-production switch. Hosted PostgREST exposure, JWT
identity and effective privileges remain a staging task (see
`CBT_STAGING_VALIDATION_PREPARATION.md`).

## D. Result

Route: `/cbt/results/:attemptId` (`pages/CbtResultsPage.tsx` +
`pages/CbtResultsPage.css`).

- The header now answers "how did I do?" first: a server-score-derived
  percentage ring, a plain-language band (strong / fair / room to improve),
  correct-of-total, and the exact recorded mark. The existing estimated-mark
  notices remain.
- Subject comparison uses bars plus a table. Each bar has `role="progressbar"`,
  an accessible name and exact correct/total text. When subjects are tied, the
  copy says no subject stood out instead of inventing a weakest subject.
- "What this means" only uses data present in this result: the lowest subject
  and its percentage, or a single-subject limitation, or an explicit unavailable
  state. It links to a shorter practice paper and My CBT; it does not invent a
  class average or a trend.
- Counts use "Not recorded" where duration is absent and `—` where the server
  did not return wrong/unanswered detail. No metric is estimated.
- Actions: Review answers (existing scroll/table), Practise again, My CBT and
  the existing print/download/delete controls. Delete remains separated from
  the review actions.
- Best/average/trend are deliberately left to My CBT, which has the attempt
  history. This is documented rather than faked with one paper.

## E. Profile summary

`pages/ProfileCompletionPage.tsx` already separated identity from the editable
settings. UX-6 adds an honest completeness line computed from the fields on the
account:

> `6 of 8 profile details added · add the rest in Edit profile`

or `All 8 profile details added`. It is a count, not a score. The summary keeps
avatar, name, verified badge, institution, course/programme, department, faculty,
level and public-profile status; the public-link copy still states that email,
phone, matric number, results and notifications are excluded. Edit and security
actions remain distinct.

No private field was added to `PublicProfilePage`.

## F. Notifications

`src/components/NotificationCenter.tsx` previously auto-marked **all**
notifications read when the panel opened. That contradicted the UX-6 rule that
per-item read must be respected. The auto-mark effect and its ref were removed.

- Opening the panel only loads; unread items stay unread and the bell dot stays.
- Clicking an item marks that item read where the backend supports it
  (`read_at` per row), optimistically, with rollback on failure.
- "Mark all read" remains an explicit control and keeps its rollback contract.
- Loading, failure, empty and "showing the last loaded list" states remain.
- `timeAgo` now says "1 hour ago"/"1 day ago" instead of "1 hours ago".

Browser check at 1280 px with three synthetic rows: 2 unread before opening,
2 unread after opening, dot still present, third row already read. No page
errors.

## G. Services

The production service flow was reviewed and left unchanged: service discovery,
requirements, form validation, server-side reference creation, request tracking
and status notifications. The existing tests that exercise the boundary and
recovery paths continue to pass. No progress bar or artificial status was added.
No new live request was submitted during this pass, so no hosted reference is
claimed.

## H. Admin

The admin surface was reviewed and left unchanged: dense neutral tables and
drawers, important fields first, grouped detail, contextual actions, destructive
actions separated, list context preserved and focus returned to the trigger.
The UX-5 admin table/sort/quick-find work remains the implementation. No new
modal was added for a complex record.

## I. Usability

**No real-user validation performed. 0 participants.**

No task-completion rates, quotes, preferences or usability findings are claimed.
The UX-5 usability plan remains the plan; this pass produces implementation and
technical verification evidence only.

## J. Performance and verification

### Byte budgets (exact, `npm run perf:audit`)

| Check | Result | Budget |
| :--- | :--- | :--- |
| Entry chunk (gzip) | 47.1 KB | ≤ 100 KB |
| Supabase client chunk | 53.0 KB | ≤ 60 KB |
| Bundle CSS (gzip) | 49.1 KB | ≤ 51 KB |
| Critical path | 210.6 KB | ≤ 211 KB |
| All chunks | 364.8 KB | ≤ 365 KB |
| Largest image | 41.2 KB | ≤ 64 KB |
| Raster images | 310.4 KB | ≤ 320 KB |

No budget was raised. The three new UX-6 sheets are route-lazy, so they do not
enter first-load CSS; they nevertheless count in "all chunks" (≈2.0 KB gzip
total). The remaining headroom is 0.2 KB on all chunks and 0.4 KB on the
critical path.

### Throttled mobile LCP (`npm run e2e:perf`, 4× CPU, ~1.6 Mbps)

| Route | This pass (runs) | UX-5 recorded | Budget |
| :--- | :--- | :--- | :--- |
| `/` | 1984 / 2104 ms | 1752 ms | 3000 ms |
| `/news` | 1804 / 1892 ms | 1668 ms | 3000 ms |
| `/past-questions` | 2172 / 2180 ms | 2000 ms | 3000 ms |

CLS was 0–0.0031 and TBT 0–67 ms. All perf assertions pass, but the measured LCP
is ~0.2 s above the UX-5 snapshot on this runner. The public entry bytes and
critical path are unchanged; the difference is recorded rather than rounded
away. A follow-up measurement on the same runner is required before calling the
LCP difference resolved.

### Gates actually run

| Command | Result |
| :--- | :--- |
| `npm run typecheck` | **pass**, exit 0 |
| `npm test` | **1063 / 1063 pass**, 0 fail |
| `npm run migrations:checklist` | **90 / 90 migrations listed** |
| `npm run schema:audit` | **pass**, no blocking findings |
| `npm run rls:audit` | **pass**, 53 public tables classified, 0 findings |
| `npm run backup:rehearsal` | **pass**, 90 migrations, 53 tables, 616 columns, 59 policies, 53 with RLS |
| `npm run build` | **pass**, exit 0 |
| `npm run perf:audit` | **pass**, all budgets |
| `npm run a11y:audit` | **0 blocking / 6 informational** |
| `npm run test:e2e` | **293 passed / 29 skipped**, exit 0 |
| `npm run e2e:perf` | **1 passed**, all LCP/CLS/TBT assertions |

### Browser verification performed

- CBT setup: 1440, 1024, 768, 390, 320; 0 page errors; no horizontal overflow;
  two columns at ≥961, one column at ≤960, sticky actions at ≤760.
- Exam: 1440, 390, 320; timer and bar do not overlap content or each other;
  selected answer shows a check icon; palette current/answered/marked states
  render; flag survives a reload (verified `aria-pressed` true after reload);
  no page errors.
- Result: 1440, 768, 390, 320; ring, bands and two subject bars render; no
  overflow; no page errors; tie copy contains no invented weakest subject.
- Notifications: 1280; opening no longer clears unread; dot and count persist.
- The mocked v2 Playwright test submits through the leased gateway exactly once
  and navigates only after the server returns `submitted`.

### Security and integrity notes

- Finalization never trusts a client duration, score or user id. The gateway
  takes identity from the JWT, checks attempt ownership and the writing lease,
  and requires the current answer revision.
- No RLS policy or API authorization was weakened to make a screen pass.
- No fabricated score, count, status, timestamp, student identity or progress
  was added. Empty/unknown values remain explicit.
- The new migration is security-sensitive and marked **LOCAL REVIEW REQUIRED**;
  it must be reviewed and exercised against disposable hosted staging before any
  v2 rollout.
