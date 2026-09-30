# Feature: ROLE-1 — Capability-based authorization

Status: **implemented** (see Evidence). Written before the code, per
`docs/architecture/08-FEATURE-TEMPLATE.md`.

## Purpose

Make authorization one thing instead of many. Today the server answers one
question — "is this account any kind of staff member?" — through `requireAdmin`
in `middleware.ts`, and the database carries a *different, wider* role
vocabulary than the application enforces. Two consequences were recorded in
`docs/architecture/03-ROLES-AND-PERMISSIONS.md`:

1. `senate_admin` and `campus_agent` pass staff RLS predicates but can never pass
   `requireAdmin` — data access without application permission.
2. Any staff account can publish news, ban a student, rewrite the question bank
   and bulk-import data, because there is no separation inside the console.

ROLE-1 replaces role-name checks with a capability vocabulary
(`resource.action`), enforces it server-side on every privileged endpoint, keeps
Supabase/RLS as the last line for ownership, and makes the admin console render
only what the signed-in account may actually use.

Authentication answers *who the user is*. Authorization answers *what that user
may do*. The browser is a convenience layer and is never the boundary.

## User

Students, content staff, service staff and the platform owner. A student's
experience does not change. Staff gain least privilege: a content editor can run
the newsroom but cannot read service-request form data; a service administrator
can process requests but cannot publish or delete content.

## User Flow

1. Sign-in is unchanged: Supabase session in the browser, bearer token on API calls.
2. The server resolves the account's role from `profiles.role` (never from
   user-editable metadata), maps it to an application role, and derives its
   capabilities.
3. Each privileged endpoint declares the capability it needs. Missing
   capability ⇒ 403 with a generic message; the operation never runs.
4. The admin console asks `/api/admin/session` who the user is and what they can
   do, hides sections they cannot use, and shows an explicit "not available for
   your role" panel for a deep link instead of an empty page.
5. Owner-scoped student actions (own CBT attempt, own service request) check
   capability **and** ownership; RLS repeats the ownership check in the database.

## Screens

No new screens and no redesign. Three existing surfaces change:

- **Admin console shell** (`pages/AdminLayout.tsx`) — the sidebar renders only
  permitted sections; an unpermitted deep link renders an access-denied panel.
- **Newsroom CMS** (`pages/AdminNewsPage.tsx`) — Publish/Unpublish requires
  `news.publish`, Delete requires `news.delete`, New article requires `news.create`.
- **Student accounts** (`pages/AdminUsersPage.tsx`) — Suspend/Unsuspend requires
  `user.suspend`; the role control requires `user.manage_roles`.

`screens/` in the design system is unchanged (see `06-DESIGN-SYSTEM.md`); the
access-denied panel reuses the existing `.admin-access-screen` classes.

## Routes

Server (capability in parentheses; all are 401 without a token, 403 without the
capability):

| Route | Method | Capability |
|---|---|---|
| `/api/admin/session`, `/api/admin/session/verify` | GET/POST | staff (any capability) |
| `/api/admin/analytics` | GET | `analytics.read` (audit feed additionally needs `audit.read`) |
| `/api/admin/integrity` | GET | `data.read` |
| `/api/admin/users`, `/api/admin/users/:id/activity` | GET | `user.read` |
| `/api/admin/users/:id/ban`, `…/unban` | POST | `user.suspend` |
| `/api/admin/users/:id/role` | POST | `user.manage_roles` |
| `/api/admin/service-requests` | GET | `service_request.read` |
| `/api/admin/service-requests/:id` | PATCH | `service_request.process` |
| `/api/admin/cbt/exams`, `/api/admin/cbt/exams/:id/questions` | GET | `cbt.read` |
| `/api/admin/cbt/exams`, `/api/admin/cbt/exams/:id`, `/api/admin/cbt/questions/:id` | POST/PATCH/DELETE | `cbt.manage` |
| `/api/admin/news` | GET | `news.read` |
| `/api/admin/news` | POST | `news.create` (+ `news.publish` when `published: true`) |
| `/api/admin/news/:id` | PATCH | `news.update` (+ `news.publish` when publishing) |
| `/api/admin/news/:id` | DELETE | `news.delete` |
| `/api/admin/calendar-items` | GET/POST/PATCH/DELETE | `calendar.read` / `calendar.create` / `calendar.update` / `calendar.delete` |
| `/api/admin/institutions` and `/:id` | GET/POST/PATCH/DELETE | `institution.read` / `.create` / `.update` / `.delete` |
| `/api/admin/services` and `/:id` | GET/POST/PATCH/DELETE | `service.read` / `service.create` / `service.update` / `service.delete` |
| `/api/admin/opportunities` and `/:id` | GET/POST/PATCH/DELETE | `opportunity.read` / `.create` / `.update` / `.delete` |
| `/api/admin/uploads` | POST | `news.create`, `opportunity.create`, `institution.update` or `calendar.update` (any) |
| `/api/admin/content-manager/resources`, `…/data/:resource` | GET | `data.read` |
| `/api/admin/content-manager/data/:resource(/:id)` | POST/PATCH/DELETE | `data.write` |
| `/api/admin/content-manager/import/:resource` | POST | `data.import` |
| `/api/admin/newsroom/ingest` | POST | `news.create` |
| `/api/admin/newsroom/runs`, `…/candidates` | GET | `news.read` |
| `/api/admin/newsroom/candidates/:id/approve` | POST | `news.publish` |
| `/api/admin/newsroom/candidates/:id/reject` | POST | `news.update` |

