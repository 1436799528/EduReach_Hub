import { supabase } from './supabase';
import type { InstitutionId, MaterialType, StudyMaterial, FeedPost, PostComment } from '../types';
import type { SupabaseProfileRow } from './profileMapper';

export interface SchoolCourseRow { id: string; code: string; title: string; units: number; level: number; semester: number | null; programme_id: string | null; department_id: string; is_active: boolean; }
export interface ResourceRow { id: string; course_id: string | null; title: string; description: string | null; resource_type: string; file_url: string | null; external_url: string | null; uploaded_by: string | null; status: string; created_at: string; original_filename: string | null; mime_type: string | null; file_size: number | null; storage_path: string | null; }
export interface PastQuestionRow { id: string; course_id: string; title: string; year: number; session: string | null; semester: number | null; exam_type: string | null; file_url: string | null; status: string; created_at: string; }

const INSTITUTIONS: InstitutionId[] = ['UNICAL','UNILAG','UI','ABU','UNN','OAU','FUTO','UNIBEN','LASU','DELSU','ALL'];
const toInstitutionId = (value?: string | null): InstitutionId => value && INSTITUTIONS.includes(value as InstitutionId) ? value as InstitutionId : 'UNICAL';
const toMaterialType = (value?: string | null): MaterialType => value === 'past_question' ? 'past_question' : value === 'lecture_note' ? 'lecture_summary' : value === 'course_outline' ? 'project_guide' : value === 'textbook' ? 'handwritten_note' : 'formula_sheet';
const requireClient = () => { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; };

export async function getMyProfile(userId: string): Promise<SupabaseProfileRow | null> { const { data, error } = await requireClient().from('profiles').select('*, institutions(acronym)').eq('id', userId).maybeSingle(); if (error) throw error; return data as SupabaseProfileRow | null; }
export async function updateMyProfile(userId: string, updates: Partial<Pick<SupabaseProfileRow, 'full_name' | 'school' | 'faculty' | 'department' | 'level' | 'session' | 'matric_number' | 'avatar_url'>>) { const { data, error } = await requireClient().from('profiles').update(updates).eq('id', userId).select('*, institutions(acronym)').single(); if (error) throw error; return data as SupabaseProfileRow; }

export async function getMyCourses(programmeId: string, level: string) { let query = requireClient().from('courses').select('id,code,title,units,level,semester,programme_id,department_id,is_active').eq('programme_id', programmeId).eq('is_active', true).order('level').order('semester').order('code'); const numericLevel = Number.parseInt(level, 10); if (Number.isFinite(numericLevel)) query = query.eq('level', numericLevel); const { data, error } = await query; if (error) throw error; return (data ?? []) as SchoolCourseRow[]; }
export async function getApprovedResourcesForCourses(courseIds: string[]) { if (!courseIds.length) return [] as ResourceRow[]; const { data, error } = await requireClient().from('resources').select('id,course_id,title,description,resource_type,file_url,external_url,uploaded_by,status,created_at,original_filename,mime_type,file_size,storage_path').in('course_id', courseIds).eq('status', 'approved').order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as ResourceRow[]; }
export async function getApprovedPastQuestions(courseIds: string[]) { if (!courseIds.length) return [] as PastQuestionRow[]; const { data, error } = await requireClient().from('past_questions').select('id,course_id,title,year,session,semester,exam_type,file_url,status,created_at').in('course_id', courseIds).eq('status', 'approved').order('year', { ascending: false }); if (error) throw error; return (data ?? []) as PastQuestionRow[]; }

export function mapResourceToStudyMaterial(resource: ResourceRow, course?: SchoolCourseRow, institutionId: InstitutionId = 'ALL'): StudyMaterial { const level = course?.level && course.level >= 100 && course.level <= 500 ? `${course.level}L` as StudyMaterial['level'] : 'General'; return { id: resource.id, title: resource.title, courseCode: course?.code ?? 'RESOURCE', courseTitle: course?.title ?? 'Academic Resource', institutionId, department: '', faculty: '', level, semester: course?.semester === 1 ? '1st Semester' : course?.semester === 2 ? '2nd Semester' : 'All Year', materialType: toMaterialType(resource.resource_type), academicSession: '', unlockPrice: 0, uploader: { id: resource.uploaded_by ?? 'unknown', name: 'Verified Contributor', avatar: '', badge: 'Student Contributor', institution: institutionId, rating: 0 }, isVerified: resource.status === 'approved', verificationStatus: 'APPROVED', rating: 0, reviewCount: 0, unlockCount: 0, fileSizeKb: resource.file_size ? Math.round(resource.file_size / 1024) : 0, pageCount: 0, summary: resource.description ?? '', coreConcepts: [], fullTextContent: '', crossCampusEquivalents: [], createdAt: resource.created_at }; }

