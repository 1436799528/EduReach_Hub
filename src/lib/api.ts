import { supabase } from './supabase';

export type CbtSubmitPayload = { examId: string; attemptId: string; answers: Record<number, number> };
export type CbtStartResponse = { attemptId: string; startedAt: string; expiresAt: string; totalQuestions: number };
export type CbtSubmitResponse = {
  attemptId: string;
  score: number;
  breakdown: Array<{ question: number; selected: number | null; correct: number; explanation?: string }>;
};
export type ServiceSubmitPayload = { serviceSlug: string; details: Record<string, unknown> };
export type ServiceItem = {
  id: string;
  service_key: string;
  title: string;
  description: string;
  application_url: string | null;
  active: boolean;
};
export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  category: string;
  priority: string;
  source_url: string | null;
  published_at: string | null;
  last_verified_at: string | null;
  verification_status: string;
};
export type UpcomingItem = {
  id: string;
  kind: 'deadline' | 'exam';
  title: string;
  description: string | null;
  due_at: string | null;
  starts_at: string | null;
  location: string | null;
  priority: string | null;
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in before continuing.');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function jsonFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Request failed.');
  return body as T;
}

export async function fetchServices(): Promise<ServiceItem[]> {
  const body = await jsonFetch<{ items: ServiceItem[] }>('/api/services');
  return body.items || [];
}

export async function fetchService(slug: string): Promise<ServiceItem> {
  const body = await jsonFetch<{ item: ServiceItem }>(`/api/services/${encodeURIComponent(slug)}`);
  return body.item;
}

export async function fetchUpcoming(): Promise<UpcomingItem[]> {
  const body = await jsonFetch<{ items: UpcomingItem[] }>('/api/upcoming');
  return body.items || [];
}

export async function fetchCbtExams() {
  const { data, error } = await supabase
    .from('cbt_exams')
    .select('id,title,exam_body,subject,duration_minutes')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function startCbt(examId: string): Promise<CbtStartResponse> {
  const headers = await authHeaders();
  return jsonFetch<CbtStartResponse>(`/api/cbt/exams/${encodeURIComponent(examId)}/start`, { method: 'POST', headers });
}

export async function submitCbt(payload: CbtSubmitPayload): Promise<CbtSubmitResponse> {
  const headers = await authHeaders();
  return jsonFetch<CbtSubmitResponse>('/api/cbt/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
}

export async function fetchCbtQuestions(examId: string) {
  const body = await jsonFetch<{ exam: { id: string; title: string; durationMinutes: number; subject: string }; questions: Array<{ id: number; text: string; options: string[] }> }>(
    `/api/cbt/exams/${encodeURIComponent(examId)}/questions`,
  );
  return body;
}

export async function fetchCbtResult(attemptId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to view this result.');

  const { data, error } = await supabase.rpc('get_cbt_result', { p_attempt_id: attemptId });
  if (error) throw error;
  if (!data?.length) throw new Error('CBT result could not be found.');

  const first = data[0];
  const attempt = {
    id: first.attempt_id,
    exam_id: first.exam_id,
    score: first.score,
    correct_answers: first.correct_answers,
    total_questions: first.total_questions,
    submitted_at: first.submitted_at,
  };

  const answers = data.map((row: any) => ({
    question_id: row.question_id,
    selected_option: row.selected_option,
    is_correct: row.is_correct,
  }));

  const questions = data.map((row: any) => ({
    id: row.question_id,
    position: row.position,
    question_text: row.question_text,
    option_a: row.option_a,
    option_b: row.option_b,
    option_c: row.option_c,
    option_d: row.option_d,
    correct_option: row.correct_option,
    explanation: row.explanation,
  }));

  return { attempt, answers, questions };
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
    .insert({ user_id: user.id, service_id: service.id, status: 'submitted', form_data: payload.details })
    .select('id, reference_code, created_at, status')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function trackService(referenceCode: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to track your request.');
  const { data, error } = await supabase
    .from('service_requests')
    .select('id, reference_code, status, created_at, form_data, service_catalog(title, service_key)')
    .eq('user_id', user.id)
    .eq('reference_code', referenceCode)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No request was found for that reference code.');
  const stageMap: Record<string, number> = { submitted: 1, reviewing: 2, processing: 3, completed: 4, rejected: 4, cancelled: 4 };
  const current = stageMap[data.status] ?? 1;
  const labels = ['Received', 'Reviewing', 'Processing', 'Completed'];
  return { ...data, timeline: labels.map((label, index) => ({ label, done: index < current })) };
}

export async function fetchNews(): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from('news_articles')
    .select('id,title,excerpt,body,category,source_url,published_at,updated_at,published')
    .eq('published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(30);
  if (error) throw error;
  return (data || []).map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.excerpt,
    body: item.body,
    category: item.category,
    priority: 'normal',
    source_url: item.source_url,
    published_at: item.published_at,
    last_verified_at: item.updated_at,
    verification_status: 'verified',
  }));
}

export async function fetchNewsItem(slug: string): Promise<NewsItem> {
  const { data, error } = await supabase
    .from('news_articles')
    .select('id,title,excerpt,body,category,source_url,published_at,updated_at,published')
     .eq('slug', slug)
    .eq('published', true)
    .single();
  if (error || !data) throw new Error('News article could not be loaded.');
  return {
    id: data.id,
    title: data.title,
    summary: data.excerpt,
    body: data.body,
    category: data.category,
    priority: 'normal',
    source_url: data.source_url,
    published_at: data.published_at,
    last_verified_at: data.updated_at,
    verification_status: 'verified',
  };
}