Student endpoints (authenticated + owner-scoped):

| Route | Method | Capability | Ownership |
|---|---|---|---|
| `/api/cbt/exams/:examId/start` | POST | `cbt.attempt` | attempt is created for the caller |
| `/api/cbt/submit` | POST | `cbt.attempt` | attempt must belong to the caller |
| `/api/cbt/attempts/:attemptId/progress` | GET/PATCH | `cbt.attempt` | `.eq('user_id', caller)`; mismatch ⇒ 404 |

Browser routes (used for console visibility, never as a boundary):

| Path | Requirement |
|---|---|
Public (`/`, `/news`, `/jobs`, `/schools`, `/services`, `/cbt`, `/tools/…`) | none |
| `/dashboard`, `/profile`, `/settings`, `/services/track` | authenticated (`ProtectedRoute`) |
| `/admin` | staff |
| `/admin/news` | `news.read` |
| `/admin/content` | `calendar.read` |
| `/admin/opportunities` | `opportunity.read` |
| `/admin/services` | `service.read` |
| `/admin/queue` | `service_request.read` |
| `/admin/schools` | `institution.read` |
| `/admin/cbt` | `cbt.read` |
| `/admin/users` | `user.read` |
| `/admin/analytics` | `analytics.read` |
| `/admin/content-manager` | `data.read` |

## Components

- **`src/components/admin/Can.tsx`** (new) — `AdminCapabilityProvider`,
  `useAdminCapabilities()`, `<Can capability fallback>`; mirrors server
  capabilities for buttons and panels.
- **`pages/AdminLayout.tsx`** — nav items carry a capability; the shell provides
  the capability context to its children.
- Existing admin pages consume `<Can>` in place of ad-hoc role checks.

## User Actions

| Action | Capability | Where enforced |
|---|---|---|
| Sign in / sign out | — | Supabase Auth (unchanged) |
| View own dashboard, profile, settings | `dashboard.access`, `profile.*`, `settings.*` | `ProtectedRoute` + RLS |
| Start/submit a CBT attempt, read own progress | `cbt.attempt` | server ownership check + RPC |
| Create a service request, read own requests | `service.create`, `service.read_own` | RLS owner policies |
| Publish news, approve an ingested candidate | `news.publish` | server capability check |
| Process a student service request | `service_request.process` | server capability check |
| Suspend a student account | `user.suspend` | server capability check + audit |
| Change an account's role | `user.manage_roles` | server capability check + audit |

## Button Logic

- A button is rendered only when the signed-in account holds its capability
  (`<Can>`), and the endpoint repeats the check. Hiding is UX; the 403 is the rule.
- A 403 from the server is shown as a readable error and leaves the page state
  untouched (no optimistic success).
- `Publish` on a news article sends `published: true`; the server additionally
  requires `news.publish`, so a role with only `news.create`/`news.update`
  receives 403 rather than an accidental publication.
- Role change requires an explicit selection and a confirm step; the server
  rejects changing your own role (400) so an owner cannot lock themselves out.

## Data

Read: `profiles.role` (the only authorization input from the database),
`admin_audit_logs` (audit feed). Written: `profiles.role` (through
`POST /api/admin/users/:id/role`), `admin_audit_logs` (via the existing
`admin_audit_log` RPC). No new tables, no new columns, no duplicated role store.

