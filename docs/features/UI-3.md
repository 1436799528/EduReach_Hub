# UI-3 · Global colour system: deep green actions, crimson brand accent

**Status:** delivered
**Scope:** colour only. No layout, component, copy, navigation, exam-rule or
schema change.
**Touches:** `src/styles/theme.css`, `src/styles/brand-actions.css` (new),
`src/main.tsx`, `src/edu-portal.css`, `src/home-card-first.css`, six TSX files
with inline action colours, four documents, four tests.

## 1. The problem this fixed

The product had two competing answers to "what colour is an action": blue
(`--hub-blue: #2563eb`) and crimson (`--er-crimson: #b14933`). `theme.css`
aliased `--hub-blue` to crimson, so a token called *blue* painted *crimson*, and
five different sheets set `.hub-primary-btn` independently:

| Sheet | `.hub-primary-btn` fill | importance |
|---|---|---|
| `hub.css` | `var(--hub-blue)` | — |
| `theme.css` | `var(--er-crimson)` | `!important` |
| `myschool-clean.css` | `#b14933` | `!important` |
| `compact-portal.css` | `var(--hub-blue)` | — |
| `edu-portal.css` (hover) | `#B3331A` | — |

Which one a student saw depended on import order and `!important`, not on a
decision. On top of that, eleven JSX sites hard-coded `background: '#b14933'`
inline, which beats every stylesheet.

## 2. Tokens (one definition)

`src/styles/theme.css`:

| Token | Value | Use |
|---|---|---|
| `--er-primary` | `#174A3A` | every primary action |
| `--er-primary-hover` | `#123A2D` | hover |
| `--er-primary-active` | `#0E3025` | pressed |
| `--er-primary-border` | `#0B3126` | outline around the hero pair |
| `--er-primary-soft` | `#E8F1EC` | selected-state surfaces |
| `--er-on-primary` | `#FFFFFF` | text on the fill |
| `--er-crimson` | `#B14933` | brand accent (unchanged) |
| `--er-crimson-deep` | `#B3331A` | brand accent, deep |

Contrast, measured from the literals: white on `#174A3A` **10.11:1**, hover
**12.58:1**, pressed **14.30:1**; `#174A3A` as text on white **10.11:1** and on
the page background **9.59:1**. Crimson stays at **5.43:1** where it is used.

## 3. One owner for action colour — `src/styles/brand-actions.css`

A new final layer, imported after every component sheet and immediately before
`a11y.css`, so it settles the cascade instead of adding to it. It carries
**44 selectors**, and each one is a button, a selected state, a progress
indicator, a primary link or a form affordance. It sets no card surface,
border, radius, shadow or size.

| Surface | What turns green |
|---|---|
| Home | `Start practising` / `Past questions` (`.hub-home-cta`), the study-tool icons, "View all" |
| Simulator setup | the Start button, chosen question count, chosen mode, subject checkboxes |
| CBT exam | Submit, the selected answer and its letter, the subject tab, the current palette cell, tool hover, the route progress bar |
| Past questions | filter pills, library tabs, the primary button on each card CTA |
| Student dashboard | `dash-btn-primary`, the wallet amount presets, the target progress bar, card links |
| Admin | `.admin-btn` primary (secondary / success / danger untouched) |
| Forms | input/select/textarea focus tint, search submits, notice "Try again" |
| Mobile | the mobile search submit, and every control above at its existing size |

The hero pair had already been switched from crimson to a literal `#174a3a` in
`9f0517a`, which left `tests/site-experience.test.ts` asserting the old hover
and pressed values and broke the gate. This branch keeps the colour and replaces
the three literals with the tokens, so the test and every other button read the
same definition. The hover and pressed shades are the token ramp
(`#0F3A2D` / `#0A2C22`) rather than `#123a2d` / `#0e3025`. UI-4 later adopted the
lighter `#123A2D` / `#0E3025` steps as the specified palette; see `UI-4.md`.

`.er-exam` already owned an accent variable (`--er-exam-accent`). It now points
at `var(--er-primary)`, which repaints the exam submit, side submit, mobile bar,
calculator equals key and palette outline in one declaration.

