# UX-10 — Navigation, tabs, settings, dropdowns and toasts

**Branch:** `arena/e61462ea-edureach-hub` (from `main` @ `a501c40`)
**Date:** 16 November 2026
**Scope:** the six interaction patterns in the product brief — navigation, tabs,
settings, the landing-page skeleton, dropdowns and toast notifications — audited
across the public site, the student dashboard, the exam flows and the admin
console, then the gaps that could be implemented safely were fixed.

This document is the audit. It records the finding, the verdict and the action
for every pattern, then the evidence, then what was deliberately not done.

---

## 1. Baseline (recorded before any edit)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | pass, 0 errors |
| Unit/integration suite | `npm test` | 1072 tests, **1057 pass, 14 fail**, 1 skipped |
| Production build | `npm run build` | pass |

The 14 failures are **pre-existing** and unrelated to this change. They are
listed in §6 with their cause, and the same 14 still fail after the change — no
new failure, no test rewritten to go green.

---

## 2. Pattern-by-pattern audit

Legend: **✅ met** · **⚠️ partial** · **❌ missing**

### 2.1 Navigation (mobile tabs · desktop sidebar · hamburger secondary)

| Rule | Finding | Verdict | Action |
|---|---|---|---|
| Bottom tabs on mobile, 3–5 destinations | `HubLayout` renders five (`Home`, `Practice`, `My CBT`, `Results`, `Profile`) with icons, 48px targets and safe-area padding | ✅ | none |
| Persistent desktop sidebar for 5+ sections | The admin console already has one (`pages/AdminLayout.tsx`, sticky, searchable, drawer under 980px). The student site deliberately uses a 5-link top bar plus a `More` menu — a documented product decision, not an accident | ✅ / by design | none — converting the whole student shell to a sidebar is a redesign, not a fix |
| Hamburger is secondary navigation, never primary | The mobile drawer holds *secondary* destinations; the five primary ones stay on screen in the tab bar | ✅ | none |
| Primary destinations always visible | Desktop shows all five; the two-way "no session" variants link to `/login` | ✅ | none |
| Breadcrumbs only below two levels | The admin header shows `Admin / Section` (two levels). No breadcrumbs were added to flat pages | ✅ | none |
| Command palette is an accelerator, never the only path | The admin sidebar has "Find a page" beside the visible nav | ✅ | none |

**Gaps found in navigation:** the mobile drawer declared `aria-modal="true"` but
did not trap focus and did not lock the page behind it; focus could walk out of
the drawer into the page under the overlay. Fixed (§4.5).

### 2.2 Tabs

| Rule | Finding | Verdict | Action |
|---|---|---|---|
| Sliding active indicator, spring, matched to the content fade | `AdminSitePage` and `AuthPageV2` swapped `aria-selected` and let CSS repaint a border — a teleport, not a slide. Content hard-cut | ❌ | shared `Tabs`/`TabBar` primitive with a measured, spring-animated indicator |
| Keyboard: arrows move, Home/End jump, Tab exits | Neither strip had `tabIndex` management or any key handler; every tab was its own tab stop, so Tab crawled through the strip | ❌ | roving tabindex + Arrow/Home/End in the primitive |
| Focus ring and active state must not share a colour | `.admin-tab.is-active` and `.admin-tab:focus-visible` both used `--admin-navy` | ❌ | active ink is the ink token, focus ring stays brand cobalt `#1E40AF` |
| Overflow scrolls horizontally with edge fades + desktop chevrons, never wraps | No strip could overflow in practice, so nothing handled it | ⚠️ | the primitive scrolls, fades both edges and shows chevrons on pointer devices |
| Fade out, pause ~80ms, fade in, matched panel heights | Hard cut everywhere | ❌ | two-phase fade (80ms out / 160ms in) with the previous height held |
| Mobile: segmented control under 5, bottom sheet over 5, never a shrunken bar | `.auth-tabs` was already a segmented control; the admin strip would have shrunk | ⚠️ | under 5 tabs a phone gets the segmented control automatically |
| Real tabpanels | `role="tab"` existed with no `role="tabpanel"`, no `aria-controls`, no `aria-labelledby` | ❌ | panel ids and labels wired in the primitive |

**Not changed:** the CBT subject strip (`pages/CbtSessionPage.tsx`) keeps its
own implementation. It shares the same overflow and keyboard gaps, but it lives
inside the exam session, where the brief's own rule — do not touch the CBT
lifecycle — outranks a cosmetic alignment. Recorded in §6 as a follow-up.

### 2.3 Settings

