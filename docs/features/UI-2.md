# UI-2 · Consistent home actions and a truthful loading state

**Status:** delivered
**Surfaces:** `/`, `/cbt/setup/*`, `/cbt/session/*`, `/admin/question-imports`
**Touches:** `pages/HubHomePage.tsx`, `src/home-card-first.css`,
`src/components/WaveLoader.tsx`, `src/lib/usePendingPhase.ts`,
`src/components/AsyncState.tsx`, `src/components/ExamSimulatorGrid.tsx`,
`pages/ExamSetupPage.tsx`, `pages/CbtSessionPage.tsx`,
`pages/AdminQuestionImportPage.tsx`, `src/styles/type-system.css`

## 1. The two home actions are one control

Before this pass the hero offered a solid blue **Start practising** and a white
**Past questions**. They differed in fill, text colour, border, height and hover
state, which read as one button and one afterthought. Both now carry the same
class, `.hub-home-cta`, and every visual property is declared once:

| Property | Value |
|---|---|
| Background | `var(--er-crimson)` — `#b14933` |
| Text | `#ffffff`, 560 weight, 14px / 1 |
| Border | `1px solid #8f3727` |
| Height | `44px` (`min-height: 44px`) |
| Radius | `9px` |
| Padding | `0 18px` |
| Hover | fill `#9c3c28`, border `#7f2e20`, 1px lift, arrow nudges 2px |
| Press | fill `#8a3322`, inset shadow, no lift |
| Focus | the global two-tone ring from `src/styles/a11y.css` — never redefined here |
| Motion | 160 ms ease; all of it removed under `prefers-reduced-motion` |

Contrast is measured from the literals in the stylesheet, not eyeballed:
`#b14933` on white is **5.43:1**, hover **6.79:1**, pressed **8.15:1** — all
above the 4.5:1 AA floor for 14px text.

**Why crimson.** `docs/COLOR_THEME_SPEC.md` assigns crimson to "important action
and brand emphasis", and `--er-crimson` is the accessible variant already used
throughout the product. The legacy runtime token `--hub-blue: #2563eb` still
drives ordinary buttons, so the hero is now the only place that uses the brand
fill. That is a deliberate hierarchy, not an oversight — see §7.

**Mobile.** Below 600px both actions take a full row (`flex: 1 1 100%`) and stay
44px tall, so neither label is squeezed at 360px. Both use the same rule, so the
pair cannot drift apart at a breakpoint.

## 2. The wave loader

`src/components/WaveLoader.tsx` is one inline SVG plus CSS. A dual-arc ring —
two dash patterns on the same circle, turning at different speeds — around four
staggered bars. No canvas, no dependency, about 1 KB of markup.

| Variant | Use |
|---|---|
| `ring` (default) | a standalone wait: paper loading, bank loading, extraction |
| `inline` | inside a button or a table row, where the text already says what is happening |
| `decorative` | hides it from assistive technology when a visible label is already announced |

Colour is `currentColor`, so the same component is legible on a white card, in
the crimson call to action and on the dark admin sidebar without a surface
variant. The accessible form is a single `role="status"` live region; the
decorative form emits no announcement, so a button that says "Starting…" does
not say it twice.

Reduced motion stops both loops
(`.er-wave-arc, .er-wave-bars i { animation: none }`) and leaves the bars in a
readable resting state, so the control still communicates "busy" without moving.

## 3. Slow and failed requests

`src/lib/usePendingPhase.ts` turns a real pending flag into a phase:

| Phase | When | What the student sees |
|---|---|---|
| `pending` | the request has just started | the existing skeleton or the button's own state |
| `slow` | still pending after **1.2 s** | a named loader ("Loading subjects…", "Connecting…") |
| `stalled` | still pending after **20 s** | a plain statement of the wait plus a way out |
| `idle` | settled, failed or cancelled | nothing; the error state takes over |

This does **not** estimate speed. There is no throughput calculation, no
simulated progress and no artificial delay: the timers only start because a
request is already in flight, are cleared the moment it settles, and reset
before paint when a new request begins, so a fresh request never inherits the
previous one's stall.

| Surface | Pending | Slow (≥1.2 s) | Stalled (≥20 s) | Failed |
|---|---|---|---|---|
| Home exam grid | skeleton tiles hold the layout | "Connecting to the question banks…" with the wave | "Still waiting…" + **Try again** | `ErrorState` with **Try again** |
| Setup: catalogue/bank | reserved region with "Loading question banks…" / "Loading subjects…" | same, with the wave | "The question bank has not answered yet" + **Try again** | `ErrorState` + retry |
| Setup: start session | button shows the wave and "Starting…" | — | note explaining the wait and a link back to the CBT Centre | form error, button re-enabled |
| Exam: paper load | ring loader, "Preparing your paper…" | same | **Try again** inside the loading screen | `ErrorState` + retry |
| Exam: answer save | inline wave + "saving…" | same | falls back to the existing "saved on this device" state | "not saved", retried on reconnect |
| Admin: upload | inline wave + "Uploading…" and the `<progress>` bar | same | — | row-level error message |
| Admin: extraction | "Waiting to start reading…" / "Reading the file and finding questions…" | same | "This is taking longer than usual" + **Retry extraction** | status badge + retry |

