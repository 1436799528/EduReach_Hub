import type { UserProfile } from '../types';

export interface SupabaseProfileRow {
  id: string;
  full_name: string;
  email?: string | null;
  school?: string | null;
  faculty?: string | null;
  department?: string | null;
  level?: string | null;
  session?: string | null;
  institution_id?: string | null;
  faculty_id?: string | null;
  department_id?: string | null;
  session_id?: string | null;
  programme_id?: string | null;
  matric_number?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Maps the persisted Supabase profile into the existing UI contract.
 * Keep this boundary isolated so the current components do not need to know
 * about the database column names while authentication is migrated.
 */
export const mapSupabaseProfileToUserProfile = (
  row: SupabaseProfileRow,
  email?: string | null,
): UserProfile => ({
  id: row.id,
  fullName: row.full_name,
  email: email ?? row.email ?? '',
  phone: '',
  school: row.school ?? '',
  faculty: row.faculty ?? '',
  department: row.department ?? '',
  level: row.level ?? '',
  session: row.session ?? '',
  matricNumber: row.matric_number ?? '',
  avatar: row.avatar_url ?? '',
  role: row.role === 'admin' ? 'admin' : row.role === 'moderator' ? 'moderator' : 'student',
  verified: true,
  joinedAt: row.created_at ?? new Date().toISOString(),
  lastActive: row.updated_at ?? new Date().toISOString(),
});