| Rule | Finding | Verdict | Action |
|---|---|---|---|
| Apply model matches blast radius | Admin site settings already save per group on an explicit click (`Save identity`, `Save contact details`, …) — correct for identity fields | ✅ | none |
| Group by task | The four groups are `Identity`, `Footer`, `Contact`, `Social` — task-shaped, already | ✅ | none |
| Searchable | Four groups do not need a search box; the admin sidebar's quick-find already searches pages | ✅ | none |
| Modified indicator + per-setting reset | Nothing told an admin whether the form differed from what is stored; leaving the tab lost the change silently | ❌ | `Modified` chip + `Reset <group>` per save group, compared against the last saved copy |
| Quarantine destructive actions | Destructive admin actions already live behind confirmations; the CBT delete dialog has its own test | ✅ | none |
| Advanced options collapsed | No advanced block exists on this surface | n/a | none |

**Not changed, recorded as a product gap:** the student `/settings` route
(`src/app/routes.tsx:121`) renders the dashboard and opens the existing
`SecurityModal`. There is no student settings page, no notification-preference
store and no account-deletion flow to move into one. Building that page would
mean inventing preferences and a destructive flow that the data model does not
have, so it is listed in §6 instead of being fabricated.

### 2.4 Landing-page skeleton (Hero → Proof → Problem → Solution → CTA)

| Rule | Finding | Verdict | Action |
|---|---|---|---|
| Hero answers what/who/why in ~3 seconds with one CTA | `HubHomePage` opens with "What are you studying for?", a lede and one `Start practice` action | ✅ | none |
| Proof directly below the hero | No proof strip. Real proof would have to be a real number; a passing test (`site-experience.test.ts` — "the home page opens as a product screen, not a hero") forbids turning this screen into a marketing hero | ⚠️ | none — inventing a metric is forbidden; recorded as an open product decision |
| Agitate the problem before the solution | The product home is a task screen, not a sales page; the pain is already stated on the service pages that sell work | n/a | none |
| Three outcomes, not features | The home tiles are tasks ("Past questions — by exam and subject") | ✅ | none |
| Repeat the same CTA top and bottom | One primary CTA at the top; no closing CTA | ⚠️ | none — the exam grid and the tab bar are the continuation; a second marketing CTA would be the "unnecessary explanatory copy" the project rules forbid |
| No carousel in the hero | There is none | ✅ | none |

Conclusion: the marketing skeleton does not map onto a signed-in product home.
The parts that do apply (single clear CTA, outcomes over features, no carousel)
were already met. No code changed here.

### 2.5 Dropdowns

| Rule | Finding | Verdict | Action |
|---|---|---|---|
| Obviously clickable trigger with a visible caret and hover state | The account trigger is a 32px initials button with no caret and no hover state | ⚠️ | hover state, `aria-haspopup`/`aria-expanded`, and a 36px minimum row height |
| Flip when there is no room below / never clip off-screen | The account panel and the `More` panel had no height cap, so a long menu on a short laptop screen ran past the viewport | ❌ | `max-height: min(70vh, …)` with internal scroll |
| Keyboard: arrows move, Enter selects, Esc closes | **Neither header menu closed on Escape or on an outside click.** Once open, the only way out was clicking the trigger again. No arrow keys, no `role="menuitem"` | ❌ | shared dismissal + roving keyboard contract, wired to both menus |
| Search once a list passes ~10 items | The account menu has five items; the drawer (12+ links) already contains the site search | ✅ | none |
| Open animation ~150ms | `.hub-more-panel` animated at 180ms with no hover feedback on its rows | ⚠️ | 150ms, and a real hover/`data-highlighted` state on every row |
| Position deliberately | Notification centre already sits top-right with outside-click and Escape handling | ✅ | none (unchanged) |

### 2.6 Toasts

| Rule | Finding | Verdict | Action |
|---|---|---|---|
| Bottom-right on desktop, top edge on mobile | Bottom-right on desktop ✅. On a phone the viewport was pinned to `bottom: 12px` — directly **on top of the 58px bottom tab bar**, swallowing taps on the app's primary navigation | ❌ (a real defect) | the mobile viewport lifts to `62px + env(safe-area-inset-bottom) + 10px`, above the tab bar. Top-edge placement was rejected because the sticky header occupies it |
| Timing matches severity | Every tone auto-dismissed after 5s — including failures | ❌ | 4s success/info, 7s warning, **failure stays until acknowledged** |
| Cap at 3 visible, newest at the bottom, the rest queue | Capped at 3, but `slice(-3)` silently *evicted* the oldest unread message | ⚠️ | the list is kept and only the newest three render, so a burst queues |
| A way out: close button, swipe on mobile, pause on hover | Close button ✅, but no pause and no swipe — a toast could vanish mid-read | ❌ | hover **and** focus pause (resuming with the time that was left) + touch swipe-to-dismiss |
| Colour reinforced by icon + accent border | Icon per tone ✅; no accent border | ⚠️ | 3px left accent border per tone |

