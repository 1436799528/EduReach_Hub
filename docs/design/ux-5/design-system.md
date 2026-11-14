# UI design system

The contract is [`src/styles/ux5-product.css`](../../../src/styles/ux5-product.css).
It is one layer, loaded after the component sheets and `brand-actions.css` and
before `a11y.css` (pinned by `tests/stylesheet-layers.test.ts`). Existing
component sheets still own their internals; the product layer owns hierarchy,
rhythm, navigation states and the responsive shell.

## 1. Colour

| Role | Value | Where it is allowed |
| :--- | :--- | :--- |
| Primary / action | `#174A3A` (hover `#123C2F`, active `#0D2E24`) | Primary buttons, active navigation, links that start work, focus ring |
| Primary soft | `#EDF5F0` surface, `#CFE4D8` border | Selected navigation, quiet callouts, identity chips |
| Contextual attention | Crimson `#B14933` | Expiry, destructive confirmation, a blocked/attention state. **Not** for neutral labels, step numbers or decoration |
| Status success | `#166534` on soft green | Completed/saved |
| Status warning | `#92400E` on soft amber | Degraded/unavailable-but-not-broken |
| Status error | `#B91C1C` | Validation and failed actions |
| Info | `#1D4ED8` | Informational callouts only |
| Surfaces | `#FFFFFF`, `#F7F8F7`, `#F4F6F5`, `#EDF5F0` | Cards, page, inset regions, selected rows |
| Text | `#131B2E` primary, `#475467` secondary, `#5E6C82` muted | Never use muted text for a title |
| Borders | `#E2E8F0`, `#CBD5E1` (control), `#D8DEE5` (secondary button) | Surfaces and dividers |

Navy `#0A3E83` appears only in the EduReach wordmark. Blue (`#1D9BE0`), logo red
(`#E3232D`) and portal red (`#C02220`) belong to brand assets, not to UI state.
The homepage hero wash was removed; surfaces are flat.

**Verified in the build:** the only crimson on the CBT setup page is now the
"no question bank" warning. Step numbers and the session-type label use the
primary/neutral pair (`evidence/after/setup-jamb-1440.png`).

## 2. Typography

One family (`Inter Variable`) with a six-step role scale. Titles use tight
tracking; body copy uses 1.6 line height; numbers use tabular figures.

| Role | Size / weight | Examples |
| :--- | :--- | :--- |
| Page title | `clamp(24px, 2.4vw, 32px)` / 730, tracking −0.03em | "Overview", "My CBT", "Complete your profile" |
| Section | 17px / 680 | "Choose your exam", "Performance analysis" |
| Card heading | 15px / 650–680 | "Needs attention", "Latest CBT" |
| Body | 14px / 400, 1.6 | Explanations under a section |
| Supporting | 12.5–13px / 400–500 | KPI context, empty-state copy |
| Label | 12px / 560–650 | Field labels, nav groups, table headers |
| Numbers / analytics | 26–32px / 680–720, tabular | KPI values, scores, timer |

Rules:

- **No uppercase labels.** `[class*="eyebrow"], [class*="kicker"]` and the
  dashboard/admin group labels are forced to sentence case. The only surviving
  uppercase is an exam acronym badge (`JAMB`, `WAEC`), which is a proper name.
- **One title per page.** The `<h1>` names the task ("Overview", "My CBT"); the
  student's name is a greeting in the copy, not the heading.
- **No truncated context.** KPI hints wrap (`white-space: normal`) instead of
  ellipsis; a hint is a sentence, not a ticker.
- **Stats are scannable.** Labels are 12 px and quiet; values are large, dark
  and tabular; hints sit on their own line.

Evidence: `evidence/after/dashboard-390.png` shows 2-up KPIs with full hints;
`evidence/before/dashboard-1440.png` shows the uppercase/label problem.

## 3. Spacing and layout

- 4 px base scale (`--er-space-1` … `--er-space-12`). Gaps use 8/12/16/24;
  section rhythm uses 24/32; page top padding uses 20–32.
- Cards use 12 px radius (16 px for large panels), 1 px `#E2E8F0` border and the
  existing `--er-shadow-card`. No new elevation levels.
- Long prose is capped at `68ch`; dashboards and tables use the full column.
- Headers are 64–74 px; the primary row owns it. Search moves into the page at
  ≤1240 px rather than shrinking the navigation.

## 4. Buttons and controls

| Control | Height | Appearance | States |
| :--- | :--- | :--- | :--- |
| Primary | 42 px (44 px coarse) | Green fill, white label | hover darkens, active darker, disabled `#E2E8F0`/`#64748B`, loading shows a spinner and keeps width |
| Secondary | 42 px | White fill, `#D8DEE5` border | hover `#F7F8F7`, never green text |
| Quiet / text | content height, 44 px coarse | No border, underline on hover | Used for "Cancel" in the profile head and "Sign out" |
| Icon | 36–44 px | Neutral stroke icon | Accessible name required |
| Field | 42 px | 1 px `#CBD5E1`, 8 px radius | focus ring, invalid red, valid green |
| Pill / filter | 32 px | Neutral border | selected uses primary green, wraps on phones |

Rules: one primary action per screen region; destructive actions are crimson and
require a consequence sentence; loading keeps the label visible with
`aria-busy`; success is a status message, not a colour change alone.

## 5. Icons

One family: Lucide, 14–18 px in text, 20–22 px in section heads, 1.75 stroke.
No emoji, no mixed outline/filled sets, no icons used as the only label. The
mobile menu uses `Menu` + the word "Menu" (`hub-menu-label`), not an unlabelled
hamburger.

## 6. Cards

The existing card language is kept: white surface, neutral border, 10–16 px
radius, small shadow, no gradient and no colour fill. The home exam cards
previously had four pastel identities; they now share one neutral surface and
carry identity through the exam mark and badge. Card hover is a 3 px left rail
plus a one-pixel border shift, not a lift.

## 7. Motion

Functional only: 120–160 ms on hover/selection, the drawer slide, and the exam
timer. `prefers-reduced-motion: reduce` removes transform-based card hover and
shortens animation. No autoplay or decorative loops.

## 8. Where each rule lives

| Concern | Owner |
| :--- | :--- |
| Tokens, roles, nav, home, responsive shell, control heights, profile/admin rhythm | `src/styles/ux5-product.css` |
| Existing component internals (cards, CBT engine, footer) | their original sheets |
| Focus ring and coarse-pointer tap targets | `src/styles/a11y.css` (last) |
| Dashboard internals (code-split) | `src/student-dashboard.css`, overridden by the product layer with one extra class where hierarchy must win |
| Admin internals (lazy) | `src/admin.css` |

The product layer uses `!important` only where a code-split/lazy sheet loads
later and a hierarchy rule (not a layout ruling) must win; each such rule says
why in a comment. The `a11y.css` tap-target rules are intentionally allowed to
override visual sizing.
