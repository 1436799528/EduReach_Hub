import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notifyCbtResultReady } from '../src/server/notifications';

test('notifyCbtResultReady creates a notification with cbt_result type and deep link', async () => {
  const inserted: any[] = [];
  const mockSupabase = {
    from(table: string) {
      assert.equal(table, 'student_notifications');
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    contains() {
                      return {
                        limit() {
                          return Promise.resolve({ data: [], error: null });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
        insert(row: any) {
          inserted.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const result = await notifyCbtResultReady(mockSupabase as any, {
    id: 'attempt-uuid-1',
    user_id: 'user-uuid-1',
    exam_title: 'JAMB UTME Mock Exam',
    score: 280,
  });

  assert.equal(result.sent, true);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].user_id, 'user-uuid-1');
  assert.equal(inserted[0].notification_type, 'cbt_result');
  assert.equal(inserted[0].title, 'Your CBT result is ready');
  assert.match(inserted[0].body, /JAMB UTME Mock Exam/);
  assert.equal(inserted[0].href, '/cbt/results?attemptId=attempt-uuid-1');
  assert.deepEqual(inserted[0].metadata, { attempt_id: 'attempt-uuid-1' });
});

test('notifyCbtResultReady is idempotent and does not insert duplicate notifications', async () => {
  const inserted: any[] = [];
  const mockSupabase = {
    from(_table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    contains() {
                      return {
                        limit() {
                          // Already exists
                          return Promise.resolve({ data: [{ id: 'notif-1' }], error: null });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
        insert(row: any) {
          inserted.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const result = await notifyCbtResultReady(mockSupabase as any, {
    id: 'attempt-uuid-1',
    user_id: 'user-uuid-1',
    exam_title: 'JAMB UTME Mock Exam',
  });

  assert.equal(result.sent, false);
  assert.equal(result.reason, 'already notified');
  assert.equal(inserted.length, 0);
});

test('notifyCbtResultReady fails safely if attempt id or user id is missing', async () => {
  const mockSupabase = {
    from() {
      throw new Error('Should not be called');
    },
  };

  const result1 = await notifyCbtResultReady(mockSupabase as any, {
    id: '',
    user_id: 'user-1',
  });
  assert.equal(result1.sent, false);

  const result2 = await notifyCbtResultReady(mockSupabase as any, {
    id: 'attempt-1',
    user_id: '',
  });
  assert.equal(result2.sent, false);
});
