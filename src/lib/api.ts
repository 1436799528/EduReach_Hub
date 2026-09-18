import { supabase } from './supabase';

export type CbtSubmitPayload = { examId: string; answers: Record<number, number>; timeSpentSeconds: number };
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

export async function fetchServices(): Promise<ServiceItem[]> {
  const response = await fetch('/api/services');
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Services could not be loaded.');
  return body?.items || [];
}

export async function fetchService(slug: string): Promise<ServiceItem> {
  const response = await fetch(`/api/services/${encodeURIComponent(slug)}`);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Service could not be loaded.');
  return body.item as ServiceItem;
}

export async function fetchUpcoming(): Promise<UpcomingItem[]> {
  const response = await fetch('/api/upcoming');
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Upcoming items could not be loaded.');
  return body?.items || [];
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

export async function submitCbt(payload: CbtSubmitPayload): Promise<CbtSubmitResponse> {
  const headers = await authHeaders();
  const response = await fetch('/api/cbt/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'CBT submission failed.');
  return body as CbtSubmitResponse;
}

export async function fetchCbtQuestions(examId: string) {
  const response = await fetch(`/api/cbt/exams/${encodeURIComponent(examId)}/questions`);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'CBT questions could not be loaded.');
  return body as { exam: { id: string; title: string; durationMinutes: number; subject: string }; questions: Array<{ id: number; text: string; options: string[] }> };
}

export async function fetchCbtResult(attemptId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to view this result.');

  const { data: attempt, error: attemptError } = await supabase
    .from('cbt_attempts')
    .select('id, exam_id, score, correct_answers, total_questions, submitted_at')
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .single();
  if (attemptError || !attempt) throw new Error('CBT result could not be found.');

  const { data: answers, error: answersError } = await supabase
    .from('cbt_answers')
    .select('question_id, selected_option, is_correct')
    .eq('attempt_id', attempt.id);
  if (answersError) throw answersError;

  const questionIds = (answers || []).map((answer) => answer.question_id);
  const { data: questions, error: questionsError } = questionIds.length
    ? await supabase.from('exam_questions').select('id, position, question_text, option_a, option_b, option_c, option_d, correct_option, explanation').in('id', questionIds).order('position', { ascending: true })
    : { data: [], error: null };
  if (questionsError) throw questionsError;

  return { attempt, answers: answers || [], questions: questions || [] };
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
  const response = await fetch('/api/news');
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'News request failed.');
  return body?.items || [];
}

export async function fetchNewsItem(id: string): Promise<NewsItem> {
  const response = await fetch(`/api/news/${encodeURIComponent(id)}`);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'News article could not be loaded.');
  return body.item as NewsItem;
}
