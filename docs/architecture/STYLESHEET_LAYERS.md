# Stylesheet layers and load order

**Finding this answers:** P3-5 — 17 CSS files (~46 KB gzip, bundled to 47 KB)
loaded on every route. The audit's options were "raise the budget deliberately"
(done: `scripts/perf-audit.ts` `cssGzip` 46 → 50 KB) or "consolidate". This
document is the precondition for consolidating safely: it records what each
sheet owns and the order they depend on. Consolidation itself is scheduled work,
not silently dropped — see the plan at the end.

## The order contract

`src/main.tsx` imports every sheet, in this order, and the order is load-bearing:

| # | Sheet | Owns |
| :-- | :--- | :--- |
| 1 | `hub.css` | Portal base: variables, layout primitives, buttons |
| 2 | `card-system.css` | Card surfaces and their states |
| 3 | `hub-portal-tuning.css` | Corrections to 1–2 for the portal shell |
| 4 | `dashboard-v2.css` | Student dashboard surfaces |
| 5 | `admin.css` | Admin console |
| 6 | `cbt-engine.css` | CBT session, timer, question sheet |
| 7 | `compact-portal.css` | Compact density pass over 1–4 |
| 8 | `image-card-system.css` | Image-card variants |
| 9 | `home-card-first.css` | Home page card-first layout |
| 10 | `myschool-clean.css` | School finder/detail |
| 11 | `styles/theme.css` | Token layer (colour, spacing) consumed by 12–14 |
| 12 | `compact-design-system.css` | Compact design system |
| 13 | `compact-structural.css` | Compact structural pass |
| 14 | `edu-portal.css` | Feature surfaces layered over the design system |
| 15 | `data-control.css` | Data-control centre |
| 16 | `styles/type-system.css` | Shared type scale (must follow the component sheets it standardises) |
| 17 | `styles/a11y.css` | **Always last.** Owns the focus-ring cascade the a11y gate checks |

Two rules follow from that:

1. **`styles/a11y.css` is the final import.** Later declarations win in CSS; a
   sheet imported after it can silently override the focus ring, and
   `npm run a11y:audit` would have nothing to check.
2. **`styles/type-system.css` follows every component sheet.** It standardises
   type that the component sheets set; importing it earlier lets them win.

`tests/stylesheet-layers.test.ts` pins the exact list and both rules, so adding a
sheet requires editing this table and that test deliberately — the crowd of
sheets cannot grow by accident.

## Consolidation plan (the actual P3-5 work)

The sprawl is historical: each visual pass added a sheet rather than editing the
previous one. The merge is deliberately staged, because there is no visual
regression suite for the portal and a blind concatenation would be a silent
redesign:

1. **Batch A — pure corrections, merge into their base.** `hub-portal-tuning`
   (→ `hub.css`), `compact-portal` (→ `compact-design-system`), `home-card-first`
   (→ `card-system`), `mysite-clean` (→ `edu-portal`). Same specificity,
   later-wins relationships preserved by ordering inside the file.
2. **Batch B — the compact trio.** `compact-design-system.css`,
   `compact-structural.css` and `compact-portal.css` are one design system split
   by pass; merge into one sheet and review the cascade by eye on the pages the
   compact pass touches.
3. **Batch C — the token layer.** Fold `styles/theme.css` into `hub.css` once
   batches A and B have landed, so tokens and consumers are in one file.
4. **Target: 17 sheets → 8.** Then lower `cssGzip` back toward 46 KB.

Each batch is a separate reviewed change with `npm run perf:audit` and the
`a11y:audit` in the gate. None of it is a prerequisite for the current release.
