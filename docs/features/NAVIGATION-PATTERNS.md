# Navigation patterns — one system, matched to platform and depth

This app does not offer five competing navigation widgets. It has two product
layers, and each uses the pattern its platform and information depth call for.
The choice is structural, not a matter of taste. This document supersedes the
branch-specific navigation notes in `docs/architecture/UX-10-INTERACTION-PATTERNS.md`;
the current source is authoritative.

| Layer / platform | Primary pattern | Secondary navigation | Why |
| --- | --- | --- | --- |
| Public site, desktop | Five visible top-bar destinations | More menu for lower-priority destinations | A shallow discovery site does not need a sidebar; five links stay visible rather than being hidden in a hamburger. |
| Public site and student workspace, phone | Five always-visible bottom tabs | More / account utilities | Three to five top destinations belong within thumb reach; the phone bar is the primary nav, not a hidden drawer. |
| Student workspace, desktop | Persistent five-tab sidebar | More / secondary utilities | The authenticated dashboard is one workspace with five destinations; the sidebar stays visible and is not collapsed by default. |
| Admin console, desktop | Persistent, capability-aware grouped sidebar | `AdminQuickFind` search accelerator | The console has five grouped sections and many destinations. The sidebar is always expanded and the finder never replaces it. |
| Admin console, phone | Three or four capability-aware primary bottom tabs | More tab opens the full section drawer; Quick Find lives inside that drawer | A 15-link hierarchy cannot be flattened into five honest tabs, so the hamburger is secondary to visible primary destinations and discloses the complete hierarchy. |

## Rules applied

- **Platform:** mobile uses bottom tabs; desktop uses a persistent sidebar where
  the content is genuinely hierarchical. The public desktop row stays a top bar
  because converting a flat five-link discovery site into a sidebar would be an
  unrelated redesign. The student dashboard and admin console already have the
  depth that justifies desktop sidebars.
- **Visible primary destinations:** public and student shells each expose exactly
  five primary destinations. Admin exposes its grouped sidebar on desktop and
  three or four primary tabs on phones. No public or student primary destination
  is hidden behind a hamburger.
- **Hamburger is secondary:** on admin phones the bottom `More` tab opens the
  complete section drawer. The duplicate topbar hamburger is hidden at that
  breakpoint; it is never the only route to the console's primary actions.
- **Search is an accelerator:** `AdminQuickFind` is paired with the visible
  sidebar/drawer. `Cmd/Ctrl + K` focuses the same finder; it is a shortcut for
  power users, never the sole path to a feature. On a phone the shortcut opens
  the drawer and focuses its finder; on desktop it focuses the visible topbar
  field. The field remains visible on desktop, so new users can discover it.
- **Breadcrumbs only for depth > 2:** admin routes are two levels
  (`Admin / Section`), so the second-level breadcrumb was removed. The page
  context label and active sidebar item already identify location. No
  breadcrumbs are added to flat structures.
- **One system:** these are complementary tiers of the same navigation model,
  not interchangeable options to restyle a page on a whim. Public and admin
  phone drawers now share the same right-side placement, focus-managed dialog,
  Escape/outside dismissal, body scroll lock and internally scrollable list.
- **A visible Home/Dashboard bridge:** the public Home has a compact
  `.er-home-dashboard-switch`. The signed-in dashboard keeps its own Home
  switch. Neither transition relies on the hamburger as its only affordance.

## Accessibility notes

- The admin drawer keeps its focus-managed dialog behaviour, labelled trigger
  and visible close control.
- The desktop and mobile quick-find controls are two placements of one
  accelerator; only one is visible at a time, and the keyboard shortcut focuses
  the visible one. The input declares `aria-keyshortcuts`.
- The admin sidebar and nav no longer share `id="admin-navigation"`, so labels
  and skip links resolve to exactly one element.
- The phone bar reserves content padding for the fixed tabs and the safe-area
  inset, so the footer stays reachable.
