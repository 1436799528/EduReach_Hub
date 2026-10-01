# Feature: NTF-1 — Service status notifications

Status: **implemented** (see Evidence). Written before the code, per
`docs/architecture/08-FEATURE-TEMPLATE.md`.

## Purpose

Close the tracking loop. Today a student submits a service request, sees
"submitted", and then hears nothing until they open the dashboard and notice a
status change — or does not notice at all. `student_notifications` exists, is
indexed, is RLS-protected and has client helpers (`fetchNotifications`,
`markNotificationsRead`, `createNotification` in `src/lib/studentDashboard.ts`),
but **nothing writes to it and nothing renders it**: the store is write-only and
the journey ends silently.

NTF-1 makes the store real for the highest-value event: a service request
changing status.

## User

A signed-in student with at least one service request (NELFUND loan, result
checking, JAMB slip, admission letters). Secondary: the student-services officer
whose status change is the trigger — they gain nothing to click, but their
action becomes visible to the student.

## User Flow

1. A student submits a service request from `/services/:slug` (unchanged).
2. A service officer moves the request through the workflow in `/admin/queue`
   (`submitted → reviewing → processing → awaiting_information → completed →
   closed`, with `rejected` / `cancelled` as terminal states).
3. On a status change the server writes one notification for the request's owner:
   title, body, `notification_type = 'service_request'`, `href =
   /dashboard/services?ref=<reference_code>`, and `metadata` carrying the request
   id, the reference code, the previous and the new status.
4. The student opens `/dashboard`, sees the notification card, and can follow the
   deep link straight to the request (same `?ref=` focus the dashboard already
   supports) or mark all notifications as read.
5. A second status change produces a second notification; the same status cannot
   notify twice for the same request.

## Screens

- **Student dashboard → Overview** (`pages/StudentDashboardV2.tsx`) gains a
  "Notifications" card above "Latest requests", in the existing `dash-card`
  style: the latest notifications, unread first-class (a filled dot and heavier
  title), a "Mark all as read" action, and the existing empty-state pattern when
  there is nothing. Deep links open the request tab with `?ref=`.
- **Admin queue** (`pages/AdminQueuePage.tsx`) is unchanged — the notification is
  a consequence of the status change, not another button.

No new route, no new design token, no fifth dashboard tab (the IA maps
`/dashboard/notifications` to the Overview).

## Routes

| Route | Method | Change |
|---|---|---|
| `/api/admin/service-requests/:requestId` | PATCH | unchanged contract; after a successful status change it now also writes the student notification |
| `/dashboard` | GET (SPA) | unchanged route; renders the new card |

No public route and no API surface is added, so nothing new is exposed.

## Components

- `src/server/notifications.ts` (new) — status → copy map, `notificationForStatus()`,
  `notifyServiceRequestStatus()`. Server-only; the copy lives in TypeScript so it
  is type-checked, reviewed and testable without a database.
- `pages/StudentDashboardV2.tsx` — the notification card, reusing existing
  markup classes and the existing `src/lib/studentDashboard.ts` helpers.

## User Actions

| Action | Effect |
|---|---|
| Officer changes a request status | One notification is written for the owner |
| Officer edits only the internal note | No notification (nothing the student can act on) |
| Officer re-selects the current status | No update, no notification (the API only notifies on a real transition) |
| Student opens the notification link | Dashboard opens the request tab focused on `?ref=` |
| Student clicks "Mark all as read" | `read_at` is set for the student's unread rows (existing helper) |
| Student without notifications | Honest empty state pointing at `/services` |

## Button Logic

- "Mark all as read" is enabled only when at least one notification is unread; on
  success the list re-renders from the returned state, on failure the error is
  shown and the state is left untouched.
- Notification links are plain anchors to the dashboard route (no client state
  required), so a notification still works after a cold load.

## Data

Read: `service_requests` (`id`, `user_id`, `status`, `reference_code`,
`service_catalog(title)`), `student_notifications` (owner-scoped, existing
policies). Written: one `student_notifications` row per real status transition,
with `metadata = { request_id, reference_code, from, to }`.

No schema change: `student_notifications` already has every column needed and an
index on `(user_id, read_at, created_at desc)`.

## Data Source

Supabase is authoritative. The write happens after the status update inside the
same authorized request, using the existing service-role client (the API is the
only supported way to change a request status — it is where the transition table
lives), so a notification can never describe a transition that did not happen.
The student reads it through RLS with their own session.

## Backend

- `src/server/notifications.ts`:
  - `STATUS_NOTIFICATION_COPY` — one entry per status in the workflow, written
    for students (no internal vocabulary, no officer names, no internal notes);
  - `notificationForStatus(request, nextStatus)` — pure builder returning
    `{ title, body, type, href, metadata }`;
  - `notifyServiceRequestStatus(supabase, { request, from, to })` — idempotent
    (skips when a notification for the same request + status already exists),
    best-effort (logs and returns `{ sent: false }` instead of throwing).