## Data Source

`profiles.role` is authoritative for role assignment; `src/lib/capabilities.ts`
is authoritative for the role → capability mapping. The mapping lives in code
rather than in `roles`/`capabilities`/`role_capabilities` tables on purpose:

- it is versioned and reviewed with the endpoints that depend on it;
- a database table would be a second source of truth that can drift from the
  deployed code and would itself need authorization to edit;
- the repository cannot currently reproduce its own base schema (BASE-1), so
  adding four more tables to an unverified baseline multiplies the risk.

If runtime-editable permissions are ever required, `role_capabilities` can be
introduced behind the same `hasCapability()` seam without touching call sites.

## Backend

- **`src/lib/capabilities.ts`** (new, browser-safe) — the capability vocabulary,
  `AppRole`, `ROLE_CAPABILITIES`, `resolveAppRole()`, `capabilitiesForRole()`,
  `hasCapability()`, `ADMIN_ROUTE_CAPABILITIES`.
- **`lib/auth.ts`** — `verifyJWT()` returns `appRole` + `capabilities` resolved
  from the trusted profile row; `verifyAdminToken()` means "any staff capability".
- **`lib/authorization.ts`** (new, server-only) — `can(user, capability,
  resource?)`, `hasAnyCapability()`, `requireStaff`, `requireCapability(...caps)`
  (any-of), `assertOwnership()`, `recordAudit()`.
- **`middleware.ts`** — the Express guards, delegating to the module above.
- **`server.ts`** — every `/api/admin/*` route declares its capability; the
  student CBT routes resolve the caller and enforce ownership; `/api/admin/session`
  returns `role` and `capabilities`; the analytics audit feed is omitted for
  callers without `audit.read`; `POST /api/admin/users/:userId/role` assigns a
  role from the vocabulary and audits it.
- **`supabase/migrations/20260930140000_capability_role_alignment.sql`** —
  normalises the retired staff aliases (`admin`, `moderator`) to `super_admin`
  (identical access), adds a check constraint carrying the application
  vocabulary plus the two retired values, retires `senate_admin` and
  `campus_agent` from the staff RLS predicates, and narrows the notification
  staff-insert policy. **Rows holding a retired role are left untouched** and are
  reported as a warning so the operator can re-assign them deliberately — a
  migration must not silently demote a real person.

The flow for every privileged request is:

```
Request → bearer token → Supabase session validation → profiles.role
        → application role → capabilities → capability check
        → input validation → operation (service role, after authorization)
        → admin_audit_log(...) → response
```

## Security

- **Nothing client-supplied is trusted.** Role, capabilities, user id and
  ownership are resolved server-side from the validated session and the profile
  row. `user_metadata.role` is ignored (regression-tested in `tests/auth.test.ts`).
- **403 does not leak.** A missing capability returns one generic message
  (`You do not have permission to perform this action.`); resource existence is
  only revealed after authorization, and ownership mismatches return 404, not 403.
- **Vertical escalation is closed** by the capability checks; the new role
  endpoint is `user.manage_roles` (super admin), validates the value against the
  vocabulary, and refuses self-modification.
- **Horizontal escalation is closed** by ownership checks plus RLS; the service
  layer no longer exposes other students' rows through a bare staff check.
- **The service-role key stays server-side** and is only used after authorization.
- **Retired half-roles** (`senate_admin`, `campus_agent`) lose both the staff RLS
  predicate and any application capability — they can no longer read staff-scoped
  rows they have no endpoint for.
- **Audit** records actor, action, resource type/id, metadata and time for role
  changes, suspensions, publications/deletions, service status changes, CBT
  changes and bulk data writes. Audit writes never break the operation.

## States

- **Unauthenticated** — 401 `Authentication required.`
- **Invalid/expired token** — 401 `Invalid or expired session.` (changed from the
  previous 403 so unauthenticated and unauthorized are distinguishable).
- **Authenticated, missing capability** — 403 generic message.
- **Authenticated student on an admin route (browser)** — console shell shows the
  access-denied panel instead of the section.
- **Session endpoint unavailable** — the console falls back to the profile row it
  can read under RLS, deriving the same capabilities from the same vocabulary; if
  that also fails, access is refused.
- **Audit RPC missing** — the operation proceeds, the failure is logged.