Content already on screen is never replaced to show a spinner: the home grid
keeps its skeleton, the setup page keeps its header and guidance, and the exam
paper keeps the question the student is answering. Answer selection is never
gated on a save — the save runs beside it, as before.

Every pending surface has a terminating state, so no screen can spin forever:
each request either resolves, rejects into a classified error with a retry, or
reaches `stalled` where the screen says so and offers the next step.

## 4. Accessibility and performance

- The loader is either a labelled live region or `aria-hidden`; nothing is
  announced twice.
- No focus order changed, and the home actions keep the shared focus ring.
- No new runtime dependency; `package.json` is unchanged.
- One new poll-free component; the hook re-renders at most twice per request.

| Check | Before (`b8d635f`) | After | Budget |
|---|---|---|---|
| Entry chunk (gzip) | 95.6 KB | 96.2 KB | ≤ 100 KB |
| CSS (gzip) | 48.2 KB | 48.8 KB | ≤ 50 KB |
| Critical path (gzip) | 204.2 KB | 205.4 KB | ≤ 210 KB |
| All chunks (gzip) | 318.5 KB | 319.2 KB | ≤ 330 KB |
| Chunks | 69 | 68 | — |

## 5. Product requirement status

Checked against the repository, not against earlier plans. "Built" means the
code exists and is exercised by a test or an audit here.

| Requirement | Status | Evidence | What is missing |
|---|---|---|---|
| PWA installation | 🟡 partial | `public/manifest.json` (standalone, shortcuts, theme colour), `src/components/PwaRegister.tsx` registers `/sw.js` on HTTPS, `index.html` links the manifest | One **SVG** icon only. Chromium's install criteria expect 192px and 512px raster icons; installability has not been verified on a device. No install prompt or "add to home screen" guidance |
| Offline behaviour | 🟡 partial | `public/sw.js` caches `/icons/`, `/logo/`, `/news/photos/`, the manifest and the favicon. API calls and any authorised request bypass the worker, so no private exam data is cached | Navigations are network-only; offline shows a plain 503 "EduReach is offline" text, not an app shell. No offline reading of saved pages, no offline practice. `/assets/*` is deliberately not cached (content-hashed, immutable) |
| Windows application readiness | 🔴 not built | No Electron, Tauri or desktop packaging exists in the repo | The architecture is separable (pages → components → `src/lib`, Express server, no browser-only data access), and the PWA is the only install path today. A packaged Windows build needs a desktop shell, a local server and an icon/signing pipeline |
| User-owned editing and deletion | ✅ delete · 🟡 edit | `student_saved_items` has select/insert/update/delete policies all scoped to `auth.uid()` (`20260920_student_portal_data_backbone.sql`); the dashboard's Remove control calls a delete by id and the policy, not the hidden button, enforces ownership. `edureach_material_notes` has owner policies including delete | The update policy exists but the dashboard exposes remove only — there is no rename/edit surface for a saved item. Draft answers in a live paper are saved per attempt and expire with it |
| Daily Challenge | 🔴 not built | `daily_quizzes` and `daily_quiz_questions` exist (`20261003170000`), with RLS on and no client grants | No route, no API, no page, no authoring flow, and no reviewed questions assigned to a quiz. Building a UI over empty tables would be a fake feature |
| Topic-based practice | 🔴 not built | `exam_questions.syllabus_topic` exists and the admin CBS editor can set it; the import pipeline carries `topic` | No student filter by topic, no topic-level progress, and the topic values in the imported bank are not yet consistent enough to group by |
| Concise, natural copy | 🟡 in progress | UI-1 cut the home and setup copy; setup now carries one honesty sentence instead of review counts | 15 blocks of 160+ characters remain in `pages/*.tsx`; most are admin guidance, the longest public one is the `PastQuestionsPage` empty state (211 characters) |

## 6. Verification

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **559/559** (`tests/loader.test.ts` adds 5: loader markup, live-region behaviour, phase timings, wiring of the four waits, and the wait-vs-failure surfaces; `tests/site-experience.test.ts` adds the action-parity and contrast rules) |
| `npm run build` | clean |
| `npm run perf:audit` | 10/10 |
| `scripts/a11y-audit.ts` | 0 blocking, 4 informational |
| `npm run analytics:audit`, `npm run schema:audit` | no blocking findings |

**Browser limitation.** This sandbox has no Chromium, so the desktop and Pixel 7
renders are asserted from the shared class, the single rule block and the
contrast calculation, not from a screenshot. The Playwright desktop + mobile
run in CI is the pixel check; both CTAs cannot diverge there because they use
one class and one rule.

## 7. Follow-ups this pass deliberately did not take

1. **One palette for actions.** Ordinary buttons still use `--hub-blue`
   (`#2563eb`) while the hero and the design spec use crimson.
   `docs/COLOR_THEME_SPEC.md` names `#C85841` as the primary, but that colour
   measures **4.26:1** on white — below AA for 14px text — which is why the
   shipped token is `#b14933` (5.43:1). The spec and the token should be
   reconciled before a site-wide repaint; doing it inside this change would
   have been a redesign.
2. **PWA icon set and an offline shell** (§5).
3. **Daily Challenge** needs an authoring and grading design before a UI.
4. **Topic practice** needs a controlled topic vocabulary first.
