# 03 — Roles and Permissions

## 1. State before ROLE-1 (historical)

| Layer | Roles seen | Where |
|---|---|---|
| `profiles.role` (database) | `student`, `admin`, `super_admin`, `moderator`, `senate_admin`, `campus_agent` | RLS policies (`is_staff_user()`, notification creation, profile protections) |
| Server authorization | Every staff role collapses to one: `ADMIN_ROLES = {admin, super_admin, moderator}` in `lib/auth.ts`, returned as `role: 'admin'` | `requireAdmin` in `middleware.ts` |
| Frontend routing | Depends on the server session check; `ProtectedRoute` redirects unauthenticated users | `src/app/ProtectedRoute.tsx` |

1. `senate_admin` and `campus_agent` could read staff-scoped rows through RLS but
   could not pass `requireAdmin` — half-roles: data access without application
   permission. **Retired and neutralised by ROLE-1.**
2. There was no capability separation inside the admin console. **Fixed:** every
   privileged endpoint now names a capability.
3. Guest CBT scoring still has no role — it is intentionally public and protected
   by rate limiting (`30 / 10 min`).
4. Frontend hiding is still not a boundary; server middleware and RLS are.

## 1a. State after ROLE-1 (current)

| Layer | Vocabulary | Where |
|---|---|---|
| Database | `profiles.role ∈ {student, content_editor, service_admin, super_admin}`, enforced by `profiles_role_vocabulary_check` | `supabase/migrations/20260930140000_capability_role_alignment.sql` |
| Server | The same four roles resolve to capabilities from one module | `src/lib/capabilities.ts`, `lib/authorization.ts`, `middleware.ts` |
| Console | Sections and buttons render from the capability list the server returns | `pages/AdminLayout.tsx`, `src/components/admin/Can.tsx` |

The vocabulary is `resource.action` (`news.publish`, `service_request.process`,
`user.manage_roles`, …). `CAPABILITIES` and `ROLE_CAPABILITIES` in
`src/lib/capabilities.ts` are the definitions; `docs/features/ROLE-1.md` holds the
endpoint → capability and route → capability mappings.

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

### Capability map (as implemented)

The planning names below became the `resource.action` vocabulary in
`src/lib/capabilities.ts`.

| Capability | content_editor | service_admin | super_admin |
|---|---|---|---|
| Planned | Implemented | content_editor | service_admin | super_admin |
|---|---|---|---|---|
| `content.publish` | `news.publish` | ✅ | — | ✅ |
| `content.review` | `news.publish` (approve), `news.update` (reject) | ✅ | — | ✅ |
| `content.catalogue` | `institution.*`, `opportunity.*`, `calendar.*`, `service.*` | ✅ | `service.read` only | ✅ |
| `cbt.manage` | `cbt.manage`, `cbt.read` | ✅ | — | ✅ |
| `service.process` | `service_request.process` | — | ✅ | ✅ |
| `service.read_all` | `service_request.read` | — | ✅ | ✅ |
| `user.manage` | `user.read`, `user.suspend` | — | — | ✅ |
| `user.roles` | `user.manage_roles` | — | — | ✅ |
| `data.import` | `data.import`, `data.write`, `data.read` | `data.read` only | — | ✅ |
| `audit.read` | `audit.read` | — | — | ✅ |
| `platform.health` | staff (any capability) | ✅ | ✅ | ✅ |

Every role also holds the owner-scoped student capabilities, because a staff
member is still a signed-in person who may use the student dashboard. `can()`
refuses those without a matching owner, so they never expose someone else's
data; staff read other people's rows through staff capabilities instead.

## 3. Where enforcement happens

```
Browser request
      ↓
requireStaff / requireCapability      (server — authentication + authorization)
      ↓
can(user, capability, resource?)      (capability + ownership, lib/authorization.ts)
      ↓
service-role database call or RPC     (database — business rules + RLS)
      ↓
admin_audit_log(...)                  (audit trail for privileged mutations)
      ↓
response
```

Ownership is checked in the handler (`can()` against the row's owner) and again
by RLS for anything that goes through the client key. The service-role key is
only used after authorization and is never shipped to the browser.

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

## 4a. Decision (2026-09-30) — implemented as ROLE-1

The capability layer is adopted **now**; the role split is **deferred** (open
decision D1 in `docs/architecture/README.md`). Concretely: every staff endpoint
declares the capabilities it needs, all current staff roles map to the full
capability set, and `senate_admin`/`campus_agent` are retired from the
vocabulary. The capability layer is live: splitting `content_editor` from `service_admin` is
now a change of role assignments, not a change of enforcement. Until step 3
above is done every staff account is still `super_admin`, so the separation
exists in code and not yet in who holds what — **assign the narrower roles
deliberately before onboarding a content-only staff member.**

## 5. Migration path (implemented, one operational step left)

1. ✅ **Capability layer server-side** — `src/lib/capabilities.ts` +
   `lib/authorization.ts` + `requireCapability(...)` on every privileged route.
   Legacy staff roles map to `super_admin`, so existing accounts keep today's
   access until roles are assigned.
2. ✅ **Explicit role value set** — `20260930140000_capability_role_alignment.sql`
   normalises stored values and adds `profiles_role_vocabulary_check`.
3. ⏳ **Assign real roles** — the mechanism exists
   (`POST /api/admin/users/:userId/role`, super-admin only, audited); deciding
   who becomes `content_editor` / `service_admin` is an operational decision.
4. ✅ **Neutralise `senate_admin`/`campus_agent`** — gone from the staff
   predicate, the notification policy and the application vocabulary; existing
   rows migrate to `student` and must be re-assigned deliberately.
5. ✅ **Tests** — `tests/authorization.test.ts` (allow/deny per role, route
   coverage, ownership, migration contents) plus the existing anonymous-access
   matrix in `tests/api.test.ts`.
6. ✅ **Console** — navigation, section access and the publish/delete/suspend/role
   controls render from the capability list the server returns.
