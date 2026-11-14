# UI-5 · Interaction hierarchy: quiet surfaces, one meaning per colour

**Status:** delivered
**Surfaces:** `/login`, `/register`, `/profile`, `/u/:slug`, `/dashboard`,
`/news`, `/past-questions`, `/search`, every page using the shared header.
**Touches:** `src/styles/theme.css` (unchanged values, used as the source of
truth), `src/styles/type-system.css`, `src/hub.css`,
`src/student-dashboard.css`, `src/auth-page.css`, `src/site-search.css`,
`src/components/{SiteSearch,NotificationCenter,VerifiedBadge}.tsx`,
`src/components/ui/{Toast,FilterSearch}.tsx`,
`src/components/dashboard/ProgressCharts.tsx`,
`src/lib/{dashboardAnalytics,notificationTone,profileSave,publicProfile,searchMatch}.ts`,
`pages/{ProfileCompletionPage,StudentDashboardV2,PublicProfilePage,AuthPageV2,NewsPage,PastQuestionsPage}.tsx`,
`src/app/routes.tsx`, `server.ts`,
`supabase/migrations/20261113000000_public_profiles.sql`, and tests.

---

## 1. What this pass changed

UI-3 and UI-4 already settled the palette: logo navy `#0A3E83` is the only
primary fill, crimson `#B14933` is a brand accent, and disabled controls are
neutral. This pass applied the *hierarchy* that follows from it.

| Area | Before | After |
|---|---|---|
| Search | One navigation search, but page filters were three separate copies, and suggestions had no emphasis or pending state | `SiteSearch` is the only navigation search; `FilterSearch` is the one live page-filter field. The admin candidate lookup submits a server-side, minimum-two-character query and is not a second filter implementation; suggestions debounce, announce their pending state and mark the matched text |
| Notifications | A bell that scrolled the dashboard; the second page had its own inline badge | One `NotificationCenter` in the site header and the dashboard header: unread dot/count, neutral panel, read/unread and semantic tone |
| Feedback | The dashboard used a red inline notice for everything, and there was no shared non-blocking feedback | `ToastProvider`: success/info/warning/danger, three at a time, auto-dismiss, dismissible, announced |
| Profile | One card of database fields, crimson section icons, no unsaved state, and Save that did not save | Identity header with the verification mark, grouped Personal / Academic / Account / Preferences / Public panels, explicit Save/Cancel, unsaved indicator, and a save path that can succeed |
| Destructive actions | Saved-item removal was one click on a trash icon | Icon opens an inline confirmation; removal has `removing`/`failed` states and puts the item back on failure |
| Dashboard | "What matters now" first; performance lived in the My CBT tab | "Your progress" first: latest result, 8-paper trend, subject averages, score distribution, strengths, weakest subject and a next step |
| Auth | A dark, benefit-led marketing column beside the form | A single calm card with email, phone OTP, Google and Apple; student-only registration; required privacy/terms gate; parent/teacher marked not open (see `AUTH-1.md`) |
| Shared profile link | `/profile` is private, so a copied link hit a login wall | Opt-in `/u/:slug` public route backed by an explicit API whitelist and a random slug |

---

## 2. The profile save bug: the failing layer

The brief asked for the failing layer, not a different Save button. It was
**database privilege, not validation or the button**:

1. `20260903_restrict_profile_client_columns.sql` gives `authenticated`:
   - `UPDATE` on `full_name, school, faculty, department, level, session, matric_number`;
   - `INSERT` on `id, full_name, school, faculty, department, level, session, matric_number`.
2. `20260920_auth_and_profile_completion.sql` adds many student-editable columns
   and grants `UPDATE` on them (`phone`, `course_programme`, `admission_year`,
   `expected_graduation_year`, `academic_interests`, `notification_preferences`,
   `avatar_url`, `profile_completed`, …). It does **not** widen `INSERT`.
3. The page sent `supabase.from('profiles').upsert({ id, ...payload })`.
   PostgreSQL requires `INSERT` privilege on every column named by an
   `INSERT … ON CONFLICT DO UPDATE`, even when the row exists. The payload named
   columns the browser may update but may not insert, so the statement was
   refused. The profile looked unsaveable even though an UPDATE would have been
   allowed.

Every profile row is created by `handle_new_user()`, so the normal path is an
UPDATE. `src/lib/profileSave.ts`:

- updates first and asks for the row back (`select('id').maybeSingle()`) rather
  than assuming success;
- only when no row exists inserts the granted seed columns, then runs the
  UPDATE for the remainder;
- never calls `upsert`;
- reports the failing step (`update`, `insert`, `finalize`) so the page can show
  a truthful message and the toast can say "not saved".

The page also resolves the account id at save time. Previously, a signed-in save
with an unresolved id wrote only `localStorage` and then reported success.

Evidence: `tests/profile-save.test.ts` exercises the update path, the seed
fallback, all three failure steps, the generated seed columns, and the grant
difference in the migrations themselves.

---

## 3. Colour rules applied

