# Responsive and adaptive design decisions

The target is a deliberate layout at each width, not a desktop page scaled
down. Breakpoints follow the content, not a device list; the tested widths are
the brief's widths plus 1280.

## Width-by-width intent

| Width | Layout | Navigation | Notable decisions |
| :--- | :--- | :--- | :--- |
| **320** | One column, 16 px gutters. Page title 24 px. Cards full width. | Labelled menu drawer; 5-item bottom bar. "Menu" word hidden below 370 px, icon keeps a 44 px target. | Exam rows are logo → title → arrow at 84 px height; the exam badge is hidden because it repeats the title. Filter pills wrap. |
| **360** | Same as 320; KPIs become 2-up only at ≥360 px. | Same. | 2-up KPIs have enough width for a full sentence hint; below 360 a single column is used. |
| **390** | One column. Home hero title ~28 px. | Same. | Profile save bar becomes sticky above the bottom bar (`bottom: 62px + safe-area`); tables stack as records. |
| **430** | One column, more breathing room. | Same. | Mobile menu still used; the desktop row would need ~1000 px of labels. |
| **768** | Two-column card grids where content supports it; page gutters 24 px. | Still the drawer/bottom bar (touch-first tablet). | Dashboard sidebar and content stay one column until there is room for both without squeezing records. |
| **1024** | Header keeps logo + search + account; primary links move to the dashboard sidebar for students / console sidebar for staff. | In-product side navigation. | Admin summary is 2 columns; tables keep their own scroll container and never widen the document. |
| **1280** | Header shows all six links; in-page search. | Full header + sidebar. | Home hero becomes copy + 3-step rail; exam grid is 4-up with neutral cards. |
| **1440** | Same as 1280 with a wider content measure. | Full. | Prose capped at 68ch; dashboards use the full column. |

## Rules applied across widths

1. **No document-level horizontal scrolling.** Tables either restack as records
   (student) or scroll inside their own labelled container (admin). The capture
   gate asserted `scrollWidth <= innerWidth + 1` at every width.
2. **Touch targets are 44 px minimum on coarse pointers.** `a11y.css` enforces
   this for links that look like buttons; the product layer gives quiet text
   actions the same minimum height. A compact text action is allowed to look
   quiet, not to be untappable.
3. **Safe areas.** The mobile drawer, sticky save bar and bottom navigation use
   `env(safe-area-inset-bottom)` so the home indicator does not cover a save
   action.
4. **No hover-only affordances.** Every card action is present as text or an
   icon with an accessible name; hover only adds emphasis.
5. **Fluid type only where reading distance changes.** Page titles use a
   `clamp(24px, 2.4vw, 32px)`; body, labels and table text stay fixed so
   scanning rhythm does not drift.
6. **The shell changes, not just its scale.** At ≤899 px the header drops the
   link row and uses a labelled menu; at ≥1024 px signed-in areas gain their
   side navigation. The same six destinations exist at every width.
7. **Bottom bar is a shortcut, not the map.** It never contains a destination
   that is unavailable in the drawer.

## Measured result

Captured with `@sparticuz/chromium` against the dev server, one page per width,
after fonts and first paint settled:

| Set | Screens × widths | Document overflow | Element overflow | Page errors |
| :--- | :--- | :--- | :--- | :--- |
| Public (home, past questions, CBT, setup, services, news, jobs, schools, login) | 9 × 8 = 72 | 0 | 0 | 0 |
| Authenticated (dashboard, My CBT, requests, tools, profile, settings, results) | 7 × 6 = 42 | 0 | 0 | 0 |
| Admin (overview, users, CBT, queue) | 4 × 2 = 8 | 0 | 0 | 0 |

Before the change, the same public sweep had two localised element leaks at
≤390 px (`a.er-mini-link.er-identity-card` on home) and ≤360 px
(`button.er-pill` on past questions). Both are fixed; the filter row now wraps
at ≤640 px instead of scrolling sideways.

Full-size evidence: [`evidence/after/`](./evidence/after/) and
[`evidence/before/`](./evidence/before/). For example compare
`home-1440.png`, `home-390.png`, `dashboard-1024.png`, `dashboard-390.png`,
`mycbt-390.png`, `profile-390.png` and `admin-390.png`.

## Known limits

- The capture harness measures layout overflow; it does not emulate a physical
  notch or a software keyboard. Safe-area rules are verified by CSS inspection,
  not on a notched device.
- 320 px is supported for reading and navigation; data-dense admin tables use
  their own scroller there by design, with the record summary above it.
- No zoom/reflow test at 400% was run in a screen reader; the a11y gate checks
  the structural rules (see the architecture document's limitations).
