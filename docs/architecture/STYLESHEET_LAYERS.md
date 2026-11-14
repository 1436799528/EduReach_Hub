# Stylesheet layers and load order

**Finding this answers:** P3-5 — 17 global CSS files (~49 KB gzip)
loaded on every route. The audit's options were "raise the budget deliberately"
(done once: 46 → 50 KB, and again 50 → 51 KB for the UI-4 interaction states) or "consolidate". This
document is the precondition for consolidating safely: it records what each
sheet owns and the order they depend on. Consolidation itself is scheduled work,
not silently dropped — see the plan at the end.

## The order contract

`src/main.tsx` imports the global sheets, in this order, and the order is load-bearing:

| # | Sheet | Owns |
| :-- | :--- | :--- |
| 1 | `hub.css` | Portal base: variables, layout primitives, buttons |
| 2 | `card-system.css` | Card surfaces and their states |
| 3 | `cbt-engine.css` | CBT session, timer, question sheet |
| 4 | `compact-portal.css` | Compact density pass over 1–2 |
| 5 | `image-card-system.css` | Image-card variants |
| 6 | `home-card-first.css` | Home page card-first layout |
| 7 | `myschool-clean.css` | School finder/detail |
| 8 | `styles/theme.css` | Token layer (colour, spacing) consumed by 9–11 |
| 9 | `compact-design-system.css` | Compact design system |
| 10 | `compact-structural.css` | Compact structural pass |
| 11 | `edu-portal.css` | Feature surfaces layered over the design system |
| 12 | `data-control.css` | Data-control centre |
| 13 | `components/CookieConsent.css` | Scoped privacy-choice panel, before the shared closing layers |
| 14 | `styles/type-system.css` | Shared type scale (must follow the component sheets it standardises) |
| 15 | `styles/brand-actions.css` | Brand action colours: the last word on primary buttons and selected states (UI-3) |
| 16 | `styles/ux5-product.css` | **UX-5 product system:** spacing/type roles, navigation states, home hierarchy, dashboard/profile rhythm and control sizes. Loads after component sheets and brand actions so it can settle hierarchy; it never uses `!important` except where a code-split dashboard sheet loads later (documented inline) |
| 17 | `styles/a11y.css` | **Always last.** Owns the focus-ring cascade the a11y gate checks |

## Lazy route sheet

`pages/AdminLayout.tsx` imports `admin.css` with the lazy admin route instead
of loading it for every student page. The admin stylesheet is therefore not
part of the global order above; it arrives with the admin route's JS chunk.
This keeps admin styling out of the public first-load CSS while preserving the
shared global type, token and accessibility layers.

Two rules follow from that:

1. **`styles/a11y.css` is the final import.** Later declarations win in CSS; a
   sheet imported after it can silently override the focus ring, and
   `npm run a11y:audit` would have nothing to check. `styles/ux5-product.css`
   and `styles/brand-actions.css` are imported immediately before it: they have
   to follow every component sheet to settle hierarchy, action colours and
   navigation states.
2. **`styles/type-system.css` follows every component sheet.** It standardises
   type that the component sheets set; importing it earlier lets them win.

`tests/stylesheet-layers.test.ts` pins the exact global list, the lazy admin
sheet, and both ordering rules, so adding or moving a sheet requires editing
this table and that test deliberately — the crowd of sheets cannot grow by accident.
The 2026-11-02 admin refresh removes only `.admin-kpi` from the shared public
image-card treatment in layer 8; public card selectors remain unchanged, while
admin metrics are owned by `admin.css`.

## Consolidation plan (the actual P3-5 work)

UX-1 removed two sheets that had no live selectors at all — `hub-portal-tuning.css`
and `dashboard-v2.css` — taking the global set from 18 to 16 and freeing more
than 8 KB gzip for the redesigned dashboard. Their two live status-badge rules
moved to `type-system.css`.

UX-5 added one deliberate layer, `styles/ux5-product.css`, taking the set to 17.
It is not another pass over old rules: it introduces the spacing scale, page and
section hierarchy, navigation states, responsive exam list and control heights
that the product brief asked for. The dashboard's code-split sheet still loads
later, so the handful of rules that must beat it carry one extra class or a
scoped `!important`, and each such rule says why in a comment.

The remaining sprawl is historical: each visual pass added a sheet rather than
editing the previous one. The merge is deliberately staged, because there is no visual
regression suite for the portal and a blind concatenation would be a silent
redesign:

1. **Batch A — pure corrections, merge into their base.** `compact-portal` (→ `compact-design-system`), `home-card-first`
   (→ `card-system`), `mysite-clean` (→ `edu-portal`). Same specificity,
   later-wins relationships preserved by ordering inside the file.
2. **Batch B — the compact trio.** `compact-design-system.css`,
   `compact-structural.css` and `compact-portal.css` are one design system split
   by pass; merge into one sheet and review the cascade by eye on the pages the
   compact pass touches.
3. **Batch C — the token layer.** Fold `styles/theme.css` into `hub.css` once
   batches A and B have landed, so tokens and consumers are in one file.
4. **Target: 17 sheets → 8.** Then lower `cssGzip` back toward 42 KB.

Each batch is a separate reviewed change with `npm run perf:audit` and the
`a11y:audit` in the gate. None of it is a prerequisite for the current release.
