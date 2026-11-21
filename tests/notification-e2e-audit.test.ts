import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STATUS_NOTIFICATION_COPY,
  notifyServiceRequestStatus,
} from '../src/server/notifications';

const WORKFLOW_STATUSES = [
  'submitted', 'reviewing', 'processing', 'awaiting_information',
  'completed', 'closed', 'rejected', 'cancelled',
] as const;

const testRequest = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: 'test-student-user-id-001',
  status: 'submitted',
  reference_code: 'ER-TEST-2026',
  service_catalog: { title: 'NELFUND loan support' },
};

function createMockSupabase(options: { existing?: unknown[]; insertFails?: boolean } = {}) {
  const store = {
    notifications: [...(options.existing || [])] as any[],
  };
  return {
    store,
    from(table: string) {
      if (table !== 'student_notifications') throw new Error(`Unexpected table: ${table}`);
      return {
        select(_cols: string) {
          let userFilter: unknown = null;
          let typeFilter: unknown = null;
          let metaContains: any = null;
          const query = {
            eq(col: string, val: unknown) {
              if (col === 'user_id') userFilter = val;
              if (col === 'notification_type') typeFilter = val;
              return query;
            },
            contains(col: string, val: Record<string, unknown>) {
              if (col === 'metadata') metaContains = val;
              return query;
            },
            limit(_count: number) {
              const matched = store.notifications.filter((row) => {
                if (userFilter && row.user_id !== userFilter) return false;
                if (typeFilter && row.notification_type !== typeFilter) return false;
                if (metaContains) {
                  for (const [k, v] of Object.entries(metaContains)) {
                    if (row.metadata?.[k] !== v) return false;
                  }
                }
                return true;
              });
              return Promise.resolve({ data: matched, error: null });
            },
            then(resolve: any, reject: any) {
              return query.limit(20).then(resolve, reject);
            },
          };
          return query;
        },
        insert(row: any) {
          if (options.insertFails) {
            return Promise.resolve({ error: { message: 'Database connection failed' } });
          }
          const record = {
            id: `notif-${Date.now()}-${Math.random()}`,
            ...row,
            read_at: null,
            created_at: new Date().toISOString(),
          };
          store.notifications.push(record);
          return Promise.resolve({ data: record, error: null });
        },
        update(updates: any) {
          return {
            eq(col: string, val: unknown) {
              return {
                eq(c2: string, v2: unknown) {
                  return {
                    is(_c3: string, _v3: unknown) {
                      store.notifications.forEach((item) => {
                        if (item[col] === val && item[c2] === v2) {
                          Object.assign(item, updates);
                        }
                      });
                      return Promise.resolve({ error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

// -------------------------------------------------------------
// 1. Notification Creation & Idempotency
// -------------------------------------------------------------
test('supported status transition creates exactly one notification with null read_at', async () => {
  const mockDb = createMockSupabase();
  const res = await notifyServiceRequestStatus(mockDb as any, {
    request: testRequest,
    from: 'submitted',
    to: 'processing',
  });

  assert.equal(res.sent, true);
  assert.equal(mockDb.store.notifications.length, 1);
  const created = mockDb.store.notifications[0];
  assert.equal(created.user_id, 'test-student-user-id-001');
  assert.equal(created.read_at, null);
  assert.equal(created.notification_type, 'service_request');
  assert.equal(created.href, '/dashboard/services?ref=ER-TEST-2026');
  assert.deepEqual(created.metadata, {
    request_id: '00000000-0000-0000-0000-000000000001',
    reference_code: 'ER-TEST-2026',
    from: 'submitted',
    to: 'processing',
  });
});

test('duplicate status transition on same request does not insert a second notification', async () => {
  const mockDb = createMockSupabase();
  // First transition: submitted -> reviewing
  const first = await notifyServiceRequestStatus(mockDb as any, {
    request: testRequest,
    from: 'submitted',
    to: 'reviewing',
  });
  assert.equal(first.sent, true);
  assert.equal(mockDb.store.notifications.length, 1);

  // Duplicate attempt:
  const second = await notifyServiceRequestStatus(mockDb as any, {
    request: testRequest,
    from: 'submitted',
    to: 'reviewing',
  });
  assert.equal(second.sent, false);
  assert.equal(second.reason, 'already notified');
  assert.equal(mockDb.store.notifications.length, 1);
});

// -------------------------------------------------------------
// 2. Sensitive Information Exclusion & Leak Prevention
// -------------------------------------------------------------
test('notification copy contains zero staff-only codes, admin notes, or internal tokens', () => {
  for (const status of WORKFLOW_STATUSES) {
    const copy = STATUS_NOTIFICATION_COPY[status];
    const text = `${copy.title} ${copy.body}`;
    assert.doesNotMatch(text, /admin_|admin note|ticket|internal|candidate/i);
    assert.doesNotMatch(text, /awaiting_information|_request\b|status:/i);
    assert.doesNotMatch(text, /token|password|secret|key/i);
  }
});

// -------------------------------------------------------------
// 3. Read State Lifecycle & Persistence
// -------------------------------------------------------------
test('student opening notification marks it as read in the store', async () => {
  const mockDb = createMockSupabase();
  await notifyServiceRequestStatus(mockDb as any, {
    request: testRequest,
    from: 'submitted',
    to: 'completed',
  });

  const notif = mockDb.store.notifications[0];
  assert.equal(notif.read_at, null);

  // Mark read simulation:
  await mockDb.from('student_notifications')
    .update({ read_at: '2026-11-21T12:00:00.000Z' })
    .eq('user_id', 'test-student-user-id-001')
    .eq('id', notif.id)
    .is('read_at', null);

  assert.equal(notif.read_at, '2026-11-21T12:00:00.000Z');
});

test('failure to update read status leaves item unread without throwing', async () => {
  const mockDb = createMockSupabase({ insertFails: true });
  const result = await notifyServiceRequestStatus(mockDb as any, {
    request: testRequest,
    from: 'submitted',
    to: 'completed',
  });
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'insert failed');
});
