# UI-1 · A focused frontend pass

**Status:** delivered
**Surfaces:** `/`, `/cbt`, `/cbt/setup/*`, `/admin/question-imports`, shared shell

## What the audit found

The product already had a design system — tokens in `src/hub.css`, a role-based
type scale in `src/styles/type-system.css`, shared shells and state surfaces —
but three layers were fighting over the same properties:

| Finding | Evidence | Fix |
|---|---|---|
| The home headline rendered at 20px | `src/compact-design-system.css` set `.hub-home-intro h1` to 20px and its paragraph to 12px with `!important`, after the home sheet had asked for a 25–38px clamp | The density layer now keeps a 28–40px display size and a 15px/1.6 paragraph |
| The home feed reserved six rows but showed three | `.er-late-region--feed` had a 542px floor while `HubHomePage` renders `news.slice(0, 3)` | Floor is 266px, exactly three 82px rows and two gutters; the perf test now checks the exact value |
| Phone controls were 32px tall | The compact layer sets every `.hub-*` button to 32px with `!important`; the design system asks for 44px | Coarse pointers get a 44px minimum by media query, desktop density is unchanged |
| Secondary admin buttons were white on white | `.admin-btn.secondary` was written for the dark sidebar (`color:#fff`, transparent, `width:100%`) and the import page used it in a white header and card | Scoped content-area variant with navy text, a visible border and auto width |
| The home page could not resume a paper | Only the dashboard and `/cbt` exposed history | `ContinuePracticeCard` loads lazily for signed-in students and links straight into the attempt |
| Two pieces of copy described the wrong thing | "Download papers" (the library routes to a request channel) and "120 min timed practice" (practice time is derived from the question count) | "Find papers…" and "Timed practice"; the setup screen remains the place where the real duration is shown |
| The CBT catalogue repeated its own label | Eyebrow "QUESTION BANKS" above the h1 "CBT Practice" | One h1, "CBT practice" |

## Component and library decisions

**shadcn/ui — not adopted.** The repository has no Tailwind, Radix or CVA.
shadcn is a generator for Tailwind + Radix components, so adopting it means
adding a second styling system, a second primitive layer and a config rewrite
to replace dialogs, tabs, tables and form controls that already exist
(`AdminKit`, `FilterPills`, `Skeleton`, `AsyncState`). The repository's
`COMPONENT_RULES.md` explicitly asks for reuse before a second component
library. The shadcn patterns that did fit — a small, typed, reusable card with
explicit props and states — were applied to `ContinuePracticeCard`.

**Motion for React — not adopted.** The animation surface is small (hover,
focus, loading, upload progress, a progress bar). The global reduced-motion
rule in `src/styles/a11y.css` already neutralises every animation and
transition. Adding `motion` would put roughly 15–20 KB gzip into a bundle with
4 KB of headroom on the critical path and 12 KB across all chunks, and it would
be used for effects the CSS already handles. CSS transitions are used instead,
with no delay before navigation or exam actions.

**Reference sites (minimal.gallery, designmd.ai, motion-primitives).** Used as
review criteria — restraint, one visual hierarchy, generous spacing — not as
dependencies.

## The resume card

`src/components/ContinuePracticeCard.tsx` is rendered only for signed-in
students and is code-split, so a guest downloads nothing extra. It asks the
history endpoint for the latest attempts and delegates the decision to
`selectResumableAttempt()`, which combines the server's `resumable` flag with
the same expiry rule the dashboard uses (`cbtAttemptState`). An expired
`in_progress` row is never offered. The card shows the exam, the answered count,
a textual and visual progress bar, and the time left when the server states an
expiry. Errors are swallowed: a convenience card must not turn the home page
into an error page.

## Measurements

| Check | Before | After | Budget |
|---|---|---|---|
| Entry chunk (gzip) | 95.5 KB | 95.6 KB | 100 KB |
| Critical path (gzip) | 203.7 KB | 204.1 KB | 210 KB |
| All chunks (gzip) | 317.2 KB | 318.5 KB | 330 KB |
| CSS (gzip) | 47.8 KB | 48.2 KB | 50 KB |
| Chunks | 67 | 69 | — |

The resume card lives in its own lazy chunk (about 1.3 KB), fetched only when a
signed-in student renders it. No dependency was added; `package.json` is
unchanged by this feature.

## Verification

- `npx tsc --noEmit`
- `npm test` — 551/551
- `npm run build`
- `npm run perf:audit` — 10/10
- `npm run schema:audit`, `npm run analytics:audit`, `scripts/a11y-audit.ts`
- `tests/home-resume.test.ts` covers the resume rule; `tests/touch-targets.test.ts`
  pins the coarse-pointer sizing; `tests/perf.test.ts` pins the three-row
  reservation.

## Not done, deliberately

- **Daily Challenge** has tables (`daily_quizzes`, `daily_quiz_questions`) but no
  reviewed content pipeline and no serving RPC. Building a UI over empty or
  fabricated questions would violate the product rules; it needs an authoring
  and grading design first.
- **Topic practice** needs a topic taxonomy that the imported bank does not yet
  populate reliably.
- The remaining crimson/blue accent mix is documented in `COLOR_THEME_SPEC.md`
  as crimson-first, while the action tokens are blue. It is a brand decision,
  not a mechanical cleanup, so this pass did not repaint the product.
- Local visual QA was limited to CSS reasoning and the static gates: this
  sandbox has no Chromium, so the Playwright desktop/mobile run happens in CI.
