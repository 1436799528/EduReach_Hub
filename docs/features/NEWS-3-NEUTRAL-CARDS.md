# NEWS-3 — one calm news card, and the shared image pipeline

**Status:** implemented on `arena/b1c71591-edureach-hub`. Verified by the static
test suite, contrast maths over the neutral palette and the production build.
**No browser was available in the sandbox**, so a device pass is still worth
doing before release (see §7). Nothing is deployed.

This document supersedes NEWS-1 (`docs/features/NEWS-1-GRADIENT-CARDS.md`, now
removed). NEWS-1 is kept only as history: the coloured card it introduced is the
thing this change removes.

## 1. What was wrong

The news board had been fixed twice, each time by adding decoration rather than
removing noise:

1. **UI-7** made the card a white 1:1 square. A `13.5px` headline clamped to
   three lines under a half-card image read as a grid of shrunken placeholders.
2. **NEWS-1** answered that with **eight category gradients**. The card was
   legible again, but the board became a rainbow: eight hues on one screen, none
   of which carries information a reader can act on. Two stories about the same
   exam shared a colour; a story about a different one did not. Colour was
   decoration pretending to be taxonomy.
3. **The image was last in line.** Every surface built its own `<img>` with its
   own `safeImageSrc`, its own `onError` DOM surgery and its own placeholder
   class. Some declared no dimensions (layout shift), some loaded eagerly below
   the fold, none offered a smaller file to a phone, and one preview embedded
   whatever URL an editor typed.

## 2. The card

One surface for every story: white, a thin neutral border, dark type, the
article's own photograph. **No category colours, no gradients, no rainbow grid.**
Hierarchy does the work instead:

| step | element | type |
| --- | --- | --- |
| 1 | image, `16:10` (`16:9` on a phone) | — |
| 2 | category · date | 11px, muted |
| 3 | headline | 15.5px / 620, clamped to 3 lines |
| 4 | summary | 12.5px, secondary |
| 5 | source + *Read →* | 11.5px, muted / primary |

- **Colour carries nothing, so it is gone.** `src/lib/newsTone.ts`,
  `NEWS_TONES`, `newsToneFor()` and the `.er-news-tone-*` rules are deleted, not
  merely unused; `tests/news-cards.test.ts` fails if the module or a tone class
  comes back. The trending list no longer borrows `er-identity-card` tints
  either.
- **The photograph is the only colour on the card.** The image frame keeps a
  stable aspect ratio so the feed cannot jump as files arrive.
- **One click target.** The anchor wraps the whole card; the foot carries the
  action and the card shows a `3px` focus outline. A card is a link, never a
  button.
- **Nothing about honesty changed.** The freshness warning keeps its wording and
  is now a readable line rather than a white-on-gradient sticker; an expired
  story is still removed from the board before it renders.

The mobile behaviour from NEWS-1 is kept: at `≤640px` both feeds become a
horizontal scroller, one card per screen, `scroll-snap-type: x mandatory`.
Cards stay real links in DOM order, so keyboard and screen-reader users tab
through them and the browser scrolls each into view.

## 3. The image pipeline (`src/lib/imagePipeline.ts`)

One module answers every image question, and one component renders every image.

| question | answer |
| --- | --- |
| Which URLs are allowed? | `safeImageUrl`: same-origin paths and `https:` only. `http:`, `data:`, `javascript:`, credentials, protocol-relative and whitespace-bearing URLs return `null`. |
| Which get transformed? | `isLocalImagePath` — only our own files. A remote image is linked, never copied through our CDN. |
| When is a CDN available? | `imageCdnEnabled`: production build, non-local host, not `.local`, not the `.e2b.app` preview, and `VITE_IMAGE_CDN=off` wins. Otherwise the original URL is used unchanged. |
| What sizes? | `widthsFor(slot)` → half, 1×, 2× of the layout slot, clamped to 160–1600px. A 300px card asks for 300 and 600, never 1280. |
| What formats? | AVIF then WebP `<source>`s with the original as the `<img>` fallback; `sizes` comes from `sizesFor('card'|'row'|'hero'|'article')`. |
| What caching? | `imageCacheControl`: `immutable` only for `/.netlify/images` or a content-hashed `/assets/…`; unhashed files get an hour plus a day of `stale-while-revalidate`; remote images get `no-store` (their owner sets the policy). |
| What if there is no image? | `NEUTRAL_IMAGE_PLACEHOLDER` — `public/images/neutral-placeholder.svg`, a drawing of a picture frame, never a stock photograph of another campus. |

`src/components/OptimizedImage.tsx` renders `<picture>` with `decoding="async"`,
`loading="lazy"` unless `priority`, `fetchPriority` accordingly, explicit
`width`/`height` (no layout shift), `referrerPolicy="no-referrer"` for remote
images, an optional `attribution` line ("Image: …") and an `onError` that swaps
to the neutral placeholder through state instead of DOM surgery.

Surfaces converted: news cards, news rows, featured cards, the article hero
(`priority`), and the institution review editor's logo/hero preview (which now
cannot embed an unvalidated URL). `public/_headers` adds a day of caching plus a
week of `stale-while-revalidate` for `/images/*` and `/news/photos/*`.

**The institution public payload still carries no `logo_url` / `hero_image_url`**
— the admin view has them, the public profile does not. Filling that space is an
API change (a new field on the public payload and a publication rule for it),
not a component change, and it is not part of this stage.

## 4. Deviation recorded

`docs/architecture/UX-5-PRODUCT-DESIGN-AND-RESPONSIVE-SYSTEM.md` §4 says "no
gradients, coloured cards or new elevation". NEWS-1 recorded an exception for the
news card; NEWS-3 **removes that exception** — the card is the plain surface the
rule asks for, and the architecture doc is back to having no exception.

## 5. Verification

- `tests/news-cards.test.ts` (10 tests): neutral surface, no tone system in code
  or CSS, image frame, type order, click target, phone snap, header rules,
  practice page, news page, article hero.
- `tests/images.test.ts` (9 tests): URL validation, transformation, widths,
  source sets, cache policy, placeholder, component contract, surface wiring.
- `npx tsc --noEmit`, `npm run build`, the full `npm test` suite,
  `npm run perf:audit`.

## 6. Not verified here

- **No rendered pass.** A browser download is blocked in this sandbox, so the
  layout is reasoned from the CSS, not photographed. Check `/news`, the homepage
  feed and one article page at 360–430px and on a wide screen before release.
- **Scroll-snap feel** (how many cards a fast flick passes) is a device
  judgement.
- **The image CDN only exists on a Netlify deploy.** Under `npm run dev` and on
  the preview host the component degrades to the original file, which is correct
  but means transformation itself is unproven until a deploy.