## Edge Cases

| Case | Behaviour |
|---|---|
| Role value is unknown (typo, legacy, hand-edited) | Treated as `student` — least privilege, never staff |
| `senate_admin` / `campus_agent` account | No capabilities; 403 on every admin endpoint, and no staff RLS access. The stored role is left as-is and reported by the migration instead of being rewritten |
| `admin` / `moderator` account | Maps to `super_admin` so behaviour is unchanged until roles are assigned |
| Profile row missing or unreadable | No capabilities ⇒ 403; never assumes staff |
| Account banned mid-session | Supabase rejects the token on the next call ⇒ 401 |
| Two roles needed (upload by content staff) | Endpoint accepts any-of a capability list |
| Publishing through a generic PATCH | `news.publish` checked from the payload, not from the route alone |
| Self-demotion / self-suspension | 400, with an explanatory message |
| Role assigned while the user is signed in | Takes effect on the next API call (capabilities resolve per request) |
| Owner-scoped write attempt on another student's row | Capability passes, ownership fails ⇒ 404, row untouched |

## Analytics

N/A — authorization is not a product event. 403s are logged server-side
(console) but are deliberately not written to `site_analytics_events`, which
tracks student behaviour.

## Notifications

N/A — no student-visible notification is produced by authorization. (Service
status notifications are NTF-1.)

## Testing

`tests/authorization.test.ts`:

- vocabulary: every capability referenced by a route or UI map exists in
  `CAPABILITIES`; no duplicates; format is `resource.action`;
- role mapping: legacy values resolve as documented; retired roles carry no
  capabilities; `super_admin` ⊇ every staff capability; `student` holds no staff
  capability;
- `can()`: own-resource allow/deny, staff override where documented,
  owner-scoped capability without a resource ⇒ false;
- middleware: no token ⇒ 401, invalid token ⇒ 401, student token ⇒ 403, wrong
  staff role ⇒ 403, right capability ⇒ 200, any-of list ⇒ 200;
- route coverage: every `/api/admin/*` route in `server.ts` carries an explicit
  capability (an unprotected new endpoint fails the test);
- end-to-end through the real server with a stubbed Supabase: `/api/admin/session`
  returns role + capabilities; a student token cannot read `/api/admin/users`;
  a content editor cannot read service requests; a service administrator cannot
  publish news; a content editor can read the newsroom; the audit feed is
  withheld without `audit.read`;
- ownership: `/api/cbt/attempts/:id/progress` queries with `.eq('user_id', caller)`
  and returns 404 when the stub reports someone else's attempt;
- migration SQL: pins the four-role list, the retired roles' absence from the
  staff predicate, the guarded/idempotent structure, and the check constraint;
- regression: the whole existing suite (186 tests) still passes.

## Evidence (as built)

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | clean |
| Tests | `npm test` | **205/205** (18 new: 17 in `tests/authorization.test.ts` + 1 auto-derived by the anonymous-access matrix for the new role route) |
| Build | `npm run build` | client + `build/server.cjs` |
| Prod smoke (stubbed Supabase contract) | `PORT=3114 node build/server.cjs` + curl | anonymous 401 (`Authentication required.`); student and `senate_admin` 403 on `/api/admin/session`; `content_editor` 200 on `/api/admin/news` and 403 on `/api/admin/users` and `/api/admin/service-requests`; `service_admin` 200 on `/api/admin/service-requests` and 403 on `/api/admin/news`; `super_admin` 200 on all; publishing as `service_admin` 403; role change 200 for `super_admin`, 403 for `content_editor`, 400 for an unknown role and for self-change; another student's CBT attempt 404 |
| Migration | inspected; **not applied** to a live database | pre-flight query in the migration header and the PR checklist; retired-role rows are left untouched and reported as a warning |

### Fixed while implementing

- **`/api/cbt/exams/:examId/start` and `/api/cbt/submit` could never succeed.** They called
  `auth.uid()`-based RPCs with the service-role client, so the RPC always raised
  "Authentication required". They now use a user-scoped client (publishable key +
  the caller's token) and are gated by `cbt.attempt`. The browser has always used
  the RPCs directly, so this fixes a server endpoint rather than a user journey.
- **An unverifiable bearer token returned 403.** It is an unauthenticated request
  and now returns 401, leaving 403 to mean "signed in, not allowed"
  (`tests/api.test.ts` updated to pin the new contract).
