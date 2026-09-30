# 03 — Roles and Permissions

## 1. Current state (verified in code)

The database carries a wider role vocabulary than the application enforces:

| Layer | Roles seen | Where |
|---|---|---|
| `profiles.role` (database) | `student`, `admin`, `super_admin`, `moderator`, `senate_admin`, `campus_agent` | RLS policies (`is_staff_user()`, notification creation, profile protections) |
| Server authorization | Every staff role collapses to one: `ADMIN_ROLES = {admin, super_admin, moderator}` in `lib/auth.ts`, returned as `role: 'admin'` | `requireAdmin` in `middleware.ts` |
| Frontend routing | Depends on the server session check; `ProtectedRoute` redirects unauthenticated users | `src/app/ProtectedRoute.tsx` |

Consequences that matter:

1. **`senate_admin` and `campus_agent` can read staff-scoped rows through RLS but
   cannot pass `requireAdmin`.** They are half-roles: data access without
   application permission. That is an inconsistency to resolve, not a feature.
2. **There is no capability separation inside the admin console.** Anyone who
   passes `requireAdmin` can publish news, ban a student, edit the question bank
   and bulk-import data.
3. **Guest CBT scoring has no role at all** — it is intentionally public and
   protected by rate limiting instead (`30 / 10 min`).
4. Frontend hiding is not relied on as a boundary; server middleware and RLS are.
   That is correct and must stay.

## 2. Target model

Four roles, mapped to the work that actually exists. This is the smallest set
that separates duties without inventing an organization EduReach does not have.

| Role | Who | Can do | Cannot do |
|---|---|---|---|
| `student` | Every registered user | Own profile, own requests, own CBT attempts and results, own saved items, own notifications, public read surfaces | Any staff surface, any other student's data |
| `content_editor` | Publishing staff | News CMS (create/edit/publish/feature), ingestion review queue, opportunities, institutions, calendar items, CBT **content** (exams, questions) | Service requests (student personal data), user management, bulk import, security settings, role changes |
| `service_admin` | Processing staff | Service queue: view assigned requests, change status with valid transitions, add admin notes, complete/close, view supporting documents | Publish content, edit question banks, manage users, bulk import |
| `super_admin` | Owner/operator | Everything, plus user management (suspend/restore), role assignment, bulk data import/export, audit log review, platform health | — |

`senate_admin` and `campus_agent` are **retired** in the target model. Their
intent (institution-scoped or campus-scoped moderation) is a future capability
that requires institution scoping in the data model; until that exists, they stay
disabled. If any live account holds one, it must be migrated to a defined role.

### Capability map

Authorization is expressed as capabilities, not route names, so a new endpoint
declares what it needs rather than which role may call it.

| Capability | content_editor | service_admin | super_admin |
|---|---|---|---|
| `content.publish` (news publish/feature/unpublish) | ✅ | — | ✅ |
| `content.review` (ingestion queue approve/reject) | ✅ | — | ✅ |
| `content.catalogue` (services, institutions, calendar, opportunities) | ✅ | — | ✅ |
| `cbt.manage` (exams, questions, activation) | ✅ | — | ✅ |
| `service.process` (status, notes, completion) | — | ✅ | ✅ |
| `service.read_all` | — | ✅ | ✅ |
| `user.manage` (suspend, restore) | — | — | ✅ |
| `user.roles` | — | — | ✅ |
| `data.import` (bulk import/export) | — | — | ✅ |
| `audit.read` | — | — | ✅ |
| `platform.health` | — | — | ✅ |

## 3. Where enforcement happens

```
Browser request
      ↓
requireAdmin / requireUser            (server middleware — authentication)
      ↓
capability check                      (server — authorization)
      ↓
service-role database call or RPC     (database — business rules + RLS for client paths)
      ↓
admin_audit_log(...)                  (audit trail for privileged mutations)
      ↓
response
```

Rules that do not change:

1. **The browser is never the authority.** Every admin route is gated by
   `requireAdmin` today and must be gated by a capability check after
   implementation.
2. **RLS is the last line, not the only line.** Owner-scoped policies stay on all
   student tables; governance tables stay service-role only with RLS enabled and
   no browser policy.
3. **Answer keys never leave the server.** `exam_questions` is not
   browser-readable; guests are scored by the server, signed-in students by RPC.
4. **Role changes are themselves audited** and can only be performed by
   `super_admin`.

## 4. Privacy boundaries by role

| Data | student | content_editor | service_admin | super_admin |
|---|---|---|---|---|
| Own profile and academic data | ✅ | — | — | ✅ (with audit) |
| Other students' profiles | — | — | — | ✅ (with audit) |
| Own service requests | ✅ | — | — | ✅ |
| All service requests, form data, documents | — | — | ✅ | ✅ |
| CBT content and answer keys | — | ✅ | — | ✅ |
| Own CBT attempts and results | ✅ | — | — | ✅ |
| Analytics events | — | — | — | ✅ |
| Audit logs | — | — | — | ✅ |

A content editor must not be able to read service-request form data: it contains
student personal information unrelated to publishing.

## 4a. Decision (2026-09-30)

The capability layer is adopted **now**; the role split is **deferred** (open
decision D1 in `docs/architecture/README.md`). Concretely: every staff endpoint
declares the capabilities it needs, all current staff roles map to the full
capability set, and `senate_admin`/`campus_agent` are retired from the
vocabulary. Splitting `content_editor` from `service_admin` becomes a change of
role assignments rather than a change of enforcement, so it can happen when a
second staff member is onboarded without another code rewrite.

Until that split happens, the practical rule stands: **do not give a content-only
staff member an admin account**, because today every staff account can reach
service-request data.

## 5. Migration path

Ordered so nothing breaks while it happens:

1. **Add the capability layer server-side** (`requireCapability(...)`), mapping
   the current single staff role to `super_admin` for all capabilities, so
   behaviour is unchanged until roles are assigned.
2. **Add an explicit role column value set** in the database: extend the check
   constraint to `student | content_editor | service_admin | super_admin`, and
   map existing `admin`/`moderator` → `super_admin`, `super_admin` → `super_admin`.
3. **Assign real roles** to the accounts that need them.
4. **Neutralise `senate_admin`/`campus_agent`**: no account may hold them; the
   RLS policies that reference them are rewritten in terms of `is_staff_user()`
   so the vocabulary cannot drift from the application again.
5. **Add tests** proving each capability rejects the wrong role (extending the
   existing unauthenticated-access matrix in `tests/api.test.ts`).
6. **Update the admin console** so navigation shows only permitted sections —
   as a convenience, never as the boundary.

Estimated size with D1 applied: one middleware addition, a capability map, tests,
and small console changes (no role migration needed yet). It is scheduled as
`ROLE-1` in the feature catalogue and should land before any second staff member
is onboarded.