| Element | Treatment |
|---|---|
| Primary action | `#0A3E83`, white text, 44px target, existing radius. Only one per surface |
| Secondary / navigation | White surface, dark grey text, thin neutral border; no fill |
| Destructive | Compact icon or small danger control, then an inline confirmation. Never one click |
| Cards | White, `1px` neutral border, restrained shadow, grey labels and dark values |
| Unread notification | Small crimson dot; numeric badge only when more than zero |
| Improvement / decline | Green `↑ +n pts` / crimson `↓ −n pts`; the chip and the number carry the meaning, not the whole chart |
| Subject bars | Neutral slate fill; band and movement are the only coloured elements |
| Section icons | Neutral grey. Crimson is reserved for the brand/accent cases UI-3 defined |
| Loading | Skeleton for first paint, inline wave in a saving button, named slow state via `usePendingPhase`; no full-page spinner |

Contrast is unchanged from UI-3/UI-4 and is pinned by
`tests/brand-colors.test.ts`: white on logo navy 10.35:1, navy on white 10.35:1,
crimson on white 5.43:1.

---

## 4. Dashboard analytics: what it may claim

`src/lib/dashboardAnalytics.ts` derives the Overview summary from the bounded
attempt sample the page already loads (up to 50 recent attempts).

- Only `status = submitted` with a finite 0–100 score counts.
- A subject average needs a saved **single-subject** question plan whose question
  count matches the paper, because a multi-subject paper has no persisted
  per-subject score. The dashboard says so instead of splitting one score into
  invented subject scores.
- "Improved" means the latest score minus the previous scored paper, in
  percentage points. One paper produces "first scored paper", not "+40".
- The distribution uses fixed buckets (`Below 40`, `40–49`, … `90–100`); 40 is
  never counted as 39.
- Strengths are averages ≥ 70%. "Needs practice" is the lowest subject average
  below 70%, and it is absent when no such subject exists. The copy does not
  diagnose a weak topic.
- The next step prefers an evidence-based practice suggestion (two scored
  single-subject papers, 20+ questions, a real difference), then a review of a
  declining latest result, then the first paper.

Charts are plain SVG/CSS: a line for time, a histogram for distribution, and
neutral bars for subject comparison. Each has a text alternative listing the
numbers.

---

## 5. Public profile: the privacy model

A shared link must not be the private page with the lock removed.

- **Opt-in.** `public_profile` is `false` by default. The student turns it on in
  their profile, and can turn it off at any time.
- **Not an internal id.** The URL uses a random, URL-safe slug
  (`/u/james-7k2p9q`), validated by both the client and the database constraint
  `^[a-z0-9][a-z0-9-]{5,31}$`.
- **Allow-list only.** `GET /api/public/profiles/:slug` selects
  `full_name, school, course_programme, department, faculty, level, avatar_url,
  public_profile_slug` (and `id` internally for verification, never returned),
  but the response carries only `full_name, school, course_programme, level,
  avatar_url, slug, email_verified`. Department and faculty are a fallback for an
  empty programme label, never separate facts.
  Email, phone, matric number, JAMB registration, role, wallet, results and
  notifications are not selected.
- **Opted-in rows only.** The query also requires `public_profile = true`, so a
  slug left behind after turning visibility off returns 404.
- **Verification means a confirmed email.** The badge appears only when
  `auth.users.email_confirmed_at` is set, not because a name was supplied.
- **Not indexed.** `/u/` is in the server disallow list and the client private
  prefixes. A profile link is shareable, not a search result.

The toggle is an immediate setting (it writes exactly the two granted columns),
while academic identity still uses explicit Save/Cancel.

---

## 6. Deliberately not done

- **No new colour tokens.** The brief's table matches the existing tokens; this
  pass did not create a second palette.
- **No date of birth or gender fields.** The database does not store them, and
  the product does not ask for them. The profile shows what exists rather than
  inventing a field to match a mock-up.
- **No public results or examination history.** Even opted in, the public route
  is academic identity only.
- **No chart dependency.** The three charts are small SVG/CSS components.
- **No launch of a public profile for every account.** Opt-in is the default and
  the only way the route can return a row.
- **No modal for saved-item deletion.** The dashboard already uses an inline
  confirmation for results; using the same pattern keeps one destructive
  interaction language and avoids two overlays competing for focus.

---

## 7. Verification

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | pass |
| Focused suites | `node --import tsx --test tests/{dashboard-analytics,notification-tone,profile-save,public-profile,home-search,site-experience,seo,prod-validate,migration-checklist,backup-rehearsal}.test.ts` | pass |
| Full unit suite | `npm test` | 1026 pass, 0 fail, 0 skipped |
| Migration checklist | `npm run migrations:checklist -- --write` | regenerated for 86 migrations |
| Backup rehearsal | `npm run backup:rehearsal` | 86 migrations, 52 tables, 612 columns, 59 policies, 52 with RLS |
| Production validation | `tests/prod-validate.test.ts` | names `20261113000000_public_profiles.sql` when absent |

New tests:

- `tests/dashboard-analytics.test.ts` — ordering, buckets, movement, subject
  validity, highlights, recommendation language.
- `tests/notification-tone.test.ts` — status→tone, explicit type vocabulary,
  action-required, no raw status codes in labels.
- `tests/profile-save.test.ts` — update-first path, seed fallback, failure steps,
  grant mismatch that caused the bug.
- `tests/public-profile.test.ts` — allow-list projection, slug rules, migration,
  API shape, route, indexability, toggle write.
- `tests/home-search.test.ts` — highlight segments, debounce, pending state.