- `server.ts` — `PATCH /api/admin/service-requests/:requestId` loads
  `user_id, reference_code, service_catalog(title)` alongside the fields it
  already reads, and calls the module after the update and the audit write.
- Deliberately **not** a database trigger: the copy would live in SQL, would be
  untestable in this repository, and would duplicate the transition rules that
  the API already owns. If requests are ever edited outside the API, the status
  change is already unsupported.

## Security

- The notification is written with the service-role key **after** the officer
  passed `service_request.process`; a caller without that capability never
  reaches the code path (`tests/authorization.test.ts` pins this).
- The student can only read their own rows (existing RLS owner policies), and the
  insert sets `user_id` from the request row — never from client input.
- Notification content is deliberately limited to workflow state: no internal
  notes (`admin_note` is officer-only and stays out), no student personal data
  beyond what the student already sees in their own request.
- Copy is fixed text: no user-supplied strings are interpolated into the body
  except the service title and reference code, which come from the database and
  are rendered by React (escaped).

## States

- **Loading** — dashboard card shows the standard skeleton while notifications load.
- **Empty** — "No notifications yet. Status changes on your service requests appear here."
- **Unread** — dot + emphasised title; the count is not badged in the nav to avoid
  a layout change (the Overview card is the surface).
- **Error** — the card shows a retry affordance; a failed notification write never
  fails the officer's status change.
- **Offline** — the dashboard falls back to its existing behaviour (cached requests;
  notifications simply do not load, with the retry affordance).

## Edge Cases

| Case | Behaviour |
|---|---|
| Same status twice | No DB update is issued (the endpoint only updates on a change), and the notification builder also refuses a no-op transition |
| Status history repeats a value (e.g. `awaiting_information → reviewing → awaiting_information`) | One notification per occurrence is allowed; the idempotency guard keys on the notification already existing for that request + status *pair*, so a repeat of the same transition later still notifies once more |
| `student_notifications` missing (unmigrated project) | Insert fails, is logged, and the status change still succeeds |
| Notification insert slow or failing | Same — best effort, never blocks the officer |
| Request has no `reference_code` | The `href` falls back to `/dashboard/services` |
| Request row unreadable after update | No notification is attempted |
| Student deleted | `user_id` references `profiles(id)` with `on delete cascade`; the insert fails harmlessly |
| Long service title | The list clamps with CSS line clamping (existing card styles) |

## Analytics

N/A — no new event. The status change is already audited in `admin_audit_logs`
(`status_change`), which is the operator-facing record; notification reads are not
product analytics and are not written to `site_analytics_events`.

## Notifications

This **is** the notification feature: one in-app notification per real status
transition, plus the dashboard surface that renders it. Email/WhatsApp delivery is
out of scope (no channel is configured for transactional messages); the existing
WhatsApp continuation link on the request remains as it is. Deadline reminders are
deliberately deferred — there is no per-student tracking or preference model for
calendar items yet (`student_saved_items.item_type` does not include deadlines or
exams), and broadcasting every deadline to every student would be noise rather
than a notification. That half belongs with SA-3 (saved-item alignment) or a
preferences feature, and is recorded in the catalogue.

## Testing

`tests/notifications.test.ts`:

- copy exists for every status in the workflow, and every entry has a title, a
  body and student-facing language (no status codes, no `admin_`, no note text);
- `notificationForStatus()` produces the documented `href` (with and without a
  reference code) and `metadata`;
- the same request + status is not notified twice (existing row ⇒ `sent: false`);
- an insert failure is swallowed and reported, never thrown;
- the no-op case (from === to) writes nothing;
- through the real server with the Supabase contract stub: a `service_admin`
  status change inserts exactly one row for the request's owner with
  `notification_type = 'service_request'` and the right metadata; a note-only
  PATCH writes none; a `content_editor` gets 403 and writes none.

## Evidence (as built)

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | clean |
| Tests | `npm test` | 216/216 (11 new in `tests/notifications.test.ts`) |
| Build | `npm run build` | client bundle includes the dashboard card (`Mark all as read`), plus `build/server.cjs` |
| Prod smoke (port 3115 + stubbed Supabase on 3221) | `PATCH /api/admin/service-requests/:id` | `student` and `content_editor` → 403 with no write; `service_admin` `submitted → reviewing` → 200, audit `status_change` then exactly one `student_notifications` insert (`user_id=user-1`, `notification_type=service_request`, `href=/dashboard/services?ref=ER-2026-0001`, metadata `{request_id, reference_code, from, to}`); note-only PATCH → 200, no insert; illegal `reviewing → submitted` → 409, no insert; a repeat transition whose status was already notified → 200 status change, **no** second insert |
