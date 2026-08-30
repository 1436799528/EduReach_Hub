import { supabase } from './supabase';
import type { InstitutionId, MaterialType, StudyMaterial } from '../types';
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

const INSTITUTIONS: InstitutionId[] = ['UNICAL','UNILAG','UI','ABU','UNN','OAU','FUTO','UNIBEN','LASU','DELSU','ALL'];

const toInstitutionId = (value?: string | null): InstitutionId =>
  value && INSTITUTIONS.includes(value as InstitutionId) ? value as InstitutionId : 'UNICAL';

const toMaterialType = (value?: string | null): MaterialType => {
  if (value === 'past_question') return 'past_question';
  if (value === 'lecture_summary') return 'lecture_summary';
  if (value === 'handwritten_note') return 'handwritten_note';
  if (value === 'project_guide') return 'project_guide';
  if (value === 'cbt_pack') return 'cbt_pack';
  return 'formula_sheet';
};

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export async function getMyProfile(userId: string): Promise<SupabaseProfileRow | null> {
  const client = requireClient();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as SupabaseProfileRow | null;
}

export async function updateMyProfile(userId: string, updates: Partial<Pick<SupabaseProfileRow, 'full_name' | 'school' | 'faculty' | 'department' | 'level' | 'session' | 'matric_number' | 'avatar_url'>>) {
  const client = requireClient();
  const { data, error } = await client.from('profiles').update(updates).eq('id', userId).select('*').single();
  if (error) throw error;
  return data as SupabaseProfileRow;
}

export async function getMyCourses(programmeId: string, level: string) {
  const client = requireClient();
  const numericLevel = Number.parseInt(level, 10);
  let query = client.from('courses').select('id,code,title,units,level,semester,programme_id,department_id,is_active').eq('programme_id', programmeId).eq('is_active', true).order('level').order('semester').order('code');
  if (Number.isFinite(numericLevel)) query = query.eq('level', numericLevel);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SchoolCourseRow[];
}

export async function getApprovedResourcesForCourses(courseIds: string[]) {
  if (!courseIds.length) return [] as ResourceRow[];
  const client = requireClient();
  const { data, error } = await client.from('resources').select('id,course_id,title,description,resource_type,file_url,external_url,uploaded_by,status,created_at,original_filename,mime_type,file_size,storage_path').in('course_id', courseIds).eq('status', 'approved').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ResourceRow[];
}

export function mapResourceToStudyMaterial(resource: ResourceRow, course?: SchoolCourseRow): StudyMaterial {
  const institutionId = 'ALL' as InstitutionId;
  const level = course?.level && course.level >= 100 && course.level <= 600 ? `${course.level}L` as StudyMaterial['level'] : 'General';
  return {
    id: resource.id,
    title: resource.title,
    courseCode: course?.code ?? 'RESOURCE',
    courseTitle: course?.title ?? 'Academic Resource',
    institutionId,
    department: '',
    faculty: '',
    level,
    semester: course?.semester === 1 ? '1st Semester' : course?.semester === 2 ? '2nd Semester' : 'All Year',
    materialType: toMaterialType(resource.resource_type),
    academicSession: '',
    unlockPrice: 0,
    uploader: { id: resource.uploaded_by ?? 'unknown', name: 'Verified Contributor', avatar: '', badge: 'Student Contributor', institution: institutionId, rating: 0 },
    isVerified: resource.status === 'approved',
    verificationStatus: 'APPROVED',
    rating: 0,
    reviewCount: 0,
    unlockCount: 0,
    fileSizeKb: resource.file_size ? Math.round(resource.file_size / 1024) : 0,
    pageCount: 0,
    summary: resource.description ?? '',
    coreConcepts: [],
    fullTextContent: '',
    crossCampusEquivalents: [],
    createdAt: resource.created_at,
  };
}

export async function getApprovedPastQuestions(courseIds: string[]) {
  if (!courseIds.length) return [];
  const client = requireClient();
  const { data, error } = await client.from('past_questions').select('id,course_id,title,year,session,semester,exam_type,file_url,status,created_at').in('course_id', courseIds).eq('status', 'approved').order('year', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
