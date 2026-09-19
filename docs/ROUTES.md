# EduReach Routes

Routing is centralised through `src/app/routes.tsx`, rendered by `src/app/App.tsx`. Do not create another application router or page-specific routing system.

## Current implemented routes

- /
- /services
- /services/track
- /services/apply/:slug
- /services/:slug
- /cbt
- /cbt/practice
- /cbt/results
- /screening-calculator
- /news
- /news/:slug
- /jobs
- /login, /signin
- /register, /signup
- /forgot-password
- /dashboard
- /dashboard?view=student
- /admin
- /admin/queue
- /admin/cbt
- /admin/vouchers
- /admin/users

The service directory may contain planned service routes. A directory entry does not make a route implemented. Do not wire planned routes to navigation or claim functionality until the real page and required backend/data contract exist.

## Routing rules

- Every implemented route has one canonical implementation.
- Deep links must resolve to the intended page.
- Browser title/route identity must follow the active route.
- Back/forward navigation must remain predictable.
- Unknown routes must use the project's intentional 404 strategy; they must not silently masquerade as a successful page.
- Route-specific fallback logic must not be duplicated inside individual pages.
- Query parameters such as `?view=student` are state/mode inputs to an existing route, not duplicate routes.

## Quality register

Status values:

- **PASS** — all applicable checks in `docs/PAGE_QUALITY_GATE.md` verified.
- **REVISE** — implementation exists but required checks remain.
- **BLOCKED** — required dependency or verification is unavailable/failing.

Current foundation register:

| Route | Status | Note |
| --- | --- | --- |
| / | REVISE | Foundation exists; full route QA still required |
| /services | REVISE | Central service data exists; full route QA still required |
| /cbt | REVISE | Functional implementation exists; full global + route-specific QA still required |
| /cbt/practice | REVISE | Functional implementation exists; full QA evidence still required |
| /cbt/results | REVISE | Functional implementation exists; full QA evidence still required |
| /news | REVISE | Unified news model exists; full route QA still required |
| /news/:slug | REVISE | Unified news detail route exists; full route QA still required |
| /login | REVISE | Existing auth flow requires global QA |
| /register | REVISE | Existing auth flow requires global QA |
| /forgot-password | REVISE | Existing auth flow requires global QA |
| /dashboard | REVISE | Existing student workspace requires global + account QA |
| /admin* | REVISE | Existing admin routes require route-specific QA |
| Other planned service routes | BLOCKED | Do not treat service-directory definitions as implemented pages |

A route may only move from REVISE/BLOCKED to PASS after actual verification is recorded against the current commit.
