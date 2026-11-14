# UX-5 — Product design and responsive system

**Status:** implementation in progress on `arena/0681e5d9-edureach-hub`
(based on `fa51d7d`). The shared shell, homepage, dashboard, My CBT, profile
entry and admin console are implemented and verified. The CBT setup rules,
exam surface and result page are fully specified in the prototype and
wireframes but are **not yet migrated into production**; that gap is listed
below rather than hidden behind a green test run.

**Design bundle:** [`docs/design/ux-5/`](../design/ux-5/README.md)
(assessment, design system, IA/flows, responsive decisions, usability plan,
before/after evidence, 16 wireframes, interactive prototype).

---

## 1. What this work is, and is not

This is a product-design pass on the actual application, not a CSS audit:

- It starts from the running product and its task paths, not from a mood board.
- It changes hierarchy, navigation, copy, layout and state design, and it
  records why.
- It reuses the existing card language and colour identity rather than
  inventing a new skin.
- It does not claim user research that did not happen. No students or staff
  participated; that limitation and a runnable test plan are in
  [`usability-plan.md`](../design/ux-5/usability-plan.md).
- It does not use screenshots as wireframes, and does not call a static mock an
  interactive prototype. The prototype is clickable and labels every simulated
  write.

## 2. Design position

1. **The product states its job before it shows its inventory.** Home leads with
   "Practise the exam you are sitting", two actions and a three-step
   explanation, then the exam choice.
2. **A page title names the task.** "Overview", "My CBT", "Complete your
   profile" — never the signed-in person's name. Identity is a greeting, not a
   heading.
3. **Hierarchy is carried by size, weight and spacing, not by shouting.** Wide-
   tracked uppercase was removed from eyebrows, navigation groups, dashboard
   cards and admin labels. Acronyms carried by an exam badge are the only
   uppercase left.
4. **Green means act; crimson means stop or pay attention; neutral carries the
   page.** Crimson was removed from step numbers, session-type labels and
   decorative accents.
5. **Mobile is a layout, not a scale factor.** The header becomes a labelled
   menu, exam cards become 84 px rows ordered logo → title → arrow, filters
   wrap, and the profile save bar sticks above the bottom navigation.
6. **The interface does not invent new mechanics to look modern.** CBT timing,
   autosave, submission, auth, capabilities, requests and persistence are
   untouched.

## 3. What was implemented

| Area | File(s) | Change |
| :--- | :--- | :--- |
| Global product layer | `src/styles/ux5-product.css` (new), `src/main.tsx` | Tokens (spacing, type roles, radius, control heights), page/section hierarchy, navigation states, home system, exam cards, dashboard/MyCBT/profile rhythm, control heights, admin console rhythm, reduced-motion. Loaded after component sheets and before `a11y.css`. |
| Header and mobile navigation | `src/components/HubLayout.tsx` | One `hub-nav-link` class for every primary destination with `aria-current="page"`; quiet WhatsApp link; labelled `Menu` button; desktop nav hidden below 900 px; header search hidden below 1241 px so the page owns search; mobile drawer lists the same destinations plus signed-in shortcuts. |
| Homepage | `pages/HubHomePage.tsx` | Visible product statement (`h2`, one hidden `h1`), supporting copy, "Start CBT practice" / "Browse past questions", proof line (4 exam bodies, exam pacing, answers saved), desktop 3-step rail, search in flow, quiet study-centre banner, neutral exam cards with a single hover rail, simplified mobile rows. |
| Student dashboard | `pages/StudentDashboardV2.tsx` | Page title "Overview" with a named greeting beneath it; rewritten hints; notifications section retained; attention-first order preserved. |
| My CBT | `src/styles/ux5-product.css` overrides | Metric row finishes flush (flex instead of a fixed four-column grid); sentence-case labels; subject progress and practice suggestion get card surfaces; empty copy is left-aligned body text; table headers and status pills are sentence case. |
| Profile | `pages/ProfileCompletionPage.tsx`, product layer | Removed the duplicate full-size "Cancel" under the title in favour of one quiet text action; save bar sticky above the bottom bar on phones; completeness block no longer competes with the title. Persistence and unsaved-changes confirmation untouched. |
| Admin console | `pages/AdminLayout.tsx`, product layer | `ADMIN_CONSOLE_NAV` grouped into People / Learning / Requests / Content / System (plus Overview); capability filtering unchanged; group labels sentence case; KPI labels readable and "Unavailable" no longer breaks mid-word at 390 px. |
| Setup surface | product layer | Neutral session/time label and primary-coloured step numbers; the empty-bank warning is the only crimson element. |
| Footer | product layer | Column headings sentence case; privacy choice still opens from footer markup and the `edureach:open-cookie-settings` event. No floating control was reintroduced. |
| Contract tests | `tests/stylesheet-layers.test.ts`, `tests/type-system.test.ts`, `tests/site-experience.test.ts`, `tests/interaction-states.test.ts`, `tests/ux-audit.test.ts` | Updated to the accepted UX-5 contract: one new layer in the documented order, a visible home statement with one hidden `h1`, shared nav class + `aria-current`, and a dashboard title naming the task. The old "no promotional hero" assertion was intentionally retired by this brief; its accessibility intent (one h1) is preserved and strengthened. |
| Documentation | `docs/architecture/STYLESHEET_LAYERS.md`, new `docs/design/ux-5/*` | Sheet order and purpose, design bundle, evidence. |

