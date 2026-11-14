import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PROFILE_INSERT_COLUMNS,
  profileSeed,
  saveStudentProfile,
  type ProfileWriteClient,
  type StudentProfilePayload,
} from '../src/lib/profileSave';

// UI-5: the profile form refused to save. The cause was an upsert against a
// table whose browser INSERT grant is narrower than its UPDATE grant. These
// tests pin the replacement path and the privilege difference that explains it.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const payload: StudentProfilePayload = {
  full_name: 'James Aponi',
  phone: '08012345678',
  school: 'University of Calabar',
  course_programme: 'Electrical Engineering',
  department: 'Electrical/Electronic Engineering',
  faculty: 'Engineering',
  level: '300',
  session: '2025/2026',
  admission_year: 2023,
  expected_graduation_year: 2027,
  academic_interests: ['JAMB UTME Prep'],
  notification_preferences: { email_alerts: true, whatsapp_alerts: true, sms_alerts: false },
  avatar_url: null,
  profile_completed: true,
};

type Calls = {
  updatePayloads: Array<Record<string, unknown>>;
  inserts: Array<Record<string, unknown>>;
  selected: string[];
  upserts: number;
};

function fakeClient(options: {
  updateRow?: { id: string } | null;
  updateError?: unknown;
  insertError?: unknown;
  finalError?: unknown;
}): { client: ProfileWriteClient; calls: Calls } {
  const calls: Calls = { updatePayloads: [], inserts: [], selected: [], upserts: 0 };
  let updateCount = 0;
  const client = {
    from(table: string) {
      assert.equal(table, 'profiles');
      return {
        update(values: Record<string, unknown>) {
          calls.updatePayloads.push(values);
          updateCount += 1;
          const filter = {
            eq(column: string, value: string) {
              assert.equal(column, 'id');
              assert.equal(value, 'user-1');
              return {
                select(columns: string) {
                  calls.selected.push(columns);
                  return {
                    maybeSingle: () => Promise.resolve({ data: options.updateRow ?? null, error: options.updateError ?? null }),
                  };
                },
                then: (resolveThen: (value: { error: unknown }) => unknown) =>
                  Promise.resolve({ error: options.finalError ?? null }).then(resolveThen),
              };
            },
          };
          return filter;
        },
        insert(values: Record<string, unknown>) {
          calls.inserts.push(values);
          return Promise.resolve({ error: options.insertError ?? null });
        },
      };
    },
  };
  return { client: client as unknown as ProfileWriteClient, calls };
}

test('an existing profile is saved with an update, never an upsert', async () => {
  const { client, calls } = fakeClient({ updateRow: { id: 'user-1' } });
  const result = await saveStudentProfile(client, 'user-1', payload);
  assert.deepEqual(result, { ok: true, mode: 'updated' });
  assert.equal(calls.inserts.length, 0, 'the trigger row exists, so nothing is inserted');
  assert.equal(calls.upserts, 0);
  assert.deepEqual(calls.updatePayloads[0], payload, 'every editable field is written');
  assert.deepEqual(calls.selected, ['id'], 'the update asks for the row back instead of assuming success');
});

test('a missing trigger row is created with only the granted insert columns, then updated', async () => {
  const { client, calls } = fakeClient({ updateRow: null });
  const result = await saveStudentProfile(client, 'user-1', payload);
  assert.deepEqual(result, { ok: true, mode: 'created' });
  assert.equal(calls.inserts.length, 1);
  assert.deepEqual(Object.keys(calls.inserts[0]).sort(), [...PROFILE_INSERT_COLUMNS].sort());
  assert.equal('phone' in calls.inserts[0], false, 'phone is not insertable by the browser');
  assert.equal('profile_completed' in calls.inserts[0], false, 'profile_completed is not insertable by the browser');
  assert.equal(calls.updatePayloads.length, 2, 'the second update writes the remaining columns');
  assert.deepEqual(calls.updatePayloads[1], payload);
});

test('a failed update stops before any insert and is reported as the update step', async () => {
  const error = new Error('permission denied for table profiles');
  const { client, calls } = fakeClient({ updateError: error });
  const result = await saveStudentProfile(client, 'user-1', payload);
  assert.deepEqual(result, { ok: false, step: 'update', error });
  assert.equal(calls.inserts.length, 0);
});

test('a failed seed insert is reported as the insert step', async () => {
  const error = new Error('row-level security');
  const { client, calls } = fakeClient({ updateRow: null, insertError: error });
  const result = await saveStudentProfile(client, 'user-1', payload);
  assert.deepEqual(result, { ok: false, step: 'insert', error });
  assert.equal(calls.updatePayloads.length, 1, 'no finalizing update after a failed insert');
});

test('a failed final update is not mistaken for a successful create', async () => {
  const error = new Error('network');
  const { client } = fakeClient({ updateRow: null, finalError: error });
  const result = await saveStudentProfile(client, 'user-1', payload);
  assert.deepEqual(result, { ok: false, step: 'finalize', error });
});

test('the seed never carries a field outside the browser insert grant', () => {
  assert.deepEqual(Object.keys(profileSeed('user-1', payload)).sort(), [...PROFILE_INSERT_COLUMNS].sort());
});

test('the profile page no longer upserts, and the grant difference is real', () => {
  const page = read('pages/ProfileCompletionPage.tsx');
  assert.doesNotMatch(page, /\.upsert\(/, 'the refused write path is gone');
  assert.match(page, /saveStudentProfile\(/, 'the page uses the explicit update-first save');
  assert.match(page, /saveStudentProfile\(supabase as unknown as ProfileWriteClient/, 'and passes the live client');

  const insertGrant = /grant insert \(([^)]*)\) on table public\.profiles to authenticated;/i.exec(
    read('supabase/migrations/20260903_restrict_profile_client_columns.sql'),
  );
  assert.ok(insertGrant, 'the insert grant is recorded');
  const insertColumns = insertGrant[1].split(',').map((value) => value.trim());
  assert.ok(insertColumns.includes('full_name'));
  assert.equal(insertColumns.includes('phone'), false, 'phone has UPDATE but not INSERT privilege');
  assert.equal(insertColumns.includes('profile_completed'), false);

  const completionGrant = /grant update \(([\s\S]*?)\) on table public\.profiles to authenticated;/i.exec(
    read('supabase/migrations/20260920_auth_and_profile_completion.sql'),
  );
  assert.ok(completionGrant, 'the update grant is recorded');
  const updateColumns = completionGrant[1].split(',').map((value) => value.trim());
  assert.ok(updateColumns.includes('phone'));
  assert.ok(updateColumns.includes('profile_completed'));
  assert.ok(updateColumns.length > insertColumns.length, 'INSERT is deliberately narrower than UPDATE');
});
