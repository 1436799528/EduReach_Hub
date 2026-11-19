# Simulator card standard

The homepage, public Practice page and dashboard CBT tab all mount
`src/components/SimulatorCard.tsx` through `ExamSimulatorGrid`. The component
was already shared; the rendered cards were not standard because later CSS
layers inherited an obsolete `aspect-ratio: 1 / 1` from the old two-up phone
layout. At 390px that produced four 358px squares instead of four compact rows,
and on desktop it stretched the 148px card into a square.

## The contract

`src/styles/ux5-product.css` now owns the final geometry and interaction:

| State | Desktop (≥641px) | Phone (≤640px) |
|---|---|---|
| Grid | 4 / 3 columns from `edu-portal.css` | 1 column on Practice/dashboard; 2 columns on the homepage |
| Card | fixed `219px` row (`min-height: 148px`), `aspect-ratio: auto` | fixed `84px` row on Practice/dashboard; homepage uses `1 / 1` service-style cards |
| Content | logo + badge, title, description, bottom meta/arrow | 32px logo, title, one arrow on Practice/dashboard; homepage restores the short description and action line |
| Skeleton | 219px tile, matching the finished card row | 84px row on Practice/dashboard; the homepage has no skeleton because four built-in cards render immediately |

The homepage is an intentional, narrowly scoped mobile exception requested after
this standard: it borrows the Services page's two-up square card anatomy at
`≤640px` only. It does not change Practice, the dashboard, desktop geometry,
hover motion or the shared `SimulatorCard` component.

The surface keeps its hairline border, faint exam tint, 16px padding, 12px
radius, readable title hierarchy and layered contact/ambient shadows. Those
values follow EduReach's compact four-up card system; the premium-card
reference's 40px padding, 24px radius and 38px title would turn a catalogue
tile into a hero panel and break the documented 3–4 cards per row.

## Hover anatomy

- Pointer devices lift the card `8px` over `200ms ease-out` with a deeper pair of
  shadows. The transform does not affect layout, and the footer stays anchored.
- `:focus-visible` receives the same affordance for keyboard users.
- The accent rail and border claim the cursor; no gradient fill is introduced.
- The official emblem scales to `1.05` inside a fixed, `overflow-hidden` frame.
  The card itself is never scaled, so neighbours keep their positions.
- The metadata and arrow reveal `60ms` apart. Touch screens keep a fully visible
  arrow instead of a sticky hover reveal.
- Unavailable banks and `prefers-reduced-motion: reduce` cancel the motion.

The settings-system pattern is a separate admin concern and was not part of
this card change; the admin site page already has grouped explicit saves,
`Modified` indicators and per-group reset.

## Related content cards

The `84px` phone height is the reference for a compact card that does one job.
News, featured stories, scholarships and jobs carry more facts, so they use the
shared `.er-standard-card-grid` horizontal row (thumbnail + copy + arrow) with
a `104px` minimum. They stay compact by wrapping small facts and clamping long
prose, never by hiding facts with `display:none`. See
`docs/features/MOBILE-FIRST-SITE-STANDARD.md`.
