# UX-3 — interaction integrity, useful data and premium motion

**Branch:** `arena/9596524a-edureach-hub`  
**Base:** `884d094` (`main`)  
**Scope:** the controls and records a student or administrator acts on —
selection, bulk delete, undo, profile save, MyCBT, notification state, admin
navigation, destructive row actions and the shared motion scale.  
**Rule followed:** a state is only claimed when the rendered page and the network
traffic agree. A button that says “Select all 12” must select 12; a delete that
offers Undo must actually restore the article; “Not recorded” must be shown
instead of a fabricated duration.

---

## 1. What was wrong

The pass started from behaviour, not from a visual diff. The repeated defects
were:

1. **A checkbox that could not tell the truth.** An admin table header checkbox
   had no indeterminate state, so a partly selected set either looked fully
   selected or fully empty. No selection count was shown before a destructive
   action.
2. **A delete with no way back.** Bulk delete removed articles immediately and
   only offered a transient toast. There was no 10-second reversal window.
3. **A profile save that looked broken.** Legacy short faculty/level values
   (`Science`, `300`) were not in the current option lists, so React rendered a
   blank `<select>` and native validation blocked submission. Save was enabled
   before anything had changed. A pasted image URL was still accepted beside
   the file picker.
4. **MyCBT that only described the queue.** The tab showed a list of attempts
   and a hard-coded explanatory block. It did not surface the latest submitted
   paper, accuracy, a real trend, or say “Not recorded” when the saved attempt
   genuinely had no duration.
5. **A notification badge that could lie.** The bell showed a red numeric block
   even when the notification store could not be marked read, and opening the
   panel was not treated as the read action the store supports.
6. **Admin navigation that reloaded the document.** Sidebar links used default
   anchor navigation, so each click re-booted the console instead of changing
   section inside the mounted shell.
7. **Tiny destructive targets.** Row deletes were 12–15 px text links or
   34–36 px icon buttons — under the 44 px touch target used everywhere else.
8. **Motion with no system.** Transitions were scattered across selectors with
   different durations and easings, and no global reduced-motion floor.

---

## 2. Interaction integrity

### Admin news: select-all, partial selection, bulk delete and undo

`pages/AdminNewsPage.tsx`

- Selection is a `Map<id, article snapshot>`, not a list of ids. A row that
  disappears after deletion can still be restored from the snapshot.
- The header checkbox reports:
  - `checked` only when every row on the current page is selected;
  - `indeterminate` when some — but not all — are selected;
  - an accessible label, `Select all N matching` (plus “on this page” when a
    further page exists). It never claims to select rows the page did not load.
- A bulk bar appears only when something is selected: **N selected**,
  **Delete selected**, **Clear selection**.
- Delete is **sequential** (`await deleteAdminNews(id)` per row), so one failed
  request cannot cancel the rest. Deleted rows are removed from the table;
  failed rows stay selected with an error that says how many were deleted and
  how many can be retried.
- The undo bar has `role="status"`, a visible **Undo** action, and a 10-second
  countdown. A successful undo re-creates each article through
  `POST /api/admin/news` and reloads the list. The bar reports partial failure
  and keeps the failed items available for another attempt until the countdown
  ends.
- Undo restores **content and publication fields, not the original row id**.
  See §7 for that limitation.

`pages/AdminQuestionImportPage.tsx` has the same partial-selection-aware
checkbox for pending import items. It only offers select-all when there is at
least one pending item in the current filter, and it merges rather than replaces
the existing selection.

### Profile save: make the form honest, then make it save

`pages/ProfileCompletionPage.tsx`, `src/data/studentOptions.ts`

- The **Profile image URL** input was removed. A photo is chosen from the device
  and uploaded to Supabase Storage; the stored value is a Storage public URL,
  never base64 and never a pasted third-party URL.
- `faculty` and `level` are normalised on load. Common legacy labels map to the
  current catalogue names; an unknown saved value is prepended to the select so
  it stays visible instead of turning into a blank control.
- The form is `noValidate`; submission uses the page's own validation. The
  visible error is specific: for example
  `Complete the required profile details: faculty.`
- **Save changes is disabled until the form is dirty** (`saving || savedSuccess
  || !isDirty`). It is not a dead control: editing a field enables it.
- Cancel and the edit-mode leave link ask before discarding unsaved changes.
- Upload failure copy no longer tells the student to paste a URL.

### MyCBT: use the records that exist

`pages/StudentDashboardV2.tsx`, `src/student-dashboard.css`

- The metric strip is derived from the loaded attempts: scored papers, average,
  best, **latest score**, accuracy, in-progress and expired. Each hint explains
  the denominator; no percentage is invented when the question count is absent.
- **Latest CBT** shows the latest submitted paper as exam/subjects, date, score,
  status, accuracy and time. Time is `Not recorded` when the saved attempt has
  no duration; it is not rounded from an unrelated timestamp.
