# Mobile-first site standard

**Status:** implemented on `arena/09d41946-edureach-hub`, based on `96daac1`. This is a source-and-contract delivery: no hosted Supabase or Vercel setting was changed.

The audit found six inconsistencies rather than one broken page: cards that grew into full-screen scrollers, search fields that filtered but offered no suggestions, drawers whose focus/scroll rules differed, hidden navigation switches, role labels assembled ad hoc, and an admin UI with no safe account-deletion path. The fixes are shared contracts so new routes inherit the behaviour instead of adding per-page CSS.

## 1. Compact, honest cards

- The existing `84px` phone simulator card remains the geometry reference for a compact one-purpose card; see `docs/features/SIMULATOR-CARD-STANDARD.md`.
- News, scholarships, jobs and similar *content* cards opt into `.er-standard-card-grid`. On phones this is one readable column, not a snap scroller. A card uses a `64px` thumbnail, a `minmax(0, 1fr)` text column and an `18px` arrow track, with `min-height: 104px` to fit category, headline, summary and metadata.
- Facts are never replaced by an image or a decorative teaser. Category, date/source, summary, eligibility/deadline and link remain in the document; `-webkit-line-clamp` is used only where the full value is available to assistive technology and the linked destination.
- `.er-comfort-page` supplies shared mobile section rhythm. Search/filter groups are stacked and full width; only genuinely short actions remain inline.
- The final mobile override lives at the end of `src/styles/ux5-product.css`, after legacy full-screen and square-card rules. CSS cascade order is therefore part of the contract.

## 2. Suggestions on every current-page field

- `src/lib/searchMatch.ts` owns tokenisation and `filterSearchSuggestions()`. Every configured field is normalised and scored; tokens match at the **start, middle or end** of a word, in any order, across title and non-title fields. All tokens must match. Empty/punctuation-only queries produce no invented suggestions.
- `FilterSearch` is a combobox with an ARIA listbox, `aria-expanded`, `aria-controls`, `aria-activedescendant`, visible `<mark>`ed matches, Escape, Enter, Up/Down, clear, and outside dismissal. Home/End continue to edit the text caret rather than being hijacked by the list. Every placement uses the same built-in surface; there is no second custom-popover mode.
- `SiteSearch` now offers the same suggestions in `page` placement, with a shorter list of four and a higher z-index so the full results page does not paint cards over the menu.
- Public current-page fields (News, Jobs, Services, Past Questions, School Finder, dashboard School Finder) and admin current-page fields (News, Schools, Institution Intelligence, Content Manager, CBT questions, Bank Security candidates) supply suggestions from **all visible fields of the rows they filter**. Admin forms use shared `AdminFilterSearch`; server-backed forms can supply `onSubmit` and an explicit Search button, so they do not issue a request on every keystroke.
- Navigation-wide `SiteSearch` and server-side lookups retain their existing responsibilities. This change does not turn a lookup endpoint into a second filter.

## 3. One drawer and navigation contract

- Both public and admin phone menus are right-side drawers. `useModalDialog` owns labelled dialog semantics, initial focus, Tab containment and restore-on-close; `useDrawerDismiss` owns Escape, pointer/click-outside dismissal and body scroll locking.
- The drawer is `flex-end`, `100dvh` high, content-scrollable (`overflowY: auto`) and safe-area aware. Long navigation lists remain reachable on short screens.
- `pages/HubHomePage.tsx` has a visible `.er-home-dashboard-switch` so the transition from public Home to the signed-in dashboard is discoverable rather than hidden behind an icon.
- The fixed phone bottom bar, breadcrumb depth rule and quick-find shortcut from `docs/features/NAVIGATION-PATTERNS.md` remain in force.

## 4. CBT tabs

- The session subject `tablist` is explicitly horizontal and centred on phones. It uses roving `tabIndex` (one Tab stop), Left/Right/Home/End keys, `aria-selected` and focus transfer to the newly active tab.
- Filter pills and other horizontally scrolling controls use shared centred wrapping where practical; they do not assume a wide desktop viewport.

## 5. Role presentation and the public/private boundary

- `src/lib/rolePresentation.ts` is the one map from a resolved application role to a short label, description and colour set. `resolveAppRole()` in `src/lib/capabilities.ts` normalises raw, legacy and retired values, so retired half-roles cannot be mistaken for staff in one page and treated as students in another. The public `display_role` uses that same resolved role.
- Four public tones are used: student green, content editor blue, service admin teal, super admin gold. `RoleBadge` and the enhanced `VerifiedBadge` consume the same map.
- The public profile selects only the allow-listed display columns plus `role` to derive the coarse `display_role`. It never returns `id`, contact details, matric/JAMB numbers, preferences or the capability matrix. Opt-in filtering and `/u/:slug` noindex SEO behaviour are unchanged.
- The admin capability matrix displays the shared role label and badges; it does not expose role colours as authorization logic. Capability checks remain server-side.

## 6. Safe account deletion

- `user.delete` is a `super_admin`-only capability. The Delete control is behind `<Can capability="user.delete">`, a destructive confirmation and an explicit button. Suspend remains the reversible first choice.
- `DELETE /api/admin/users/:userId` requires the capability, refuses self-deletion, refuses deletion of the last super admin, deletes the auth user, writes `user_delete` audit events for success/failure, and returns a clear FK/audit `409` recommending suspension rather than cascading away history.
- The endpoint is additive; the existing user/read, suspend and role-management contracts are unchanged.

## Verification contract

Source contracts live in `tests/news-cards.test.ts`, `tests/home-search.test.ts`, `tests/site-experience.test.ts`, `tests/public-profile.test.ts`, `tests/authorization.test.ts` and `tests/ui-patterns.test.ts`. A complete delivery runs:

```sh
npm run typecheck
npm test
npm run build
npm run a11y:audit
npm run perf:audit
git diff --check
```

At phone width, also check that cards fit without horizontal clipping, a suggestion list is above the cards, drawer long-list content scrolls while the body does not, the Home/Dashboard switch is visible, and CBT subject tabs are centred and arrow-key navigable. At desktop width, check that the new mobile rules do not alter the established layouts.

The added shared combobox and role modules are kept inside the existing
`PERF-1` budgets by semantics-preserving terser passes and by stripping
ordinary `console.*` calls from the production bundle. The error boundary's
qualified `globalThis.console.error` call remains available for a genuine
runtime failure; budgets were not raised.

## Browser verification

Headless Chromium checks at `390×844` (phone) and `1280×800` (desktop), with a
small mocked news/opportunities payload, confirmed:

- Home/Dashboard switch visible and no horizontal page overflow.
- Right drawer uses `justify-content:flex-end`, locks body scroll, keeps focus
  inside, is labelled, scrolls internally, and restores focus on Escape.
- News cards use one `362px`-wide column, `104px` minimum height, `123px`
  actual height, no snap scrolling, and a visible source line.
- Suggestions are a real combobox/listbox with marked matches, overlay the
  cards/filters, populate `aria-activedescendant`, and select on Enter.
- Jobs cards wrap all status chips, keep all three eligibility/source/last-
  checked facts visible, and fit the phone without horizontal overflow.
- Services shows one phone search field and hides the duplicate desktop field.
- Desktop News remains a three-column grid; CBT subject-tab CSS computes
  `justify-content:center`.
- No uncaught page errors were observed.
