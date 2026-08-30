import { supabase } from './supabase';
import type { SupabaseProfileRow } from './profileMapper';

export interface SchoolCourseRow {
  id: string;
  code: string;
  title: string;
  units: number;
  level: number;
  semester: number;
  programme_id: string | null;
  department_id: string | null;
  is_active: boolean;
}

export interface ResourceRow {
  id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  resource_type: string;
  file_url: string | null;
  external_url: string | null;
  uploaded_by: string | null;
  status: string;
  created_at: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string | null;
}

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export async function getMyProfile(userId: string): Promise<SupabaseProfileRow | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as SupabaseProfileRow | null;
}

export async function updateMyProfile(
  userId: string,
  updates: Partial<Pick<SupabaseProfileRow, 'full_name' | 'school' | 'faculty' | 'department' | 'level' | 'session' | 'matric_number' | 'avatar_url'>>,
) {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as SupabaseProfileRow;
}

export async function getMyCourses(programmeId: string, level: string) {
  const client = requireClient();
  const numericLevel = Number.parseInt(level, 10);
  let query = client
    .from('courses')
    .select('id,code,title,units,level,semester,programme_id,department_id,is_active')
    .eq('programme_id', programmeId)
    .eq('is_active', true)
    .order('level', { ascending: true })
    .order('semester', { ascending: true })
    .order('code', { ascending: true });

  if (Number.isFinite(numericLevel)) query = query.eq('level', numericLevel);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SchoolCourseRow[];
}

export async function getApprovedResourcesForCourses(courseIds: string[]) {
  if (!courseIds.length) return [] as ResourceRow[];
  const client = requireClient();
  const { data, error } = await client
    .from('resources')
    .select('id,course_id,title,description,resource_type,file_url,external_url,uploaded_by,status,created_at,original_filename,mime_type,file_size,storage_path')
    .in('course_id', courseIds)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ResourceRow[];
}

export async function getApprovedPastQuestions(courseIds: string[]) {
  if (!courseIds.length) return [];
  const client = requireClient();
  const { data, error } = await client
    .from('past_questions')
    .select('id,course_id,title,year,session,semester,exam_type,file_url,status,created_at')
    .in('course_id', courseIds)
    .eq('status', 'approved')
    .order('year', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