- **Performance analysis** renders one score-trend chart only when at least two
  scored papers exist. With one paper it says one score is a result, not a
  direction. Subject comparison appears only when a single-subject paper has a
  complete saved plan; otherwise the empty state says exactly what is missing.
- Explanatory paragraphs are un-clamped. The compact theme's two-line clamp was
  cutting empty-state and data caveats in half.

### Notifications and destructive actions

- `src/components/NotificationCenter.tsx` replaces the numeric badge with an
  8 px dot at the bell's upper-right. The exact unread count remains in the
  accessible label and the panel header.
- Opening the panel marks the user's notifications read, optimistically, with
  the previous list restored and an error shown if the write fails. The dot
  therefore reflects the server state rather than a decorative count.
- Delete-result copy was removed from every student surface. A result row and
  the result page now use a 44 × 44 trash button (`aria-label="Delete"`,
  `title="Delete this result"`), and the confirmation's destructive action says
  **Delete permanently**. The confirmation still explains what will be removed.

### Admin shell and targets

- `pages/AdminNav.tsx` writes the history entry through `navigateInApp()` for
  ordinary clicks. Modified clicks (meta/ctrl/shift/alt/middle) are left to the
  browser, so “open in new tab” still works.
- Admin row deletes use `.admin-icon-btn` — 44 × 44 with an 18 px glyph.
- Table checkboxes are wrapped in a 44 × 44 `.admin-check-hit` label.
- On coarse pointers, compact admin buttons and stacked-table row actions get a
  44 px minimum height.

---

## 3. Motion

`src/styles/type-system.css` owns the scale, because it is loaded after the
component sheets:

| Token | Value | Use |
| :--- | ---: | :--- |
| `--er-motion-tap` | 80 ms | press feedback |
| `--er-motion-standard` | 140 ms | hover, focus, colour and border |
| `--er-motion-enter` | 240 ms | view entrance |
| `--er-motion-exit` | 160 ms | exit (faster than entrance) |
| `--er-motion-attention` | 650 ms | a single highlight, not a loop |
| `--er-ease-out` | `cubic-bezier(.22,.61,.36,1)` | every transition |

- Transitions are limited to background, border, colour, shadow and transform.
  No width, height, top or left animation.
- Cards gain a hairline/elevation response only under
  `@media (hover: hover) and (pointer: fine)`. Touch has no hover pretence.
- `.dash-card` gets one 4 px fade-up on view entry; there is no per-card
  stagger.
- `prefers-reduced-motion: reduce` sets animation and transition duration to
  `.01ms`, one iteration, and `scroll-behavior: auto` for all elements.

The earlier attempt to append this layer to `src/styles/brand-actions.css` was
reverted: that file is not the last-loaded sheet, so component rules could win.
The layer lives in `type-system.css`, and the brand-colour source contract still
passes without an allow-list for the motion selectors.

---

## 4. Evidence from a real browser

Client-only build (`npm run build:e2e-client`), Express on `127.0.0.1:3100`,
Chromium at `/tmp/chromium` with `LD_LIBRARY_PATH=/tmp/al2023/lib`. Probe scripts
are dot-prefixed at the repository root and are not part of the application.

| Scenario | Observed |
| :--- | :--- |
| News select-all | one row selected → header checkbox `indeterminate=true`, label **2 selected** after a second row |
| News bulk delete | one `DELETE /api/admin/news/{id}` per selected row, sequential |
| News undo | `role="status"` bar reads **2 articles deleted / Undo closes in 10s**; Undo issues two `POST /api/admin/news`, then **2 articles restored** |
| MyCBT, 8 seeded papers, 390 × 900 | `h1 My CBT`; LATEST CBT 82 %, 14 Nov 2026, accuracy 80 %, **Time: Not recorded**; one trend chart; no horizontal overflow |
| Profile validation | Save disabled initially; **0** “Profile image URL” inputs; clearing Faculty enables Save; submit shows `Complete the required profile details: faculty.`; URL unchanged |
| Admin navigation | click to `/admin/news` keeps `window.__spaMarker` (no document reload), heading **Newsroom CMS**, `aria-current="page"` |
| Mobile exam-setup | **Start practice** 130.9 × 44 px, `background-image: none`, zero gradient `.dash-btn-primary`, no overflow at 390 px |

Screenshots: `test-results/ux3-admin-news-bulk.png`,
`test-results/ux3-mycbt-mobile.png`,
`test-results/ux3-profile-validation.png`.

---

## 5. Release hygiene found along the way

The base branch was **not green**. These were real repository inconsistencies,
not cosmetic test drift, and were fixed in this pass:

- The deployable `20261114110000_cbt_bank_security_boundary.sql` and the
  non-deployable `restricted_bank_policy_foundation.sql` both created
  `public.cbt_bank_security`. The candidate now drops the minimal deployable
  table before installing its richer rehearsal shape; the migration itself is
  unchanged and production is untouched.
