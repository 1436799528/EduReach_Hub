# EduReach Hub — Frontend UX Quality Upgrade (Stages B–D)

Branch: `arena/7f1c35f5-edureach-hub` — Stack: React 19 / Vite + Express 4 + Supabase. No new deps, no backend changes, no redesign.

## Source of truth
Stage A audit is complete and summarized in session memory. Tokens/primitives already exist and are reused:
- `src/styles/theme.css` — `--er-primary #174A3A`, `--er-crimson #B14933`, status colours, radii, shadows.
- `src/styles/brand-actions.css` — single owner for `.hub-primary-btn`, `.hub-outline-btn`, ghost, selected states, disabled/busy states.
- `src/styles/a11y.css` (imported last) — skip link, focus ring (green+white), reduced-motion reset, 24px password targets, 44px coarse-pointer targets.
- `src/styles/type-system.css` — `.er-state` surfaces, `.er-inline-notice`, WaveLoader CSS, weight scale.
- `src/components/Skeleton.tsx`, `AsyncState.tsx` (EmptyState/LoadingState/ErrorState/InlineNotice), `WaveLoader.tsx`, `lib/usePendingPhase.ts` (slow 1200ms / stalled 20000ms).
- `src/app/App.tsx` — route progress bar + transition-based navigation.
- `src/styles/theme.css` global form/button/focus rules (imported last in `main.tsx`).

## Brand & standing constraints (preserve)
- Green `#174A3A` primary only; crimson `#B14933` sparingly (brand mark, designated accents). No gradients/glow/glassmorphism/textures/pulsing/over-rounding/AI colour treatments on auth.
- Do NOT redesign cards; fix demonstrable usability/responsiveness problems with documented reason.
- No new UI/animation framework or deps; no broad rewrites; no business-logic/backend/API/DB/auth-provider changes; keep frontend compatible with existing backend.
- No artificial loading delays or fake success. CBT navigation/answer selection immediate; timers/persistence/submission integrity preserved.
- Never delete features, break auth, remove responsive behaviour, change exam rules, use mock data, modify migrations/env vars, reset uncommitted work, modify unrelated files, deploy.
- Do NOT stage/commit/push without explicit authorization.
- Success feedback specific (what happened, item, next action); persistence proportional to stakes; no confetti for ordinary ops; no invented amounts/references.

## Acceptance criteria (from task)
- Consistent interaction states: default / hover / pressed / focus / disabled / loading / success — 120–220ms motion, reduced-motion respected.
- Real loading / skeleton / toast / error feedback (no fake delays).
- Specific success messages with next actions.
- Dashboard hierarchy (no pastel metric tiles / gradients).
- Auth experience; public / student journeys; CBT immediacy; responsiveness / accessibility.
- Final report: pages inspected, problems, improvements, components changed, interactions, loading patterns, mobile/a11y, test results, regressions, preservation confirmation.

## Audit findings (Stage A) — problems documented

### HubHomePage
- Updates feed skeleton used for news only; CBT grid and tool tiles render without a loading region when catalogue fetches (acceptable but could use `SkeletonTiles` for layout stability).
- No obvious card redesign needed.

### AuthPageV2
- Error/message banners are inline styles (`#fef2f2`/`#ecfdf5`) — fine but should use shared `.er-inline-notice` tokens so success/error colour matches the design system exactly.
- Submit button: `transition: background .2s ease` (200ms ✓) but no `:active`/pressed state, no busy spinner. `aria-busy` present ✓.
- Focus: password reveal buttons measured 16×16 — a11y.css sets 24px min via `[aria-label='Show/Hide password']` ✓ but AuthPageV2 buttons use `aria-label` so covered.
- Mobile: two-column name/phone grid stacks implicitly? Needs check at ≤420px.

### StudentDashboardV2
- `dash-metric-strip`: 6 metric cards with `#f8fafc` backgrounds and `#0f172a` values — not pastel but a flat metric strip (acceptable, keep hierarchy; order: scored tests / average / best / in progress / submitted-unscored / ran out of time / questions answered).
- `dash-cgpa-result` uses `#ecfdf5`/`#a7f3d0` (green-tinted card) — acceptable as a calculated result, not a decorative tile.
- `dash-priority` urgent row uses `#f0cfc4`/`#b14933` crimson icon — designated accent ✓.
- Loading uses `SkeletonRows` ✓; errors use inline divs rather than `ErrorState`/`InlineNotice` — unify.

### ExamSetupPage
- `WaveLoader` used during catalogue fetch ✓ (real, no fake delay).
- Subject chips / track selection: selected state via `.er-mode-option.is-selected` ✓.
- No inline error when catalogue fetch stalls — add `usePendingPhase` slow/stalled handling.

