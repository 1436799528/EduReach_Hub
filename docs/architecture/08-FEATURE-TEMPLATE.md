# 08 — Feature Template (required structure)

Copy this into a feature document (or a `docs/features/<id>.md` file) and fill
every section **before** writing implementation code. A section that does not
apply is marked `N/A — <reason>`, never deleted. The worked example below is a
real candidate from the catalogue (NTF-1) and shows the expected depth.

---

# Feature: <ID> — <Name>

## Purpose
Why it exists. What breaks in the product if it does not exist.

## User
Which role(s) use it, and which role(s) must not.

## User Flow
Numbered end-to-end steps, including the entry point and the exit.

## Screens
Every screen involved, with its route.

## Routes
Public/private, required role, required data, behaviour for invalid identifiers,
authentication redirect, deep-link behaviour, back behaviour.

## Components
Existing components reused, and any new shared component created (with the
justification that it appears in at least two places).

## User Actions
Every action the user can take, and what each one does.

## Button Logic
For each important button: validation → request → backend processing → response →
success → failure → loading → navigation.

## Data
Fields read and written, and their types.

## Data Source
Table, API or local state, and which one is authoritative.

## Backend
Endpoints, RPCs, business rules and jobs.

## Security
Authentication, authorization, ownership, privacy and rate limiting.

## States
Loading, success, empty, error, offline.

## Edge Cases
Unexpected conditions and the required behaviour for each.

## Analytics
Events emitted, with payload contracts (no personal data).

## Notifications
Trigger, type, recipient, destination, read state, expiry.

## Testing
Unit, API, security and E2E cases that must exist.

---

## Worked example — NTF-1: Service status notifications

### Purpose
A student submits a request and then has no reason to return to EduReach: the
tracking page is passive and nothing tells them anything changed. Every service
status change should produce a notification, so the student learns about it
without checking.

### User
Recipient: the requesting student (`student`). Producer: `service_admin` /
`super_admin` (implicitly, by changing a status). A content editor must not be
able to trigger or read these.

### User Flow
1. Staff opens `/admin/queue` and changes a request from `submitted` to
   `processing`, optionally with a note.
2. Server validates the transition, writes the new status, writes an audit entry.
3. Server inserts one notification for the request owner with title, body,
   `notification_type = 'service_status'` and `href = /dashboard/services`.
4. Student opens `/dashboard`; the unread badge and the notification list show it.
5. Student taps it → request detail; tapping marks it read (`read_at`).
6. WhatsApp message is sent if the student has a phone on file and the channel is
   configured — a notification layer, never the record.

### Screens
`/admin/queue` (existing), `/dashboard` overview + notifications (existing).

### Routes
- `PATCH /api/admin/service-requests/:requestId` — private, `service.process`,
  invalid id → 404, missing role → 403.
- `/dashboard` — private, owner only.

### Components
Reuse: `RequestActions` (admin), `StatusBadge`, `TimeAgo`, dashboard notification
list. New: none — if the dashboard list needs a card variant, the variant goes
into the existing dashboard component, not a page-local class.

### User Actions
Change status (staff); open notification; mark read; open request (student).

### Button Logic — "Update status"
- **Click**: validate the transition against the allowed map.
- **Validation**: request exists, belongs to a real service, status change legal
  (`submitted→reviewing|processing|awaiting_information|rejected|cancelled`,
  `awaiting_information→processing|rejected|cancelled`, terminal states cannot
  reopen).
- **Loading**: button disabled while in flight; no duplicate submissions.
- **Success**: optimistic row update, then a toast/banner confirming the new
  status; the notification is created server-side in the same request.
- **Failure**: revert the optimistic state, show `userFacingError`, keep the note
  text so it can be retried.
- **Offline**: the action is refused with "this needs a connection".

### Data
Read: `service_requests(id, user_id, status, reference_code, form_data)`,
`service_catalog.title`. Write: `service_requests.status`, `admin_audit_logs`,
`student_notifications(title, body, notification_type, href, metadata)`.

### Data Source
`service_requests` is authoritative for status; `student_notifications` is
derived and safe to rebuild from the audit log.

### Backend
Existing `PATCH /api/admin/service-requests/:requestId`; notification insert added
server-side (never from the browser, because notification creation is
staff-restricted by RLS).

### Security
Status change requires `service.process` (or super admin); the notification is
created for `request.user_id` only; the student can read only their own rows;
the notification body must not contain internal notes or other students' data.

### States
- Loading: skeleton rows in the queue.
- Success: new badge + notification.
- Empty: "no requests waiting" (queue), "no notifications yet" (dashboard).
- Error: banner with retry; the status change is not applied.
- Offline: staff action refused; student view shows cached content.

### Edge Cases
Status changed twice in quick succession (two notifications, both truthful);
request cancelled after completion (no reopen); student has no unread capacity
(no cap needed, but the dashboard shows the latest 20); notification for a
deleted request (notification still readable, links to a 404 that explains
itself); WhatsApp configured but student has no phone (skip silently, log once).

### Analytics
`service_status_changed` (staff side, no personal data), `notification_opened`
(recipient side). Both added to the allowlist and to AN-1's payload contract.

### Notifications
Trigger: status transition. Type: `service_status`. Recipient: request owner.
Destination: `/dashboard/services`. Expiry: 90 days after creation (needs a
column — part of this feature). No spam: one notification per transition.

### Testing
- API: transition matrix accepted/rejected; notification row created exactly once;
  content editor receives 403; unauthenticated receives 401; invalid id 404.
- Security: student cannot read another student's notifications (RLS test).
- Unit: transition map; notification body composition (no internal notes).
- E2E (when the browser runner is available): change status → sign in as student →
  notification visible → open → marked read.
- Data: integrity report unaffected; audit row present for the change.