## 4. Crimson, restrained

Crimson remains in exactly these contexts:

- **Brand marks** — the wordmark suffix, the app badge, `admin-brand-mark`, the
  logo fallback, the wallet/avatar marks.
- **Navigation accents** — the Clickmor elements in the header and the
  admin sidebar (the selected route itself became a green surface in UI-4).
- **Kickers and eyebrows** — the small uppercase label above page titles, which
  is the brand signature across pages.
- **Exam identity colours** that carry meaning (simulator tiles, service card
  banners) — untouched, per instruction.

It no longer fills any primary button, submit, CTA, selected filter or progress
bar. The inline `#b14933` fills in six TSX files now reference
`var(--er-primary)`.

## 5. What was deliberately not changed

- **Cards.** No card background, border, radius, shadow, spacing or dimension
  moved. `tests/brand-colors.test.ts` fails if the action layer names a card as
  its subject, and spot-checks `.hub-service-banner` and `.hub-service-profile-card`.
- **Exam identity colours.** `--er-exam-accent` is the *action* accent inside the
  exam; the per-exam brand tiles and badges keep their own colours.
- **Typography, layout, navigation, content, functionality.** Untouched.
- **Focus ring.** Kept `#8f1d18` + white under-ring at the time (8.91:1 on
  white). UI-4 moved it to the primary token, `#174A3A`, at 10.11:1; the
  two-tone system is unchanged.
- **`--hub-blue`.** Still aliased to crimson in `theme.css` because cards read
  it. Renaming it is a cascade change with no visual benefit; recorded as a
  consolidation follow-up.

## 6. Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **565/565** (6 new colour rules) |
| `npm run build` | clean |
| `npm run perf:audit` | 10/10 — entry 96.2/100 KB, **CSS 49.4/50 KB**, critical path 206.0/210 KB, all chunks 319.2/330 KB |
| `scripts/a11y-audit.ts` | 0 blocking, 4 informational |
| `npm run analytics:audit`, `npm run schema:audit` | no blocking findings |

Cascade verification: a resolver was run over the real `main.tsx` import order
to compute the **winning** declaration for 19 key selectors. All resolve to
`--er-primary` / `--er-primary-hover` / `--er-primary-soft`; nothing later
re-introduces crimson.

Tests added (`tests/brand-colors.test.ts`):

1. the tokens exist with the exact values and the hover/press ramp darkens;
2. every state clears 4.5:1;
3. the recolour surface is exactly the curated selector list;
4. the layer never targets a card, tile, banner or exam identity;
5. no primary action is filled with crimson in the action sheets;
6. no inline style hard-codes a primary fill.

## 7. Remaining inconsistencies (documented, not hidden)

1. **CSS budget headroom is 0.6 KB** (49.4 of 50). The palette layer costs about
   1.1 KB gzip. The next visual change should come with the P3-5 consolidation
   (`docs/architecture/STYLESHEET_LAYERS.md`), not with another override sheet.
2. **`--hub-blue` still means crimson.** Several card surfaces read it
   (`.hub-service-banner`, the compact card icon, the news thumb). Repointing it
   would recolour cards, which this change forbids.
3. **Blue survives in a few non-card brand marks** (`student-brand`,
   `auth-page-brand`, `wallet-modal-brand`, `.er-banner-card`, one
   `.ms-service-card` variant). They are identity surfaces, not actions.
4. **Crimson eyebrows and page icons** (Jobs, News, Past questions, CGPA,
   Events) are kept as the brand kicker. If they should go green too, that is a
   brand decision for a later pass, not a mechanical swap.
5. **Inline styles remain** in `AuthPageV2`, `ComingSoonPage`, `HubLayout` and
   `ServiceApplyPage` — now tokenised, but still inline. Moving them into the
   sheets is part of the stylesheet consolidation.
6. **No local browser.** Desktop and mobile confirmation is from the resolved
   cascade, the contrast maths and the static audits; the Playwright desktop +
   Pixel 7 job in CI is the rendered check.