No database migration, route, API contract, auth rule or CBT timing/scoring
change is part of this work.

## 4. The design system in one page

Full detail: [`design-system.md`](../design/ux-5/design-system.md).

- **Colour:** primary `#174A3A`; neutral surfaces/borders/text; crimson
  `#B14933` only for contextual attention/destructive; navy `#0A3E83` wordmark
  only; semantic status colours for success/warning/error/info.
- **Type:** page title `clamp(24px,2.4vw,32px)/730`; section 17/680; card
  15/650; body 14/400 at 1.6; supporting 12.5–13; label 12/560; numeric 26–32
  with tabular figures.
- **Spacing:** 4 px base; 8/12/16/24 gaps; 24/32 section rhythm; prose capped at
  68ch.
- **Controls:** 42 px standard, 44 px on coarse pointers; one primary action per
  region; disabled, loading and success states specified; no colour-only state.
- **Icons:** Lucide only, 14–18 px in text; no emoji or mixed families.
- **Cards:** existing white surface, 1 px neutral border, 12–16 px radius,
  existing shadow; no gradients, coloured cards or new elevation.
- **Motion:** functional, 120–160 ms; reduced-motion honoured.

## 5. Flows and information architecture

Full detail: [`ux-ia.md`](../design/ux-5/ux-ia.md).

The student map is five jobs — practise, look something up, ask for help, read
an update, fix the account. The admin map is four — see what needs action, work
a queue, manage learning content, manage the platform.

Implemented navigation changes:

- Six primary header destinations, each owning one job, with one shared active
  style; "Talk to us" is deliberately quieter.
- Signed-in dashboard: task links first, then a "Study" group, then account.
- Admin: five job groups instead of a flat 15-link list.

Journeys documented end-to-end: CBT (home → choose exam → setup → exam →
submit → result → My CBT), profile edit/persistence, service request/tracking,
resource discovery, admin queue action.

## 6. Responsive decisions

Full detail: [`responsive.md`](../design/ux-5/responsive.md).

| Width | Deliberate layout |
| :--- | :--- |
| 320 / 360 | One column; 2-up KPIs from 360; labelled menu + 5-item bottom bar; 84 px exam rows; filters wrap |
| 390 / 430 | Same single column with sticky save bar above the bottom bar and safe-area padding |
| 768 | Two-column card grids where content supports it; drawer still used for touch |
| 1024 | Header drops the link row in signed-in areas; sidebar appears; admin summary 2-up |
| 1280 / 1440 | Six-link header, in-page search, hero copy + 3-step rail, 4-up exam grid, capped prose |

Verified at all eight widths with real screenshots. Result: **0 document
overflow, 0 element overflow, 0 page errors** across 72 public, 42 authenticated
and 8 admin captures.

## 7. Accessibility and interaction integrity

- One `h1` per page; the home page's visible statement is an `h2` beneath the
  visually hidden `h1`.
- Active navigation is green text + underline + `aria-current="page"`, not
  colour alone.
- The drawer trigger has a visible "Menu" label (hidden below 370 px, where the
  icon keeps an accessible name and a 44 px target).
- Coarse-pointer targets remain enforced by `a11y.css`; the profile's quiet
  "Cancel" gets the same 44 px minimum without looking like a primary button.
- Empty states, errors and success are text, not colour-only.
- No focus-ring rule was moved after `a11y.css`.
- Reduced motion removes transform hover and shortens transitions.

## 8. Wireframes and prototype

### Wireframes

16 SVGs under [`docs/design/ux-5/wireframes/`](../design/ux-5/wireframes/index.html),
each with a desktop (1280) and a mobile (390) frame:

- Student: home, dashboard, My CBT, CBT setup, examination, result, profile,
  notifications.
- Admin: overview, navigation, users, questions, exams, service requests,
  content, system settings.

They are structural drawings (greyscale regions, labels, focus order), not
screenshots. Regenerate with `node scripts/ux5-wireframes.mjs`.

### Interactive prototype

[`docs/design/ux-5/prototype/index.html`](../design/ux-5/prototype/index.html)
— student and admin shells, hash routes for dashboard, setup, exam, result,
My CBT, profile, notifications, admin overview/users/requests/questions. It
supports option selection (A–D keys), next/submit, subject rules, profile save
state, and an admin record drawer with a required reason. Every write ends with
a `Simulated:` / `Prototype:` toast; it makes no network request.