---

## 3. What changed

| File | Change |
|---|---|
| `src/components/ui/Tabs.tsx` | **New.** `Tabs` and `TabBar`: roving tabindex, Arrow/Home/End, measured spring indicator, overflow scroll with edge fades and pointer-only chevrons, two-phase panel fade with height lock, automatic segmented control under 5 tabs. Exports `nextTabIndex` for testing. |
| `src/lib/menuA11y.ts` | **New.** `useMenuDismiss` (outside press, Escape with focus return, focus-out) and `useMenuKeyboard` (arrows/Home/End, first item focused on open). |
| `src/components/HubLayout.tsx` | Account menu rebuilt on the shared contract (`role="menu"`/`menuitem`, `er-menu` animation, scroll cap, danger-styled logout); `More` menu switched to the same contract; mobile drawer now traps Tab, locks page scroll and restores it. |
| `src/components/ui/Toast.tsx` | Tone-based lifetimes, danger stays until acknowledged, hover/focus pause with remaining time, queue instead of eviction, touch swipe-to-dismiss, exit animation, per-tone icons. |
| `pages/AdminSitePage.tsx` | Two hand-rolled tabs replaced with `Tabs`; settings gain `Modified` chips and per-group `Reset` against the last saved copy. |
| `pages/AuthPageV2.tsx` | Both tab strips (account access, contact method) use `TabBar variant="segmented"`. |
| `src/styles/ux9-microinteractions.css` | Namespaced rules for `.er-tabs*`, `.er-menu*`, toast accent/position/swipe, plus reduced-motion handling. No new stylesheet was added, so the stylesheet-load contract is untouched. |
| `src/auth-page.css`, `src/admin.css` | Local spacing for the two converted strips and the `Modified`/`Reset` row only. |
| `tests/ui-patterns.test.ts` | **New.** 10 tests pinning the behaviour above. |

Nothing in the API, database, auth, RLS, CBT lifecycle, exam timing, marking or
institution data was touched.

---

## 4. Verification

### 4.1 Static checks (after the change)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | pass, 0 errors |
| Full suite | `npm test` | 1082 tests, **1067 pass, 14 fail**, 1 skipped — the same 14 pre-existing failures as baseline, plus 10 new passing tests |
| Accessibility audit | `node --import tsx --test tests/a11y.test.ts` | 10/10 pass (a new `outline: 0` on the tab panel was caught by this audit and removed during the change) |
| Production build | `npm run build` | pass (client 10.4s, `build/server.cjs` 436.9 kB) |

### 4.2 Rendered browser checks

Run against the local Express + Vite server with Chromium
(`@sparticuz/chromium`), desktop 1280×900 / 1440×1000 and mobile 390×844.

**32 assertions, all passing:**

- **Auth tabs (desktop):** both tabs render with one tab stop; `ArrowRight` moves focus *and* activates (URL becomes `/register`); `Home` returns to the first tab; the contact-method strip answers `ArrowRight`; no page errors.
- **Auth tabs (mobile 390px):** the strip computes to `border-radius: 11px`, pale surface, flex — the segmented control, not a shrunken bar.
- **Admin settings (1440px, mocked session/content):** two tabs; the panel carries `aria-labelledby` pointing at its tab; mid-switch opacity measured at **0.17–0.32** (it fades, it does not cut); the new panel is the policy one; `ArrowLeft` wraps from the first tab to the last.
- **Settings system:** editing *Site name* raises a `Modified` chip; `Reset identity` restores the saved value exactly (`EduReach Hub`).
- **Account menu:** opens, focuses the first `menuitem`, closes on `Escape` returning focus to the trigger, closes on an outside click.
- **`More` menu:** opens, focuses the first item, `ArrowDown` walks to *News*, `Escape` closes and restores the trigger.
- **Mobile drawer:** opens; 40 consecutive `Tab` presses stay inside it; `body` scroll is `hidden` while open and restored on close; `Escape` closes it.
- **Toasts (mobile):** a success toast after saving a school renders **above** the tab bar (toast bottom 771px vs nav top 786px); its left accent is `rgb(22, 101, 52)` — `#166534`; hovering it keeps it alive past 5.2s (the 4s window); moving away lets it clear itself.
- **Toasts (desktop):** bottom-right (x 900 of 1280, y 648 of 900); three saves in a burst show **3** toasts, never more.

