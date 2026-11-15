# UX-8 evidence

All screenshots are viewport captures at 1× device scale. Measurements are CSS
pixels from `getBoundingClientRect()` and `document.documentElement.scrollWidth`,
collected in `evidence/before/measurements.json` and
`evidence/after/measurements.json`.

## Desktop 1440

| Surface | Before | After |
| :--- | :--- | :--- |
| Home container | x=130, w=1180 | x=130, w=1180 |
| Home primary action | x=130, w=440, h=88 | x=130, w=440, h=88 |
| Home search | x=930, w=380, h=52 | x=930, w=380, h=50 |
| Header search | x=961, w=220, h=40 | x=941, w=250, h=50 |
| About/legal column | x=130, w=1180, text pinned left | x=310, w=820, centred |
| Search page column | x=130, w=940 (inline cap) | x=310, w=820, centred |
| Footer | h=57 | h=57 |

Screenshots: `home-1440.png`, `search-1440.png`, `about-1440.png`,
`login-1440.png`, `primary-action-1440.png`.

## Mobile 390

| Surface | Before | After |
| :--- | :--- | :--- |
| Container | x=6, w=378 | x=16, w=358 |
| Home search | x=16, w=358, h=52 | x=16, w=358, h=50 |
| Home primary action | x=16, w=358, h=76 | x=16, w=358, h=76 |
| About/legal column | x=6, w=378 | x=16, w=358 |
| Footer | h=143 | h=143 |

Screenshots: `home-390.png`, `search-390.png`, `about-390.png`,
`login-390.png`, `footer-390.png`.

## Matrix (after)

Every row has `scrollWidth === innerWidth`.

| Width | Container | Reading column | Search page control | Footer |
| ---: | :--- | :--- | :--- | ---: |
| 320 | x=16, w=288 | x=16, w=288 | x=16, w=288, h=50 | 189 |
| 360 | x=16, w=328 | x=16, w=328 | x=16, w=328, h=50 | 189 |
| 390 | x=16, w=358 | x=16, w=358 | x=16, w=358, h=50 | 143 |
| 430 | x=16, w=398 | x=16, w=398 | x=16, w=398, h=50 | 143 |
| 768 | x=20, w=728 | x=20, w=728 | x=20, w=728, h=50 | 95 |
| 1024 | x=20, w=984 | x=102, w=820 | x=102, w=820, h=50 | 95 |
| 1280 | x=50, w=1180 | x=230, w=820 | x=230, w=820, h=50 | 57 |
| 1440 | x=130, w=1180 | x=310, w=820 | x=310, w=820, h=50 | 57 |

The 189 px footer at 320/360 is the policy group wrapping to a third line. It is
not extra padding; the 143 px 390/430 state is the same two-row bar as UX-7.

## What the screenshots show

- One search control: same icon, radius, type, neutral submit, clear button and
  focus ring on home, page, header and drawer.
- One primary action token: the public primary, auth submit, dashboard submit
  and exam submit all render the same blue; the old crimson `:root` override is
  gone.
- Footer pages read as documents inside a centred 820 px column instead of a
  full-width 1180 px column with left-pinned copy.
- Footer navigation is two groups with a divider while both fit; it wraps
  without clipping below 360 px.
- Cards, table layouts, exam tiles and bottom navigation are unchanged.
