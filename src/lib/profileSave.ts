/**
 * UI-5 — the profile save path.
 *
 * The profile form used to call `supabase.from('profiles').upsert(...)`. The
 * save failed for a database-privilege reason, not a visual one:
 *
 *   `20260903_restrict_profile_client_columns.sql` limits what `authenticated`
 *   may INSERT, while later migrations grant UPDATE on the full student-editable
 *   set. PostgreSQL requires INSERT privilege on every column named by an
 *   `INSERT ... ON CONFLICT DO UPDATE`, so the upsert was refused even when the
 *   row already existed. Every profile row is created by `handle_new_user()`,
 *   so the normal path is an UPDATE.
 *
 * This module makes that path explicit: update first, and only if no row is
 * returned (a legacy account whose trigger row is missing) create the row using
 * the columns the browser is actually granted, then finish with an update. It
 * never calls upsert, and it never reports success without the server's answer.
 */

export type StudentProfilePayload = {
  full_name: string;
  phone: string | null;
  school: string;
  course_programme: string;
  department: string;
  faculty: string;
  level: string;
  session: string;
  admission_year: number | null;
  expected_graduation_year: number | null;
  academic_interests: string[];
  notification_preferences: {
    email_alerts: boolean;
    whatsapp_alerts: boolean;
    sms_alerts: boolean;
  };
  avatar_url: string | null;
  profile_completed: boolean;
};

/**
 * The columns `authenticated` may INSERT (see
 * `20260903_restrict_profile_client_columns.sql`). Anything outside this list
 * must be written by the follow-up UPDATE.
 */
export const PROFILE_INSERT_COLUMNS = [
  'id',
  'full_name',
  'school',
  'faculty',
  'department',
  'level',
  'session',
] as const;

export type InsertableProfileRow = {
  id: string;
  full_name: string;
  school: string;
  faculty: string;
  department: string;
  level: string;
  session: string;
};

export type ProfileSaveStep = 'update' | 'insert' | 'finalize';

export type ProfileSaveResult =
  | { ok: true; mode: 'updated' | 'created' }
  | { ok: false; step: ProfileSaveStep; error: unknown };

type MaybeSingleResult = PromiseLike<{ data: { id?: string } | null; error: unknown }>;
type UpdateFilter = PromiseLike<{ error: unknown }> & {
  select(columns: string): { maybeSingle(): MaybeSingleResult };
};
type UpdateBuilder = {
  eq(column: 'id', value: string): UpdateFilter;
};

/**
 * Minimal surface of the Supabase client this function needs. Keeping it
 * structural makes the save path testable without a live project.
 */
export type ProfileWriteClient = {
  from(table: 'profiles'): {
    update(values: Partial<StudentProfilePayload>): UpdateBuilder;
    insert(values: InsertableProfileRow): PromiseLike<{ error: unknown }>;
  };
};

export function profileSeed(userId: string, payload: StudentProfilePayload): InsertableProfileRow {
  return {
    id: userId,
    full_name: payload.full_name || 'Student',
    school: payload.school || '',
    faculty: payload.faculty || '',
    department: payload.department || '',
    level: payload.level || '',
    session: payload.session || '',
  };
}

export async function saveStudentProfile(
  client: ProfileWriteClient,
  userId: string,
  payload: StudentProfilePayload,
): Promise<ProfileSaveResult> {
  const updated = await client
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (updated.error) return { ok: false, step: 'update', error: updated.error };
  if (updated.data) return { ok: true, mode: 'updated' };

  // No profile row for this account. Create the minimum permitted row, then
  // write the remaining columns with an UPDATE (the browser holds that grant).
  const inserted = await client.from('profiles').insert(profileSeed(userId, payload));
  if (inserted.error) return { ok: false, step: 'insert', error: inserted.error };

  const finalized = await client
    .from('profiles')
    .update(payload)
    .eq('id', userId);

  if (finalized.error) return { ok: false, step: 'finalize', error: finalized.error };
  return { ok: true, mode: 'created' };
}