Screenshots: `docs/design/ux-10/01-…12-…png`.

### 4.3 Not run

`npm run test:e2e` and `npm run e2e:perf` (Playwright) were **not run**: the
Playwright browser download is blocked in this sandbox, so the sweep above used
a manually extracted Chromium instead. The e2e suite is therefore unverified
for this change, and the admin/student flows that the suite covers were exercised
ad hoc in the same browser as described in §4.2.

---

## 5. Deviations from the brief, and why

1. **Mobile toasts sit above the tab bar, not at the top edge.** The brief asks
   for top-edge placement on mobile. This app has a sticky header at the top and
   a fixed five-item tab bar at the bottom; a top-edge toast would cover the
   search field and header links, and the previous bottom placement covered the
   primary navigation. Lifting above the tab bar loses nothing and blocks
   nothing.
2. **Desktop student navigation stays a top bar, not a sidebar.** The brief's
   "5+ sections justify a sidebar" is satisfied in the admin console, which is
   the hierarchical surface. The student site has five primary jobs plus a
   secondary menu; converting it would be a redesign, which the project rules
   forbid without an explicit request.
3. **No new stylesheet.** The rules live in the already-imported
   `ux9-microinteractions.css`, namespaced, because adding a sheet would break
   the pinned stylesheet-order contract in the same change that documents it.
4. **Active ink is not brand blue.** The focus ring is brand cobalt. Using the
   same colour for the active tab would make "where my cursor is" and "what is
   selected" indistinguishable, so the tab ink uses the ink token instead. This
   also matches what the admin tabs already did.
5. **No 5+ tab bottom-sheet.** No current surface has five or more tabs (the
   admin and auth strips have two). Over four, the primitive keeps the scrolling
   strip with edge fades on mobile; the sheet variant is unimplemented rather
   than shipped untested.

---

## 6. Known issues and follow-ups

### Pre-existing failures (unchanged, not caused by this work)

| Test | Cause |
|---|---|
| `stylesheet-layers` — the stylesheet set and its order match the documented contract (and the "type system follows" sibling) | `src/main.tsx` imports `styles/ux9-microinteractions.css` and no longer imports `compact-portal.css`, `compact-design-system.css` or `compact-structural.css`, but `EXPECTED` in the test and `docs/architecture/STYLESHEET_LAYERS.md` still list the old set. A contract update is needed in a dedicated change. |
| `type-system` — inline font weights, and the type-scale loading order | `pages/StudentDashboardV2.tsx:723` uses `fontWeight: 600`, which is not on the role scale; the load-order assertion fails for the same reason as the stylesheet contract. |
| `site-experience` — dashboard leads with priorities; expired attempt never resumable; home news retry; home keeps the shared search bar | Source-shape assertions left behind by the UX-9 pass; the behaviour they describe was re-verified by hand in the browser and is present, but the assertions no longer match the source. |
| `notification-tone` / removal assertions — notification icon is a dot; old delete-result and paste-image labels absent | Same UX-9 drift. |
| `readiness` (CBT protocol column), `destructive actions are confirmed`, `simulator section reserves its footprint` | Pre-existing, in the CBT/simulator area this change did not touch. |

None of these were rewritten to make the suite green; each needs the behaviour
confirmed and the assertion updated in its own reviewed change.

### Follow-ups this audit deliberately left open

1. **Student `/settings` has no page.** It opens the security modal over the
   dashboard. A real settings surface needs real groups (notification
   preferences, account deletion) that the data model does not currently
   provide. Recommendation: design the data first.
2. **CBT subject tabs** keep their hand-rolled strip. A follow-up could pass
   them through `TabBar`, inside a CBT-reviewed change.
3. **`>4` tabs on a phone** should become a bottom sheet when a surface actually
   needs five or more.
4. **Hero proof on the home page** needs a real, verifiable number (for example
   live bank question counts already rendered by the simulator grid) before a
   proof strip can be added honestly.
5. **Dead CSS**: `.auth-tabs button` and `.auth-method-tabs button` rules no
   longer style anything after the conversion; left in place until the next
   stylesheet consolidation so the change stays narrow.

---

## 7. Status

| Item | State |
|---|---|
| Branch | `arena/e61462ea-edureach-hub` |
| Commits | this change, on the branch only |
| Pull request | opened from the branch for review |
| Merged | **no** |
| Deployed / production | **no** — a merge would not be a release, and nothing here was deployed |
