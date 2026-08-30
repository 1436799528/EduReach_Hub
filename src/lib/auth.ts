import type { AuthResponse, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface StudentProfileInput {
  fullName: string;
  school: string;
  faculty: string;
  department: string;
  level: string;
  session?: string;
  institutionId?: string | null;
  facultyId?: string | null;
  departmentId?: string | null;
  sessionId?: string | null;
  programmeId?: string | null;
  matricNumber?: string | null;
}

export const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment.');
  }
  return supabase;
};

export const signInWithPassword = async (email: string, password: string): Promise<AuthResponse> => {
  return requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
};

export const signUpStudent = async (input: StudentProfileInput, email: string, password: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: input.fullName.trim() },
    },
  });

  if (error || !data.user) return { data, error };

  const profile = await client.from('profiles').upsert({
    id: data.user.id,
    full_name: input.fullName.trim(),
    school: input.school.trim(),
    faculty: input.faculty.trim(),
    department: input.department.trim(),
    level: input.level.trim(),
    session: input.session?.trim() || '',
    institution_id: input.institutionId || null,
    faculty_id: input.facultyId || null,
    department_id: input.departmentId || null,
    session_id: input.sessionId || null,
    programme_id: input.programmeId || null,
    matric_number: input.matricNumber?.trim() || null,
    role: 'student',
  }).select().single();

  return { data, error: profile.error, profile: profile.data };
};

export const getCurrentSession = async (): Promise<Session | null> => {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
};

export const getCurrentUser = async (): Promise<User | null> => {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) return null;
  return data.user;
};

export const signOut = async () => {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
};
