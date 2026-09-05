import { supabase } from '../lib/supabase';

export type CreatedServiceRequest = {
  id: string;
  status: string;
  created_at: string;
};

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user;
}

export async function createServiceRequest(serviceKey: string, formData: Record<string, string>): Promise<CreatedServiceRequest> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Please sign in before submitting a service request.');

  const { data: service, error: serviceError } = await supabase
    .from('service_catalog')
    .select('id, service_key, title')
    .eq('service_key', serviceKey)
    .eq('active', true)
    .maybeSingle();

  if (serviceError) throw new Error(serviceError.message);
  if (!service) throw new Error('This service is currently unavailable.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('institution_id, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const safeFormData = Object.fromEntries(
    Object.entries(formData).filter(([key]) => {
      const normalized = key.toLowerCase();
      return !normalized.includes('password') && !normalized.includes('otp') && !normalized.includes('pin') && !normalized.includes('token');
    }),
  );

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: user.id,
      service_id: service.id,
      institution_id: profile?.institution_id ?? null,
      status: 'submitted',
      form_data: {
        ...safeFormData,
        contact_email: user.email ?? '',
        account_name: profile?.full_name ?? user.user_metadata?.full_name ?? '',
      },
    })
    .select('id, status, created_at')
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('The request could not be created.');

  return data;
}

export async function listMyServiceRequests() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('service_requests')
    .select('id, status, created_at, service_catalog(title, service_key)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