export function mapPastQuestionToStudyMaterial(question: PastQuestionRow, course?: SchoolCourseRow, institutionId: InstitutionId = 'ALL'): StudyMaterial { const level = course?.level && course.level >= 100 && course.level <= 500 ? `${course.level}L` as StudyMaterial['level'] : 'General'; const semester = question.semester ?? course?.semester ?? null; const session = question.session || `${question.year}`; const examType = question.exam_type ? ` • ${question.exam_type}` : ''; return { id: question.id, title: question.title, courseCode: course?.code ?? 'PAST QUESTION', courseTitle: course?.title ?? 'Past Questions', institutionId, department: '', faculty: '', level, semester: semester === 1 ? '1st Semester' : semester === 2 ? '2nd Semester' : 'All Year', materialType: 'past_question', academicSession: session, unlockPrice: 0, uploader: { id: 'edureach-academic-archive', name: 'EduReach Academic Archive', avatar: '', badge: 'Verified Academic Archive', institution: institutionId, rating: 0 }, isVerified: question.status === 'approved', verificationStatus: 'APPROVED', rating: 0, reviewCount: 0, unlockCount: 0, fileSizeKb: 0, pageCount: 0, summary: `Approved ${question.year} ${question.title}${examType}.`, coreConcepts: [], fullTextContent: '', crossCampusEquivalents: [], createdAt: question.created_at }; }

export async function getMyAcademicMaterials(profile: SupabaseProfileRow): Promise<StudyMaterial[]> {
  if (!profile.programme_id) return [];
  const courses = await getMyCourses(profile.programme_id, profile.level || '');
  if (!courses.length) return [];
  const courseIds = courses.map(course => course.id);
  const [resources, pastQuestions] = await Promise.all([
    getApprovedResourcesForCourses(courseIds),
    getApprovedPastQuestions(courseIds),
  ]);
  const courseById = new Map(courses.map(course => [course.id, course]));
  const institutionId = toInstitutionId(profile.institutions?.acronym || null);
  const mappedResources = resources.map(resource => mapResourceToStudyMaterial(resource, resource.course_id ? courseById.get(resource.course_id) : undefined, institutionId));
  const mappedPastQuestions = pastQuestions.map(question => mapPastQuestionToStudyMaterial(question, courseById.get(question.course_id), institutionId));
  return [...mappedPastQuestions, ...mappedResources].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCampusFeedPosts(): Promise<FeedPost[]> {
  const client = requireClient();
  const { data, error } = await client.from('campus_posts').select('id,author_id,institution_id,department_id,course_id,title,content,category,attachment_path,attachment_name,moderation_status,moderated_price,created_at').eq('moderation_status', 'APPROVED').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const authorIds = [...new Set(rows.map(row => row.author_id))];
  const courseIds = [...new Set(rows.map(row => row.course_id).filter(Boolean))] as string[];
  const postIds = rows.map(row => row.id);
  const [{ data: authors }, { data: courses }, { data: likes }, { data: comments }] = await Promise.all([
    client.from('profiles').select('id,full_name,school,department,level').in('id', authorIds),
    courseIds.length ? client.from('courses').select('id,code').in('id', courseIds) : Promise.resolve({ data: [], error: null } as any),
    client.from('campus_post_likes').select('post_id,user_id').in('post_id', postIds),
    client.from('campus_post_comments').select('id,post_id,author_id,body,created_at').in('post_id', postIds).order('created_at', { ascending: true }),
  ]);
  const authorMap = new Map((authors ?? []).map(author => [author.id, author]));
  const courseMap = new Map((courses ?? []).map(course => [course.id, course]));
  const likesMap = new Map<string, string[]>();
  (likes ?? []).forEach(like => likesMap.set(like.post_id, [...(likesMap.get(like.post_id) ?? []), like.user_id]));
  const commentsMap = new Map<string, PostComment[]>();
  (comments ?? []).forEach(comment => {
    const author = authorMap.get(comment.author_id);
    const mapped: PostComment = { id: comment.id, authorId: comment.author_id, authorName: author?.full_name || 'Student Contributor', authorInstitution: toInstitutionId(author?.school), text: comment.body, timestamp: comment.created_at };
    commentsMap.set(comment.post_id, [...(commentsMap.get(comment.post_id) ?? []), mapped]);
  });
  return rows.map(row => {
    const author = authorMap.get(row.author_id);
    const likedByUserIds = likesMap.get(row.id) ?? [];
    const commentsForPost = commentsMap.get(row.id) ?? [];
    const institutionId = toInstitutionId(author?.school);
    const course = row.course_id ? courseMap.get(row.course_id) : undefined;
    return { id: row.id, authorId: row.author_id, authorName: author?.full_name || 'Student Contributor', authorBadge: 'Student Contributor', authorInstitution: institutionId, authorDepartment: author?.department || '', authorLevel: author?.level || '', title: row.title, content: row.content, courseCode: course?.code, category: row.category, attachment: row.attachment_name ? { name: row.attachment_name, fileSize: '', fileType: 'File', pagesCount: 0 } : undefined, priceRequested: row.moderated_price ?? 0, moderatedPrice: row.moderated_price ?? 0, moderationStatus: row.moderation_status, moderatorNotes: undefined, verifiedByModerator: row.moderation_status === 'APPROVED' ? 'EduReach Moderator' : undefined, likesCount: likedByUserIds.length, likedByUserIds, comments: commentsForPost, viewsCount: 0, createdAt: row.created_at } satisfies FeedPost;
  });
}

export async function getSignedResourceUrl(storagePath: string, expiresInSeconds = 900): Promise<string> { const { data, error } = await requireClient().storage.from('resource-files').createSignedUrl(storagePath, expiresInSeconds); if (error) throw error; return data.signedUrl; }

export async function getSignedCampusAttachmentUrl(storagePath: string, expiresInSeconds = 900): Promise<string> { const { data, error } = await requireClient().storage.from('campus-uploads').createSignedUrl(storagePath, expiresInSeconds); if (error) throw error; return data.signedUrl; }
