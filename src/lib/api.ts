import { supabase } from './supabase';

export type CbtSubmitPayload = {
  answers: Record<number, number>;
  duration: number;
};

export type CbtSubmitResponse = {
  score: number;
  breakdown: Array<{ question: number; selected: number | null; correct: number; explanation?: string }>;
};

export type ServiceSubmitPayload = {
  serviceSlug: string;
  details: Record<string, unknown>;
};

export async function submitCbt(payload: CbtSubmitPayload): Promise<CbtSubmitResponse> {
  const response = await fetch('/api/cbt/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error('CBT submission failed.');
  return response.json() as Promise<CbtSubmitResponse>;
}

export async function submitServiceRequest(payload: ServiceSubmitPayload) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in before submitting a service request.');

  const { data: service, error: serviceError } = await supabase
    .from('service_catalog')
    .select('id, service_key, title')
    .eq('service_key', payload.serviceSlug)
    .eq('active', true)
    .single();

  if (serviceError || !service) throw new Error('Service is not available.');

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: user.id,
      service_id: service.id,
      status: 'submitted',
      form_data: payload.details,
    })
    .select('id, created_at, status')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function trackService(referenceCode: string) {
  const response = await fetch(`/api/services/track?ref=${encodeURIComponent(referenceCode)}`);
  if (!response.ok) throw new Error('Tracking request failed.');
  return response.json();
}

export async function fetchNews() {
  const response = await fetch('/api/news');
  if (!response.ok) throw new Error('News request failed.');
  return response.json();
}
