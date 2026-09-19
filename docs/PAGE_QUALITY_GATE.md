# EduReach Page/Path Quality Gate

This is a mandatory release gate for every route in EduReach. A route is not considered complete because it renders. It must pass the global gates and its route-specific functional checks.

## Status

- **PASS** — all applicable gates verified.
- **REVISE** — implementation works but one or more quality requirements remain.
- **BLOCKED** — a required dependency, route, API, asset, data contract or test is unavailable or failing.

Only **PASS** routes may become the baseline for the next route.

## 1. Project integrity

- [ ] Uses the approved `src/app`, `src/components`, `src/pages`, `src/data`, `src/lib`, `src/styles`, and `src/types` structure.
- [ ] No duplicate component or page created for an existing role.
- [ ] Shared data is centralized.
- [ ] No hard-coded service metadata that belongs in `src/data/services.ts`.
- [ ] No hard-coded secrets or credentials.
- [ ] Imports and dependencies are intentional.

## 2. Design-system integrity

- [ ] Uses EduReach typography, colors, spacing, radius, shadows and interaction language.
- [ ] Uses the existing shared header/navigation and page container where applicable.
- [ ] Uses the established compact card system where cards are required.
- [ ] Uses approved brand marks for external organizations.
- [ ] No route-specific visual language has been introduced without an architecture reason.

## 3. Page structure and purpose

- [ ] Route has one clear primary purpose.
- [ ] Page structure is appropriate to its function.
- [ ] Meaningful H1 exists where appropriate.
- [ ] Supporting content is subordinate to the primary task.

## 4. Route integrity

- [ ] Canonical URL is defined in `src/app/routes.tsx`.
- [ ] Browser title/route identity is correct.
- [ ] Direct/deep linking loads the intended route.
- [ ] Back/forward navigation behaves correctly.
- [ ] Unknown routes resolve to the intended 404 experience.
- [ ] No broken internal links.

## 5. Accessibility

- [ ] Semantic landmarks are used appropriately.
- [ ] Heading hierarchy is logical.
- [ ] Buttons and links have meaningful accessible names.
- [ ] Form controls have labels.
- [ ] Keyboard navigation works.
- [ ] Focus states are visible.
- [ ] Color is not the only interaction/status signal.
- [ ] Images have useful alt text when informative; decorative images are marked appropriately.
- [ ] Touch targets are usable on mobile.
- [ ] Contrast is acceptable.

## 6. Responsive QA

Verify at minimum:

- [ ] 1440px
- [ ] 1280px
- [ ] 1024px
- [ ] 768px
- [ ] 480px
- [ ] 390px
- [ ] 360px

Check for horizontal overflow, clipping, broken grids, overlapping navigation, unusable forms and oversized/microscopic controls.

## 7. State coverage

For every applicable interaction:

- [ ] Default
- [ ] Loading
- [ ] Empty
- [ ] Error
- [ ] Success
- [ ] Disabled
- [ ] Active/focus

A happy-path render alone is insufficient.

## 8. Forms

Where forms exist:

- [ ] Labels and instructions are clear.
- [ ] Input constraints are validated.
- [ ] Validation errors are understandable.
- [ ] Loading/submission state is handled.
- [ ] Success state is handled.
- [ ] Failure/retry state is handled.
- [ ] Sensitive credentials are never collected unless explicitly required by the approved architecture.

## 9. Performance

- [ ] Heavy route code is lazy-loaded where appropriate.
- [ ] Images/assets are appropriately sized.
- [ ] Unnecessary libraries are not loaded.
- [ ] Unrelated feature data is not loaded at startup.
- [ ] No duplicate asset or dependency loading was introduced.

## 10. Code quality

- [ ] TypeScript has no errors.
- [ ] No unused imports or dead code.
- [ ] No avoidable duplicated logic.
- [ ] Effects have clear reasons and dependencies.
- [ ] Console errors/warnings relevant to the route are resolved.
- [ ] Naming and component boundaries are clear.

## 11. Route-specific QA

Each feature must define its own functional checklist before it can pass. Examples:

### CBT

- [ ] Exam selection/start
- [ ] Question loading
- [ ] Timer
- [ ] Answer selection
- [ ] Progress/navigation
- [ ] Submit/expiry
- [ ] Persistence/recovery where supported
- [ ] Results

### Calculator/tool

- [ ] Valid input
- [ ] Invalid input
- [ ] Calculation
- [ ] Result presentation
- [ ] Reset/edit flow

### Content/listing

- [ ] Loading
- [ ] Results
- [ ] Empty state
- [ ] Error/retry
- [ ] Detail navigation
- [ ] Pagination/filtering where applicable

### Student workspace

- [ ] Authentication
- [ ] Authorization
- [ ] Profile/account state
- [ ] Navigation
- [ ] Notifications/saved/application states where applicable
- [ ] Unauthorized/expired-session behavior

## 12. Evidence

A PASS should be based on actual verification, not visual assumption. Record:

- route tested
- commit tested
- checks performed
- known limitations
- route-specific result

If a check cannot be performed, mark it **REVISE** or **BLOCKED**, not PASS.

## Route register

Maintain the current route status in `docs/ROUTES.md`. Do not mark a route PASS until this gate has been verified for the current implementation.
