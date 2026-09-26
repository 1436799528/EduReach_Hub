# Programming audit and regression-test results

**Date:** 2026-09-26  
**Repository:** EduReach_Hub  
**Branch:** `arena/01a0dda1-edureach-hub`  
**Baseline:** `87150951d4fb2c3db0c3c97ba0ae48774d8f6d86`

## Decision

**Local automated code gate: PASS.** A clean dependency installation followed by `npm run check` completed successfully: **246 tests passed, zero failed, zero skipped**, TypeScript checking and both production bundles passed, and the dependency audit reported zero known vulnerabilities.

**Production certification: NOT established.** The browser suite runs without Supabase credentials, and authentication contract tests use a local stub. Live database policies, real account workflows, concurrency, and deployment infrastructure are not certified by this result. Important remaining findings are listed below; passing tests is not a claim that every possible behavior is correct.

## Initial state

- `npm ci` succeeded and reported zero known dependency vulnerabilities.
- `npm run lint` failed with TS2724: `SearchPage.tsx` imported the removed `examSimulators` export.
- The repository had no `test` script or executable regression suite. CI ran TypeScript and the build only.
- Earlier audit documents describe other snapshots; their passing results did not apply to this checkout's broken import.

## Fixes made

| Priority | Finding | Change and evidence |
|---|---|---|
| High | Search imported a deleted static CBT catalog, preventing type checking/building. | Search now loads the active catalog with `fetchCbtExams`, handles unavailable data, and indexes concrete exam IDs. Type check, build and search interaction tests pass. |
| High | Service worker cached successful API responses without user separation, potentially replaying private data on a shared device. | APIs, serverless functions and requests with Authorization now bypass caching. Only allowlisted public assets are cached. Cache version 4 purges old EduReach caches; API responses use `Cache-Control: no-store`. Worker regression tests verify bypass and cleanup. |
| High | The server bundle and its source map were generated inside the public `dist/` directory, which Express serves and Netlify publishes. | Private output now goes to `build/server.cjs`; only frontend output goes to `dist/`. Production HTTP tests verify server source/map content is not publicly returned. Deployment commands and Docker paths updated. |
| High | Server configuration rejected every legacy JWT, including valid Supabase service-role keys, while auth middleware used different key precedence. | Centralized key classification accepts modern `sb_secret_` keys and legacy JWTs with the `service_role` claim; rejects anon/publishable keys. Both server and auth middleware use the same preference. Key decoding only classifies configuration—Supabase still verifies it. |
| High | Docker's final image lacked dependencies required by the externalized Node bundle. | Runtime dependencies are copied into the image, build outputs are separated, and Node is aligned to version 22. Added `.dockerignore` to exclude credentials and local artifacts. Docker execution itself remains untested here. |
| Medium | `npm start` defaulted to development behavior if NODE_ENV was absent; `.env` was not loaded into server-side configuration. | Start now explicitly selects production mode; server loads `dotenv/config`; Vite is imported only for development. Production browser tests run this start command. |
| Medium | Malformed percent-encoded frontend URLs could throw during route rendering; Express's wildcard also returned an error page on direct access. | Route parsing falls back to Not Found; production SPA middleware avoids decoding wildcard params. Desktop/mobile tests cover malformed news, school and service URLs. |
| Medium | Global 1 MB JSON parsing ran before the upload endpoint's 5 MB parser, making the larger limit ineffective. Parser failures also returned HTML. | Uploads authorize before using their dedicated parser; ordinary requests retain the 1 MB limit. API error handling returns safe JSON 400/413 responses. Tests cover malformed/oversized bodies and upload rejection before parsing. Authenticated real-storage upload remains unverified. |
| Medium | Calculator precedence mishandled negative/function exponents and parenthesized function results, e.g. `2^-2`, `2^sqrt(9)`, `sin(30)^2`. | Corrected shunting-yard handling of prefix operators and closed function calls. Regression tests include ordinary arithmetic, implicit multiplication, DEG/RAD, factorials, invalid inputs and display precision. |
| Medium | Rich-text link safety depended on attribute order, and relative URL checks accepted backslash/control-character forms. | Enforce safe target/rel after stripping input attributes and reject ambiguous relative URLs. DOM-based sanitizer tests cover links, scripts, handlers, images and styles. |
| Low | Empty/error CBT results lacked a primary heading. | Added an explicit result-unavailable heading, verified in both viewport suites. |
| Quality gate | No durable automated regression coverage. | Added Node tests, Playwright desktop/mobile tests and `npm run check`. An expanded CI workflow with browser installation and failure reports is retained locally, but excluded from this push because the GitHub connection lacks Workflows write permission. Existing remote CI remains unchanged. |

Dynamic CBT card links also preserve the selected exam bank through `?exam=<id>`, normalize supported exam-body names, and avoid links to nonexistent setup routes for unsupported bodies.

## Verification evidence

Final run used Node 22.22.3 and npm 10.9.8.

| Check | Result |
|---|---|
| Clean `npm ci` | PASS |
| `npm run typecheck` / legacy `npm run lint` | PASS |
| `npm test` | **130 passed**, 0 failed, 0 skipped |
| `npm run build` | PASS: Vite frontend + esbuild private server |
| `npm run test:e2e` | **116 passed**, 0 failed, 0 skipped |
| `npm audit --audit-level=low` | **0 known vulnerabilities** |
| Literal public image references in application source | **27 checked, 0 missing** |
| `git diff --check` | PASS |