Prototype verification: 11/11 routes render, answer selection sets
`aria-pressed`, next question advances, profile save reaches "Saved just now",
admin drawer opens, **0 page errors**.

## 9. Evidence

[`docs/design/ux-5/before-after.md`](../design/ux-5/before-after.md) lists each
screen with before, after and the check performed. Screenshots are in
`docs/design/ux-5/evidence/{before,after,prototype}/`.

Capture method: the production dev server plus `@sparticuz/chromium` on an
extracted Amazon Linux runtime, one browser context, viewport resized per shot,
fonts and data settled before capture, mocked Supabase auth/profile/attempts
for authenticated routes, mocked admin session for the console. Before shots
were taken from a worktree at `fa51d7d`; after shots from this branch. The
harness is intentionally not committed because it depends on a Chromium runtime
that is not a project dependency.

## 10. Test results

| Gate | Command | Result |
| :--- | :--- | :--- |
| Typecheck | `npm run typecheck` | pass (exit 0) |
| Unit/integration | `npm test` | 1,062 tests, 1,062 pass, 0 fail |
| Browser e2e | `npm run test:e2e` | 291 passed, 29 skipped |
| Build | `npm run build` | pass |
| Accessibility | `npm run a11y:audit` | 0 blocking, 6 informational |
| Performance | `npm run perf:audit` | all budgets pass |
| RLS | `npm run rls:audit` | 53/53 |
| Migration checklist | `npm run migrations:checklist` | 89/89 |
| Responsive overflow | browser sweep (above) | 0 document / 0 element overflow |

Performance after UX-5:

| Metric | Actual | Budget |
| :--- | :--- | :--- |
| Bundle CSS (gzip) | 49.1 KB | ≤ 51.0 KB |
| Critical path (gzip) | 210.6 KB | ≤ 211.0 KB |
| All chunks (gzip) | 362.7 KB | ≤ 365.0 KB |
| Entry chunk (gzip) | 47.1 KB | ≤ 100.0 KB |

The CSS layer costs ~3.2 KB gzip and leaves 1.9 KB under the CSS budget and
0.4 KB under the critical-path budget. That is tight: the next change should
trim or replace rules rather than raise the cap by habit.

**Contract-test note:** five design-contract tests were updated with the
implementation because the brief deliberately changed the old contract (a home
page with no visible statement, the student's name as the dashboard title, and
a stylesheet order with no product layer). Their accessibility intent — one
`h1`, `aria-current` on navigation, a11y.css last — was preserved and
strengthened. No functional assertion was removed.

## 11. Preservation checks

- CBT correctness/timing: untouched; all CBT unit and e2e specs pass.
- Question banks and admin CBT surfaces: untouched; capability filtering
  asserts still pass.
- Auth/authz: untouched; admin session mock is a test harness only.
- Service ops: untouched; request lifecycle specs pass.
- Profile and notification persistence: markup-only change to the profile
  cancel action; save/discard handlers unchanged.
- Database relationships/migrations: none.
- Production API: no endpoint change.
- Card language: reused; no new card style or coloured surface.
- Privacy control: still footer-only; no floating cookie control.

## 12. Outstanding work (explicit)

1. **CBT setup production migration.** Rule cards, "Required" chip on Use of
   English, max-four-subject feedback and sticky summary exist in the prototype
   and wireframe, not yet in `ExamSetupPage`.
2. **Exam surface.** Persistent paper/timer bar, flag-for-review legend and
   palette state styling are specified and prototyped; the production session
   page still uses the previous chrome.
3. **Result page.** Score ring, "what this means", subject breakdown and next
   step are prototyped; not yet migrated.
4. **Profile summary page.** Grouped summary card with completeness ring is
   prototyped; production uses the existing completion form.
5. **Notifications page.** Unread emphasis and per-item action are prototyped;
   production uses the existing notification centre.
6. **Services apply/track.** Catalogue/detail/tracking screens are documented
   but not redesigned beyond shared shell.
7. **Admin record drawers.** Prototype demonstrates the required-reason +
   notify-student pattern; production queue still uses its current flow.
8. **Usability testing with people.** Not performed. The runnable plan is in
   [`usability-plan.md`](../design/ux-5/usability-plan.md); any claim of
   "students understand it unassisted" remains unproven until it is run.
9. **Deployment.** Production republishing is outside this branch's work and
   was not re-diagnosed here; a green build is not proof that the host is
   serving this commit.

## 13. Limitations of this evidence

- Authenticated screens use mocked Supabase data; they prove layout, labels,
  hierarchy and interaction wiring, not production data volume.
- The admin console was captured with a `super_admin` mock; per-role screens
  were not individually photographed.
- Screenshots are viewport captures, not full-page, except where a defect
  required a full-page check. Layout overflow was measured on the document, not
  inferred from images.
- The capture harness uses a headless Chromium build without a physical device;
  safe-area and software-keyboard behaviour are enforced by CSS but not
  observed on hardware.
- CI green is necessary but not sufficient; the remaining screens above are
  the design work still to do.