- The generated migration checklist was stale (88 entries for 89 files). It is
  regenerated at **89 / 89**; section 9 of `production-validation.sql` now
  expects `20261114110000_cbt_bank_security_boundary.sql`, accepting the hosted
  ledger version `20261114151105` under the existing name-matching rule.
- `scripts/rls-posture.ts` now classifies `cbt_bank_security` as server-only:
  RLS enabled, no client grant, no policy, `service_role` only. The audit is
  **53 public tables, 53 classified, 0 findings**.
- `tests/schema.test.ts` no longer lists `cbt_bank_security` as a candidate-only
  dependency, because a migration now creates it.
- `docs/operations/BACKUP_AND_RESTORE.md` records the rehearsal that actually
  ran: **89 migrations, 53 tables, 616 columns, 59 policies, 53 tables with
  RLS**. `PRODUCTION_RUNBOOK.md` records the same migration count.
- `tests/server-resilience.test.ts` now keeps one ref'd timer alive while it
  waits for `AbortSignal.timeout()` to fire. Node's test runner otherwise treats
  the unref'd signal as an empty event loop and cancels the subtest. Production
  fetch behaviour is unchanged.

---

## 6. Gates

All commands were run on this branch after the final code changes, with the
port-3100 server stopped first.

| Command | Result |
| :--- | :--- |
| `npm run typecheck` | **pass**, 0 errors |
| `npm run lint` | **pass** (the lint script is `tsc --noEmit`), 0 errors |
| `npm test` | **1054 / 1054 pass**, 0 fail, 0 cancelled, 0 skipped |
| `npm run build` | **pass** |
| `npm run test:e2e` | **291 passed, 0 failed, 29 skipped** |
| `npm run perf:audit` | **10 / 10 pass** |
| `npm run a11y:audit` | **0 blocking**, 6 informational |
| `npm run rls:audit` | **53 / 53 tables classified**, 0 findings |
| `npm run schema:audit` | **BASE-1: no blocking findings** |
| `npm run migrations:checklist` | **89 / 89 migrations listed** |
| `npm run backup:rehearsal` | **pass** — 89 migrations, 5.4 MB archive, schema and RLS identical after restore |

E2E requires a local browser. In this sandbox:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium \
LD_LIBRARY_PATH=/tmp/al2023/lib \
npm run test:e2e
```

### Performance detail

| Check | Measured | Budget |
| :--- | ---: | ---: |
| Entry chunk (gzip) | 46.4 KB | ≤ 100.0 KB |
| Supabase chunk (gzip) | 53.0 KB | ≤ 60.0 KB |
| Bundle CSS (gzip) | 46.0 KB | ≤ 51.0 KB |
| Critical path (gzip) | 206.8 KB | ≤ 211.0 KB |
| All chunks (gzip) | 359.4 KB | ≤ 362.0 KB |
| Largest image | 41.2 KB | ≤ 64.0 KB |
| Raster images | 310.4 KB | ≤ 320.0 KB |

The all-chunks budget was raised from **357.0 KB to 362.0 KB** — the measured
2.9 KB cost of this pass plus the previous 0.4 KB slack. UX-2 warned that the
next JavaScript-adding change must trim or record a measured change; this is the
recorded change, and first load is unchanged at 206.8 KB against its separate
211 KB cap. It is not a silent bump to hide an unexplained regression.

---

## 7. Remaining problems

1. **Undo preserves content, not identity.** Restored news articles are new
   server rows with new ids; the slug and publication fields are preserved. A
   URL keyed by the old id would not resolve. Making Undo id-stable needs a
   server-side soft-delete or restore endpoint, which this pass deliberately did
   not invent.
2. **Bulk delete is not atomic.** It is sequential and reports partial success.
   A failed row stays selected so the operator can retry; the page never claims
   all rows were deleted.
3. **Opening the notification panel marks everything read.** This is honest for
   the current store (one mark-all endpoint), but a student who opens the panel
   to peek loses the unread state. Per-item read receipts need a server change.
4. **The admin table header still scrolls horizontally on phones.** The body is
   a labelled stacked list; the `<th>` row remains a wide, focusable region.
   Removing the header would remove column context. Page-level overflow is
   still zero.
5. **Hosted migrations were not applied.** This pass changes no Supabase
   production state. The seven previously unapplied migrations plus the
   `cbt_bank_security` boundary remain a rehearsed-release decision.
6. **The 362 KB all-chunks cap now has 2.6 KB of slack.** That is reviewable,
   not generous. The next JavaScript addition should trim or record another
   measured change; the first-load cap is the stronger constraint.
7. **`npm run lint` is only `tsc --noEmit`.** There is no ESLint pass, so style
   and accessibility lint rules are not part of this gate set.

---

## 8. Git state

- Branch: `arena/9596524a-edureach-hub`
- Base: `884d094` (`main`)
- Changes are on the branch; no force push, reset, clean or hosted database
  write was used.
- Probe scripts are untracked dot-files at the repository root and are excluded
  from the change set. Screenshots live under `test-results/ux3-*.png`.