### Test coverage

- **Unit/contract/API tests:** calculator operations and errors; CBT selection/duration/link generation; server key formats; bearer parsing; trusted profile roles versus user-editable metadata; invalid sessions; fail-closed profile lookup; every currently registered protected admin API route without authentication; protected student endpoints; API 404 behavior; parser/body limits; security headers; rich HTML sanitization; service-worker private-response isolation, cache migration and offline fallback.
- **Browser tests:** built production frontend in desktop Chromium and a Pixel 7 mobile viewport; 36 public direct routes; four unknown/malformed routes; 12 protected student/admin routes; search filtering, URL updates and back/forward navigation; no-match search; unconfigured login rejection; desktop/mobile navigation; static assets/security headers; server-bundle exposure regression.
- Browser cases assert absence of uncaught page exceptions and the application error-boundary screen. They are route/interaction smoke checks, not exhaustive tests of every button or database operation.
- Font-host requests are deliberately blocked in browser tests to avoid dependence on external font availability. Live third-party services are not being tested.

### Browser installation note

This sandbox could not reach Playwright's browser CDN or Debian package mirrors. For local verification, Chromium 153.0.8010.0 and its libraries were obtained through the npm-distributed `@sparticuz/chromium` package **outside the repository**. Playwright was run with its executable override and library environment. No browser binaries or sandbox-specific dependencies were added to this project's package manifest.

The normal CI path uses `npx playwright install --with-deps chromium`. An environment with CDN access can reproduce the gate with:

```bash
npm ci
npx playwright install --with-deps chromium
npm run check
```

The E2E suite requires an unconfigured frontend build; do not supply real `VITE_SUPABASE_*` values to this smoke gate. Use a separate staging integration suite for authenticated end-to-end workflows.

## Remaining findings and deployment requirements

### 1. High — CBT submission consistency/concurrency needs database integration work

Source review of `server.ts` shows the REST submission path updates the attempt and writes its answers in separate requests. It does not check that the conditional update affected a row before proceeding to answer writes. Failure between writes or concurrent submissions can produce inconsistent state.

The frontend normally uses `submit_cbt_attempt` instead. The version defined in `20260920_production_student_workflows.sql` runs transactionally but reads the attempt without `FOR UPDATE`; concurrent behavior must also be hardened and tested. This audit did **not** modify live SQL or claim this risk resolved.

**Next gate:** consolidate submission logic into an atomic, row-locked database operation; test duplicate/conflicting concurrent submissions, answer-write failures, ownership, expired attempts and retries against staging.

### 2. High — Live database/RLS and schema reproducibility are unverified

The migration history contains alterations to preexisting base tables and depends on out-of-band schema. A clean production-equivalent database was not available to rebuild. Local authorization tests do not verify deployed grants, RLS policies, migration state, Storage policies or Supabase Auth redirects.

**Next gate:** capture/validate a reproducible schema baseline and apply migrations in staging; test real student/admin accounts, profile permissions, cross-user denial, service requests, uploads, password recovery and persisted CBT results. Do not treat the health endpoint's `status: ok` as a database-readiness check.

### 3. Medium — Shared-device offline storage requires a separate ownership review

`cbt-offline.ts` stores pending submissions in a shared IndexedDB store without a user key and syncs all queued entries. Other local records use `localStorageKey`, whose scope depends on a preview-email key rather than an explicitly authenticated user ID. Server ownership checks remain necessary, but client storage separation is not proven.

**Next gate:** scope offline data by immutable authenticated user ID; test account switching, logout, queue ownership, interrupted transactions and storage failures. The service-worker fix does not resolve all IndexedDB/localStorage concerns.

### 4. Medium — Application-level abuse controls are absent

No application rate limiter was found for public analytics or guest CBT submission endpoints. External edge/WAF controls, if any, were not inspected.

**Next gate:** choose and verify shared rate limiting appropriate to the actual deployment (especially serverless), with load and abuse tests. Guest scoring deliberately returns review answer keys after submission; these practice banks must not be treated as confidential high-stakes exams.

### 5. Not run / not claimed

- Docker build and container startup: Docker is unavailable in this workspace. Docker fixes are source-reviewed, while the equivalent Node production server was exercised.
- Netlify deployment/function routing and production headers at the edge.
- Live registration, email delivery/recovery, real admin writes, uploads or external messaging integrations.
- Firefox, WebKit, real mobile devices, accessibility conformance, visual regression, performance/load testing or penetration testing.
- Exhaustive branch coverage. The existing TypeScript configuration is non-strict, and the legacy `lint` script is a type check, not an ESLint rule suite.

## Handoff

The application fixes, tests and report are prepared for push on the current working branch. No production data was changed and no deployment was manually initiated. With user approval, the expanded workflow is excluded from the push and retained locally because the GitHub connection lacks Workflows write permission. Existing remote CI still checks TypeScript and the production build; use `npm run check` locally for the full gate until the expanded workflow can be published. Resolve the remaining staging/security gates before claiming the entire deployed system is production-certified.