### CbtSessionPage
- Answer selection immediate (optimistic local state) ✓ — no change to interaction.
- Save state: `saving…`/`saved`/`not yet saved`/`not saved` with `WaveLoader inline` ✓.
- Exam submit uses `submitting` flag + "Submitting…" ✓; dialogs specific ✓.
- `er-exam-end` button has inline `boxShadow: '0 2px 8px rgba(0,0,0,0.22)'` and inline `backgroundColor: '#B14933'` — crimson is the designated "End test" accent ✓ but should use design tokens + shared `:disabled`/`:active` states.
- Timer uses `aria-live="off"` with spoken announcements at ≤60s/≤300s ✓ (accessible).
- Pending-phase banner (`loadPhase === 'stalled'` + "Try again") ✓ real feedback.

### CbtResultsPage
- Loading: bare `<p>Loading your CBT result…</p>` in `hub-panel hub-empty` — replace with `LoadingState`/`Skeleton`.
- Error: inline divs — replace with `ErrorState`.
- Delete: `deleteBusy` + "This result could not be deleted" ✓ but no success message after deletion.
- Result slip: specific, no invented amounts ✓.

### PastQuestionsPage
- `SkeletonTiles tiles={6}` ✓ real loading; `ErrorState` ✓; `InlineNotice` ✓.
- Search auto-scrolls with `smooth` (respects reduced motion? `smooth` scroll is not CSS transition — keep but acceptable).

### AdminDashboard / HubLayout / HubSideRail
- HubLayout: inline styles on header/buttons; crimson "Talk to Us" WhatsApp link ✓ designated accent.
- Skip link present ✓.
- ConnectionBanner sticky strip ✓.

## Plan — Stage B: Interaction foundation (tokens + shared states)
Goal: every interactive control has default/hover/pressed/focus/disabled/loading/success, 120–220ms motion, reduced-motion respected.

1. **Add `src/styles/interaction.css`** — one owner for interaction motion/imported after `brand-actions.css` before `a11y.css`:
   - `.er-btn` / `.er-btn--primary` / `.er-btn--secondary` / `.er-btn--danger` / `.er-btn--ghost`: default, `:hover`, `:active`, `:focus-visible`, `:disabled`, `[aria-busy="true"]` using existing tokens (`--er-primary`, `--er-crimson`, disabled tokens). 120–220ms transitions.
   - `.er-pill` / `.er-chip` selected state (reuse `--er-primary-soft`).
   - `.er-link` primary link states.
   - `.er-field` focus ring (reuse theme focus rules).
   - Motion block: `@media (prefers-reduced-motion: reduce)` resets transitions to 0.01ms (reinforces a11y.css).
   - No colours outside existing tokens; no new components.
2. **Wire `interaction.css` into `src/main.tsx`** — after `brand-actions.css`, before `a11y.css` (18th import). Verify import order unchanged otherwise.
3. **AuthPageV2** — replace inline error/message banners with `InlineNotice` (danger/success) from `AsyncState`; add `WaveLoader inline` spinner inside submit button when `busy`; ensure `:active` pressed state via shared classes. Success messages specific ("Account created — proceed to profile completion").
4. **StudentDashboardV2** — replace inline error divs with `ErrorState`/`InlineNotice`; keep metric strip (not pastel); ensure hierarchy: urgent priority row first, metrics below, requests/CBT after.

## Plan — Stage C: Core journeys (public + student)
1. **HubHomePage** — wrap CBC grid + tool tiles + news feed in `SkeletonTiles`/`SkeletonRows` during initial fetch for layout stability (no fake delay; real loading only).
2. **AuthPageV2** (from B) — done.
3. **StudentDashboardV2** (from B) — done; specific success messages with next actions for service requests / deletions (`InlineNotice is-success` with "Next:" line).
4. **ExamSetupPage** — `usePendingPhase` slow/stalled banner for catalogue fetch; selected subject chips clear.
5. **CbtResultsPage** — `LoadingState`/`ErrorState`; specific delete success ("Deleted attempt <id>. You can start a new practice test from the CBT Centre.") with link.

## Plan — Stage D: CBT
1. **CbtSessionPage** — `er-exam-end` button: replace inline styles with shared `.er-btn--danger` + tokens; keep crimson as designated accent. Ensure answer selection stays immediate (no change to `choose`/`clearAnswer`). Save-state and timer unchanged (already good).
2. **PastQuestionsPage** — already strong; verify `SkeletonTiles` count matches card grid to avoid CLS.
3. CBT navigation/answer selection must stay immediate — no new waiting animations in exam.

## Plan — Stage E: QA + tests
- Run `npm run typecheck`, `npm test` (existing test suite) — must pass unchanged.
- Run `npm run build` — must succeed.
- Manual/verified checklist: focus ring visible on buttons/fields; reduced-motion disables transitions; mobile ≤420px auth/dashboard; disabled buttons look disabled; loading states use real fetches only.
- No new test files required unless behavior changed; existing `tests/a11y.test.ts`, `tests/brand-colors.test.ts` guard focus ring and brand colours.

## Deliverable (final report)
Pages inspected, problems found, improvements made, components changed, interactions specified, loading patterns, mobile/a11y notes, test results, regressions, preservation confirmation (brand colours, cards, auth, CBT rules, backend compatibility).
