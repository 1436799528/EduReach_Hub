import { supabase, isValidUuid } from './supabase';

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export async function uploadCampusFile(userId: string, file: File) {
  const client = requireClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await client.storage.from('campus-uploads').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return path;
}

export async function uploadResourceFile(userId: string, file: File) {
  const client = requireClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await client.storage.from('resource-files').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return path;
}

export async function getSignedResourceUrl(storagePath: string, expiresIn = 300) {
  const client = requireClient();
  const { data, error } = await client.storage.from('resource-files').createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function getActiveServices() {
  const { data, error } = await requireClient().from('service_catalog').select('id,service_key,title,description,application_url,active').eq('active', true).order('title');
  if (error) throw error;
  return data ?? [];
}

export async function createServiceRequest(input: { userId: string; serviceId: string; institutionId?: string | null; formData?: Record<string, unknown>; attachmentPath?: string | null; }) {
  const { data, error } = await requireClient().from('service_requests').insert({
    user_id: input.userId,
    service_id: input.serviceId,
    institution_id: input.institutionId ?? null,
    form_data: input.formData ?? {},
    attachment_path: input.attachmentPath ?? null,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function getMyServiceRequests(userId: string) {
  if (!isValidUuid(userId)) return [];
  const { data, error } = await requireClient().from('service_requests').select('id,service_id,institution_id,status,form_data,attachment_path,created_at,updated_at,service_catalog(service_key,title)').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
