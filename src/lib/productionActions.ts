import { supabase } from './supabase';

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export interface ServiceRequestInput {
  serviceId: string;
  institutionId: string | null;
  formData: Record<string, unknown>;
  attachment?: File | null;
}

export async function resolveInstitutionUuid(acronym: string | null | undefined) {
  if (!acronym) return null;
  const client = requireClient();
  const { data, error } = await client
    .from('institutions')
    .select('id')
    .eq('acronym', acronym)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function resolveCourseUuid(courseCode: string | null | undefined) {
  if (!courseCode?.trim()) return null;
  const client = requireClient();
  const { data, error } = await client
    .from('courses')
    .select('id')
    .eq('code', courseCode.trim().toUpperCase())
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export const uploadPrivateFile = async (
  bucket: 'resource-files' | 'campus-uploads',
  ownerId: string,
  file: File,
) => {
  const client = requireClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${ownerId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  return { path, name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' };
};

export const createServiceRequest = async (userId: string, input: ServiceRequestInput) => {
  const client = requireClient();
  const { data, error } = await client
    .from('service_requests')
    .insert({
      user_id: userId,
      service_id: input.serviceId,
      institution_id: input.institutionId,
      status: 'submitted',
      form_data: input.formData,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const getMyServiceRequests = async (userId: string) => {
  const client = requireClient();
  const { data, error } = await client
    .from('service_requests')
    .select('id,user_id,service_id,institution_id,status,form_data,attachment_path,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const createCampusUpload = async (
  userId: string,
  input: {
    institutionId: string | null;
    departmentId?: string | null;
    courseId?: string | null;
    title: string;
    content: string;
    category: string;
    price?: number;
    file?: File | null;
  },
) => {
  const client = requireClient();
  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;

  if (input.file) {
    const upload = await uploadPrivateFile('campus-uploads', userId, input.file);
    attachmentPath = upload.path;
    attachmentName = upload.name;
  }

  const { data, error } = await client
    .from('campus_posts')
    .insert({
      author_id: userId,
      institution_id: input.institutionId,
      department_id: input.departmentId ?? null,
      course_id: input.courseId ?? null,
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.category,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      moderation_status: 'PENDING_REVIEW',
      moderated_price: 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};
