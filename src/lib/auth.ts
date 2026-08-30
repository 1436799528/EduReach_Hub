import type { AuthResponse, Session, User } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { supabase } from './supabase';
import { mapSupabaseProfileToUserProfile, type SupabaseProfileRow } from './profileMapper';

export interface StudentProfileInput {
  fullName: string;
  school: string;
  faculty: string;
  department: string;
  level: string;
  session?: string;
  institutionId?: string | null;
  matricNumber?: string | null;
}

export const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment.');
  return supabase;
};

export const signInWithPassword = async (email: string, password: string): Promise<AuthResponse> =>
  requireSupabase().auth.signInWithPassword({ email: email.trim(), password });

export const signUpStudent = async (input: StudentProfileInput, email: string, password: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: input.fullName.trim() } },
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

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error || !data) return null;
  return mapSupabaseProfileToUserProfile(data as SupabaseProfileRow, user.email);
};

export const subscribeToAuthChanges = (callback: (session: Session | null) => void) =>
  requireSupabase().auth.onAuthStateChange((_event, session) => callback(session));

export const signOut = async () => {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
};
