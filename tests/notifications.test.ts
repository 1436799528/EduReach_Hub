import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  STATUS_NOTIFICATION_COPY,
  notificationForStatus,
  notifyServiceRequestStatus,
  serviceTitleFor,
} from '../src/server/notifications';

// The workflow statuses the API accepts (20260925214000_service_request_statuses.sql).
const WORKFLOW_STATUSES = [
  'submitted', 'reviewing', 'processing', 'awaiting_information',
  'completed', 'closed', 'rejected', 'cancelled',
];

const request = {
  id: 'req-1',
  user_id: 'user-1',
  status: 'submitted',
  reference_code: 'ER-2026-0001',
  service_catalog: { title: 'NELFUND loan support' },
};

/** Minimal in-memory stand-in for the service-role client. */
function fakeClient(options: { existing?: unknown[]; insertError?: unknown } = {}) {
  const calls = { selects: [] as any[], inserts: [] as any[] };
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          calls.selects.push({ table, columns });
          const result = { data: options.existing ?? [], error: null };
          const builder: any = {
            eq: () => builder,
            contains: () => builder,
            limit: () => Promise.resolve(result),
            then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
          };
          return builder;
        },
        insert(row: any) {
          calls.inserts.push({ table, row });
          return Promise.resolve({ error: options.insertError ?? null });
        },
      };
    },
  };
  return { client, calls };
}

test('every workflow status has student-facing copy', () => {
  for (const status of WORKFLOW_STATUSES) {
    const copy = STATUS_NOTIFICATION_COPY[status];
    assert.ok(copy, `missing copy for ${status}`);
    assert.ok(copy.title.trim().length > 0);
    assert.ok(copy.body.trim().length > 0);
    // Service-desk vocabulary must not leak into student copy. Prose is free to
    // say "reviewed"; the raw status codes and internal field names are not.
    assert.doesNotMatch(copy.title + copy.body, /admin_|admin note|ticket|candidate/i);
    assert.doesNotMatch(copy.title + copy.body, /awaiting_information|_request\b|status:/i);
  }
  assert.deepEqual(Object.keys(STATUS_NOTIFICATION_COPY).sort(), [...WORKFLOW_STATUSES].sort());
});

test('an unknown status or a no-op transition produces no notification', () => {
  assert.equal(notificationForStatus(request, 'archived'), null);
  assert.equal(notificationForStatus(request, ''), null);
  assert.equal(notificationForStatus(request, 'submitted'), null);
});

test('the notification links to the request and carries the transition in metadata', () => {
  const notification = notificationForStatus(request, 'processing');
  assert.ok(notification);
  assert.equal(notification.notification_type, 'service_request');
  assert.equal(notification.href, '/dashboard/services?ref=ER-2026-0001');
  assert.match(notification.body, /NELFUND loan support/);
  assert.match(notification.body, /ER-2026-0001/);
  assert.deepEqual(notification.metadata, {
    request_id: 'req-1',
    reference_code: 'ER-2026-0001',
    from: 'submitted',
    to: 'processing',
  });
});

test('a request without a reference code still links somewhere useful', () => {
  const notification = notificationForStatus({ ...request, reference_code: null }, 'reviewing');
  assert.ok(notification);
  assert.equal(notification.href, '/dashboard/services');
  assert.equal(notification.metadata.reference_code, null);
});

test('the service title survives the embedded join shape, with an honest fallback', () => {
  assert.equal(serviceTitleFor(request), 'NELFUND loan support');
  assert.equal(serviceTitleFor({ ...request, service_catalog: [{ title: 'Result checking' }] }), 'Result checking');
  assert.equal(serviceTitleFor({ ...request, service_catalog: null }), 'Student service request');
});

test('a status change writes exactly one notification for the request owner', async () => {
  const { client, calls } = fakeClient();
  const result = await notifyServiceRequestStatus(client, { request, from: 'submitted', to: 'reviewing' });
  assert.deepEqual(result, { sent: true });
  assert.equal(calls.inserts.length, 1);
  assert.equal(calls.inserts[0].table, 'student_notifications');
  assert.equal(calls.inserts[0].row.user_id, 'user-1');
  assert.equal(calls.inserts[0].row.notification_type, 'service_request');
  assert.equal(calls.inserts[0].row.href, '/dashboard/services?ref=ER-2026-0001');
  // The lookup is owner-scoped and keyed on the request, never on a client input.
  assert.deepEqual(calls.selects[0], {
    table: 'student_notifications',
    columns: 'id',
  });
});

test('the same request and status is never notified twice', async () => {
  const { client, calls } = fakeClient({ existing: [{ id: 'note-1' }] });
  const result = await notifyServiceRequestStatus(client, { request, from: 'submitted', to: 'reviewing' });
  assert.deepEqual(result, { sent: false, reason: 'already notified' });
  assert.equal(calls.inserts.length, 0);
});

test('a failed write is reported and never thrown', async () => {
  const { client } = fakeClient({ insertError: { message: 'relation does not exist' } });
  const result = await notifyServiceRequestStatus(client, { request, from: 'submitted', to: 'reviewing' });
  assert.deepEqual(result, { sent: false, reason: 'insert failed' });
});

test('an exploding client cannot break the status change', async () => {
  const client = { from() { throw new Error('network down'); } };
  const result = await notifyServiceRequestStatus(client, { request, from: 'submitted', to: 'reviewing' });
  assert.deepEqual(result, { sent: false, reason: 'unexpected error' });
});

test('a no-op transition never touches the store', async () => {
  const { client, calls } = fakeClient();
  const result = await notifyServiceRequestStatus(client, { request, from: 'reviewing', to: 'reviewing' });
  assert.deepEqual(result, { sent: false, reason: 'no-op or unknown status' });
  assert.equal(calls.selects.length + calls.inserts.length, 0);
});

// Regression guard for the wiring: the writer must run inside the authorized
// status branch, after the audit entry, and the handler must load the owner and
// reference code it needs. A future refactor that drops any of this fails here.
test('the service-request status handler notifies the owner after the audit write', () => {
  const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /import \{ notifyServiceRequestStatus \} from '\.\/src\/server\/notifications';/);
  assert.match(source, /select\('id,status,admin_note,user_id,reference_code,service_catalog\(title\)'\)/);
  const auditIndex = source.indexOf("p_action: 'status_change', p_entity_type: 'service_request'");
  const notifyIndex = source.indexOf('await notifyServiceRequestStatus(supabase, {');
  assert.ok(auditIndex > 0, 'status change must stay audited');
  assert.ok(notifyIndex > auditIndex, 'the notification is written after the audit entry');
  // The route stays behind the capability that ROLE-1 introduced.
  const routeIndex = source.indexOf("app.patch('/api/admin/service-requests/:requestId'");
  assert.ok(routeIndex > 0);
  const guard = source.slice(routeIndex, routeIndex + 200);
  assert.match(guard, /requireCapability\('service_request\.process'\)/);
});
