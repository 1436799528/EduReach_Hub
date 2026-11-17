# NEWS-1 — the coloured news card, and one card per screen on a phone

**Status:** implemented on `arena/c08d62ba-edureach-hub`; verified by static tests,
CSS contrast maths and the production build. **No browser was available in the
sandbox**, so a device pass is still worth doing before release (see §7).

## 1. What was wrong

Three separate complaints, one surface:

1. **The news card was a white 1:1 square.** `UI-7` replaced the original
   gradient card with `.er-news-card { background: #fff; aspect-ratio: 1 / 1 }`.
   In a square, a `13.5px` headline clamped to three lines sat under an image
   that took half the card, so the board read as a grid of shrunken placeholders
   — worse the narrower the screen got.
2. **Two cards per screen on a phone.** The board kept its
   `repeat(auto-fill, minmax(280px, 1fr))` grid to `640px` and the homepage feed
   kept four-to-two square columns, so a `390px` phone showed half-width squares
   with images shrunk to `90px`.
3. **The header ran out of room.** At `390px` the wordmark is ≈185px at 40px
   tall; with the sign-in pill, the notification bell and a labelled *Menu*
   button the row measured wider than the container, so the brand and the menu
   were clipped at the viewport edges and *Sign In* wrapped onto two lines.

## 2. The card

The news card goes back to the EduReach surface the rest of the product uses: a
**gradient chosen by category, white type, and the article's own image at the
top**. No white card, no square, no shared stock photo.

- **Gradient, not a flat tint.** Eight tone pairs (`indigo`, `blue`, `teal`,
  `cyan`, `violet`, `plum`, `rose`, `amber`) are the original banner palette,
  darkened at the light end so white type clears 4.5:1 on the *lightest* pixel of
  the gradient.
- **Colour follows the category, not the row.** `newsToneFor()` in
  `src/lib/newsTone.ts` maps a category slug to a tone. Filtering or re-sorting
  the board cannot repaint a story, and a category added in the newsroom
  tomorrow still gets a stable tone from a small hash instead of an unstyled card.
- **The image leads.** `.er-news-card-media` is a `16:10` frame (`16:9` on a
  phone) with `object-fit: cover`, so the feed cannot jump as images load. A
  story with no picture renders a labelled panel on the same gradient — never a
  borrowed stock photo.
- **Nothing about honesty changed.** Freshness warnings keep their wording and
  stay legible on the gradient; an expired story is still removed from the board
  before it renders.

Contrast, measured on the light stop of each gradient:

| tone | light stop | white headline | secondary `#e8eefc` |
| --- | --- | --- | --- |
| indigo | `#2459c8` | 6.29:1 | 5.41:1 |
| blue | `#1556c5` | 6.63:1 | 5.70:1 |
| teal | `#08796e` | 5.29:1 | 4.55:1 |
| cyan | `#08706d` | 5.92:1 | 5.09:1 |
| violet | `#4a38c8` | 7.80:1 | 6.71:1 |
| plum | `#6246c5` | 6.56:1 | 5.64:1 |
| rose | `#aa164d` | 7.16:1 | 6.16:1 |
| amber | `#b3400a` | 5.75:1 | 4.94:1 |

`tests/news-cards.test.ts` recomputes those ratios from the stylesheet, so a
future palette edit that breaks contrast fails the build instead of the reader.

## 3. One card per screen on a phone

At `≤640px` both feeds — `/news` *Latest stories* and the homepage *Latest news*
— become a horizontal scroller:

```css
display: flex;
scroll-snap-type: x mandatory;   /* one card at a time */
.er-news-card { flex: 0 0 100%; scroll-snap-align: start; scroll-snap-stop: always; }
```

- The cards are real links in DOM order, so keyboard and screen-reader users
  tab through them and the browser scrolls each into view; the snap is visual
  only and does not trap focus.
- The scroller never adds a second vertical scrollbar (`overflow-y: hidden`) and
  never overflows the page gutter.
- `prefers-reduced-motion` disables the hover lift and the transition.
- The square card system (`ux5-product.css`) is explicitly taken back off news
  cards (`aspect-ratio: auto`, no inner padding) and left in place for
  simulators, services and scholarships, which are still squares.

## 4. The phone header

`HubLayout` now carries `hub-header` / `hub-header-row` hooks. At `≤640px`:

- `padding-top: env(safe-area-inset-top)` keeps the top edge clear in a
  standalone/PWA window;
- the row is `flex-wrap: nowrap` with `8px` gaps and a `56px` minimum height;
- the wordmark is capped at `132px` wide (`30px` tall) rather than shrinking the
  44px touch targets;
- the *Menu* button drops its visible label and keeps `aria-label="Open mobile
  menu"`;
- *Sign In* stops wrapping onto two lines.

## 5. The practice page

The **white simulator tiles are gone from `/cbt`**. They listed the same exams as
the coloured bank cards underneath, cost a second trip through the catalogue and
pushed the actual subject choice off the first screen. The coloured
`er-bank-card` list — which carries the exam's identity colour, its mark and the
exact bank id — is now the only way in, under the heading *Choose a question
bank*.

`ExamSimulatorGrid` itself is untouched and still renders on the **home** page;
this change is scoped to the practice page.

## 6. Deviation recorded

`docs/architecture/UX-5-PRODUCT-DESIGN-AND-RESPONSIVE-SYSTEM.md` §4 says *"no
gradients, coloured cards or new elevation"*. That rule produced the white square
this change removes, so it is now documented as having an explicit exception for
the news card, with this record as the reason. Everything else in the rule —
one type scale, 14–18px icons, functional motion — still holds.

## 7. Verification, and what is still open

Verified here:

- `tests/news-cards.test.ts` (8 tests): gradient surface, contrast of every tone,
  category-driven colour, image frame, phone snap behaviour, header rules,
  practice page has no simulator grid, home still does.
- `npx tsc --noEmit`, `npm run build`, the full `npm test` suite,
  `npm run a11y:audit` (0 blocking), `npm run perf:audit`
  (CSS `45.0 KB ≤ 51`, all chunks `369.5 KB ≤ 372`).

Not verified here:

- **No rendered pass.** Playwright's browser download is blocked in this sandbox,
  so the layout was reasoned from the CSS and the existing 390px screenshots, not
  photographed. Please check `/news` and the homepage feed at 360–430px on a
  device, plus one wide screen, before release.
- **Scroll-snap feel** (how many cards a fast flick passes) is a device judgement.
