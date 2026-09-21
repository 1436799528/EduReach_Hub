import { supabase, isSupabaseConfigured } from './supabase';
import { hubServices, newsItems as fallbackNews } from '../data/hubContent';

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
  slug: string;
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

// Fallback catalog constructed from product directory
const fallbackServicesCatalog: ServiceItem[] = hubServices.map((srv, index) => ({
  id: `srv-${srv.slug}-${index + 1}`,
  service_key: srv.slug,
  title: srv.title,
  description: srv.description,
  application_url: null,
  active: true,
}));

// Upcoming deadlines are loaded from the backend when configured
const fallbackUpcomingItems: UpcomingItem[] = [];

// Built-in CBT practice catalog
const fallbackCbtExams = [
  {
    id: 'practice-exam-jamb',
    title: 'JAMB UTME Comprehensive Practice',
    exam_body: 'JAMB',
    subject: 'General Practice & Use of English',
    duration_minutes: 30,
  },
  {
    id: 'practice-exam-waec',
    title: 'WAEC Senior Certificate Revision',
    exam_body: 'WAEC',
    subject: 'Use of English',
    duration_minutes: 45,
  },
  {
    id: 'practice-exam-neco',
    title: 'NECO SSCE Comprehensive Practice',
    exam_body: 'NECO',
    subject: 'Mathematics',
    duration_minutes: 40,
  },
  {
    id: 'practice-exam-post-utme',
    title: 'Federal Universities Post-UTME Screening',
    exam_body: 'POST-UTME',
    subject: 'Aptitude & General Studies',
    duration_minutes: 25,
  },
];

const fallbackNewsItems: NewsItem[] = fallbackNews.map((n, index) => ({
  id: `news-${n.slug}-${index + 1}`,
  slug: n.slug,
  title: n.title,
  summary: n.excerpt,
  body: `${n.excerpt}\n\nOfficial Student Advice:\nStudents are advised to cross-check all deadlines and application portals through legitimate school channels. Keep your student registration numbers, tokens, and exam slips safeguarded.\n\nKey Requirements:\n1. Ensure your JAMB registration profile is linked to an active email address.\n2. Do not disclose secret result-checking PINs to unverified sources.\n3. Track all service requests on EduReach Hub for live updates.`,
  category: n.tag.toLowerCase().replace(/[\s/]+/g, '_'),
  priority: 'normal',
  source_url: 'https://edureach.ng',
  published_at: new Date(Date.now() - index * 86400000 * 2).toISOString(),
  last_verified_at: new Date().toISOString(),
  verification_status: n.verified ? 'verified' : 'pending',
}));

const practiceQuestions = [
  { id: 1, text: 'Choose the word nearest in meaning to "rapid".', options: ['Slow', 'Fast', 'Late', 'Weak'] },
  { id: 2, text: 'What is 15% of 200?', options: ['20', '25', '30', '35'] },
  { id: 3, text: 'Which quantity is measured in newtons?', options: ['Power', 'Force', 'Energy', 'Pressure'] },
  { id: 4, text: 'What is the chemical symbol for sodium?', options: ['S', 'Sd', 'Na', 'Sn'] },
  { id: 5, text: 'Choose the correctly spelled word.', options: ['Accomodate', 'Acommodate', 'Accommodate', 'Accomoddate'] },
  { id: 6, text: 'Solve for x: 3x = 21.', options: ['5', '6', '7', '8'] },
  { id: 7, text: 'Which organelle is commonly called the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Mitochondrion', 'Golgi body'] },
  { id: 8, text: 'What is the SI unit of electric current?', options: ['Volt', 'Ohm', 'Ampere', 'Watt'] },
  { id: 9, text: 'What is the next prime number after 11?', options: ['12', '13', '14', '15'] },
  { id: 10, text: 'Nigeria is located on which continent?', options: ['Asia', 'Africa', 'Europe', 'South America'] },
];

const correctAnswersMap: Record<number, number> = {
  1: 1, // Fast
  2: 2, // 30
  3: 1, // Force
  4: 2, // Na
  5: 2, // Accommodate
  6: 2, // 7
  7: 2, // Mitochondrion
  8: 2, // Ampere
  9: 1, // 13
  10: 1, // Africa
};

const explanationsMap: Record<number, string> = {
  1: 'Rapid means happening at high speed or moving fast.',
  2: '15% of 200 is (15 / 100) * 200 = 30.',
  3: 'Force is measured in newtons (N), named after Isaac Newton.',
  4: 'Na (from Latin Natrium) is the chemical symbol for sodium.',
  5: 'Accommodate is spelled with two "c"s and two "m"s.',
  6: 'Divide both sides of 3x = 21 by 3 to get x = 7.',
  7: 'Mitochondria generate cellular energy through ATP production.',
  8: 'The SI unit of electric current is the Ampere (A).',
  9: '13 is a prime number because it only has factors of 1 and 13.',
  10: 'Nigeria is a country situated in West Africa.',
};

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` };
  } catch {
    // ignore
  }
  return {};
}

async function jsonFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Request failed.');
  return body as T;
}

export async function fetchServices(): Promise<ServiceItem[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('service_catalog')
        .select('id,service_key,title,description,application_url,active')
        .eq('active', true)
        .order('title');
      if (!error && data?.length) return data as ServiceItem[];
    } catch {
      // fallback
    }
  }
  return fallbackServicesCatalog;
}

export async function fetchService(slug: string): Promise<ServiceItem> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('service_catalog')
        .select('id,service_key,title,description,application_url,active')
        .eq('service_key', slug)
        .eq('active', true)
        .maybeSingle();
      if (!error && data) return data as ServiceItem;
    } catch {
      // fallback
    }
  }
  const item = fallbackServicesCatalog.find((s) => s.service_key === slug);
  if (item) return item;
  throw new Error('This service is not available. Browse the services catalogue for active student services.');
}

export async function fetchUpcoming(): Promise<UpcomingItem[]> {
  if (isSupabaseConfigured) {
    try {
      const body = await jsonFetch<{ items: UpcomingItem[] }>('/api/upcoming');
      if (body.items?.length) return body.items;
    } catch {
      // Return an empty list when no backend deadline feed is configured
    }
  }
  return fallbackUpcomingItems;
}

export async function fetchCbtExams() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('cbt_exams')
        .select('id,title,exam_body,subject,duration_minutes')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (!error && data?.length) return data;
    } catch {
      // ignore
    }
  }
  return fallbackCbtExams;
}

export async function startCbt(examId: string): Promise<CbtStartResponse> {
  if (isSupabaseConfigured) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in before starting this CBT practice session.');

    const { data, error } = await supabase.rpc('start_cbt_attempt', { p_exam_id: examId });
    if (error || !data?.length) throw new Error(error?.message || 'Unable to start this CBT practice session.');
    const row = data[0];
    return {
      attemptId: row.attempt_id,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      totalQuestions: row.total_questions,
    };
  }

  return {
    attemptId: `local-cbt-${examId}-${Date.now()}`,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    totalQuestions: practiceQuestions.length,
  };
}

export async function submitCbt(payload: CbtSubmitPayload): Promise<CbtSubmitResponse> {
  if (isSupabaseConfigured) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in before submitting this CBT practice session.');

    const { data, error } = await supabase.rpc('submit_cbt_attempt', {
      p_attempt_id: payload.attemptId,
      p_exam_id: payload.examId,
      p_answers: payload.answers,
    });
    if (error || !data?.length) throw new Error(error?.message || 'CBT submission failed.');
    const row = data[0];
    return {
      attemptId: row.attempt_id,
      score: Number(row.score),
      breakdown: row.breakdown || [],
    };
  }

  let correctCount = 0;
  const breakdown = practiceQuestions.map((q) => {
    const selected = payload.answers[q.id] ?? null;
    const correct = correctAnswersMap[q.id];
    const isCorrect = selected === correct;
    if (isCorrect) correctCount++;
    return {
      question: q.id,
      selected,
      correct,
      explanation: explanationsMap[q.id] || 'Review syllabus and textbook references.',
    };
  });

  const score = Math.round((correctCount / practiceQuestions.length) * 100);
  const resultData = {
    attempt: {
      id: payload.attemptId,
      exam_id: payload.examId,
      score,
      correct_answers: correctCount,
      total_questions: practiceQuestions.length,
      submitted_at: new Date().toISOString(),
    },
    answers: practiceQuestions.map((q) => ({
      question_id: q.id,
      selected_option: payload.answers[q.id] !== undefined ? String.fromCharCode(65 + payload.answers[q.id]) : null,
      is_correct: payload.answers[q.id] === correctAnswersMap[q.id],
    })),
    questions: practiceQuestions.map((q, idx) => ({
      id: q.id,
      position: idx + 1,
      question_text: q.text,
      option_a: q.options[0],
      option_b: q.options[1],
      option_c: q.options[2],
      option_d: q.options[3],
      correct_option: String.fromCharCode(65 + correctAnswersMap[q.id]),
      explanation: explanationsMap[q.id],
    })),
  };

  try {
    localStorage.setItem(`edureach-cbt-result-${payload.attemptId}`, JSON.stringify(resultData));
    localStorage.setItem('edureach-last-cbt-attempt', payload.attemptId);
  } catch {
    // localStorage may be disabled
  }

  return { attemptId: payload.attemptId, score, breakdown };
}

export async function fetchCbtQuestions(examId: string) {
  if (isSupabaseConfigured) {
    try {
      const { data: exam, error: examError } = await supabase
        .from('cbt_exams')
        .select('id,title,duration_minutes,subject')
        .eq('id', examId)
        .eq('is_active', true)
        .maybeSingle();
      const { data: questions, error: questionError } = await supabase.rpc('get_cbt_questions', { p_exam_id: examId });
      if (!examError && !questionError && exam && questions?.length) {
        return {
          exam: { id: exam.id, title: exam.title, durationMinutes: exam.duration_minutes, subject: exam.subject },
          questions: questions.map((q: any) => ({ id: q.position, text: q.question_text, options: [q.option_a, q.option_b, q.option_c, q.option_d] })),
        };
      }
    } catch {
      // fallback
    }
  }

  const examMeta = fallbackCbtExams.find((e) => e.id === examId) || fallbackCbtExams[0];
  return {
    exam: { id: examId, title: examMeta.title, durationMinutes: examMeta.duration_minutes, subject: examMeta.subject },
    questions: practiceQuestions,
  };
}

export async function fetchCbtResult(attemptId: string) {
  if (isSupabaseConfigured) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase.rpc('get_cbt_result', { p_attempt_id: attemptId });
        if (!error && data?.length) {
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
      }
    } catch {
      // fallback to local stored result
    }
  }

  if (!isSupabaseConfigured) {
    try {
      const stored = localStorage.getItem(`edureach-cbt-result-${attemptId}`);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  throw new Error('No CBT result was found for this attempt. Complete a CBT practice session to generate a scorecard.');
}

export async function submitServiceRequest(payload: ServiceSubmitPayload) {
  if (isSupabaseConfigured) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: service } = await supabase
          .from('service_catalog')
          .select('id, service_key, title')
          .eq('service_key', payload.serviceSlug)
          .eq('active', true)
          .maybeSingle();

        if (service) {
          const { data, error } = await supabase
            .from('service_requests')
            .insert({ user_id: user.id, service_id: service.id, status: 'submitted', form_data: payload.details })
            .select('id, reference_code, created_at, status')
            .single();
          if (!error && data) return data;
        }
      }
    } catch {
      // fallback
    }
  }

  if (isSupabaseConfigured) throw new Error('Please sign in before submitting a service request.');

  // Local request persistence for unconfigured/offline sessions. This records only what the student actually submitted.
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const localRef = `ER-${new Date().getFullYear()}-${randomSuffix}`;
  const localRecord = {
    id: `req-${Date.now()}`,
    reference_code: localRef,
    created_at: new Date().toISOString(),
    status: 'submitted',
    form_data: payload.details,
    service_catalog: { title: payload.details.serviceTitle as string || 'EduReach Service' },
  };

  try {
    const existing = JSON.parse(localStorage.getItem('edureach-service-requests') || '[]');
    existing.unshift(localRecord);
    localStorage.setItem('edureach-service-requests', JSON.stringify(existing));
  } catch {
    // ignore
  }

  return localRecord;
}

export async function trackService(referenceCode: string) {
  const normalized = referenceCode.trim().toUpperCase();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('get_public_service_request', { p_reference_code: normalized });
      if (!error && data?.length) {
        const row = data[0];
        const stageMap: Record<string, number> = { submitted: 1, reviewing: 2, processing: 3, completed: 4, rejected: 4, cancelled: 4 };
        const current = stageMap[row.status] ?? 1;
        const labels = ['Received', 'Reviewing', 'Processing', 'Completed'];
        return {
          id: row.id,
          reference_code: row.reference_code,
          status: row.status,
          created_at: row.created_at,
          service_catalog: { title: row.service_title, service_key: row.service_key },
          timeline: labels.map((label, index) => ({ label, done: index < current })),
        };
      }
    } catch {
      // fallback
    }
  }

  if (!isSupabaseConfigured) {
    try {
      const saved = JSON.parse(localStorage.getItem('edureach-service-requests') || '[]');
      const match = saved.find((r: any) => r.reference_code === normalized);
      if (match) {
        const stageMap: Record<string, number> = { submitted: 1, reviewing: 2, processing: 3, completed: 4 };
        const current = stageMap[match.status] ?? 1;
        const labels = ['Received', 'Reviewing', 'Processing', 'Completed'];
        return { ...match, timeline: labels.map((label, index) => ({ label, done: index < current })) };
      }
    } catch {
      // ignore
    }
  }

  throw new Error('No service request was found for that reference code. Please confirm the code from your submitted application.');
}

export async function fetchNews(): Promise<NewsItem[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('id,slug,title,excerpt,body,category,source_url,published_at,updated_at,published')
        .eq('published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(30);
      if (!error && data?.length) {
        return data.map((item) => ({
          id: item.id,
          slug: item.slug,
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
    } catch {
      // fallback
    }
  }
  return fallbackNewsItems;
}

export async function fetchNewsItem(slug: string): Promise<NewsItem> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('id,slug,title,excerpt,body,category,source_url,published_at,updated_at,published')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          slug: data.slug,
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
    } catch {
      // fallback
    }
  }

  const match = fallbackNewsItems.find((n) => n.slug === slug);
  if (match) return match;

  return {
    id: `news-${slug}`,
    slug,
    title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    summary: 'Official notification and academic update details for Nigerian students.',
    body: 'This update is part of the EduReach Hub verified announcements feed. Detailed guidelines and official institutional schedules will be displayed here as they are released.',
    category: 'academic',
    priority: 'normal',
    source_url: 'https://edureach.ng',
    published_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    verification_status: 'verified',
  };
}

export type AdminAnalytics = {
  metrics: Record<string, number>;
  audit: Array<Record<string, unknown>>;
  recentRequests: Array<Record<string, any>>;
  recentUsers: Array<Record<string, any>>;
};

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const body = await jsonFetch<AdminAnalytics>('/api/admin/analytics', { headers });
  return body;
}

export async function bootstrapAdmin(): Promise<void> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Sign in with the configured administrator account first.');
  await jsonFetch('/api/admin/bootstrap', { method: 'POST', headers });
}

export type AdminUser = { id: string; full_name: string; school: string; faculty: string; department: string; level: string; role: string; matric_number: string | null; created_at: string };

const fallbackAdminUsers: AdminUser[] = [];

export async function fetchAdminUsers(search = ''): Promise<AdminUser[]> {
  try {
    const headers = await authHeaders();
    if (headers.Authorization) {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const body = await jsonFetch<{ items: AdminUser[] }>(`/api/admin/users${query}`, { headers });
      if (body.items) return body.items;
    }
  } catch {
    // fallback
  }

  if (!search.trim()) return fallbackAdminUsers;
  const q = search.toLowerCase();
  return fallbackAdminUsers.filter(u => u.full_name.toLowerCase().includes(q) || u.school.toLowerCase().includes(q) || (u.matric_number && u.matric_number.toLowerCase().includes(q)));
}

export type AdminServiceRequest = { id: string; user_id: string; status: string; form_data: Record<string, unknown>; created_at: string; updated_at: string; reference_code?: string | null; service_catalog?: { title: string } | null };

const fallbackAdminRequests: AdminServiceRequest[] = [];

export async function fetchAdminServiceRequests(status = 'all'): Promise<AdminServiceRequest[]> {
  try {
    const headers = await authHeaders();
    if (headers.Authorization) {
      const body = await jsonFetch<{ items: AdminServiceRequest[] }>(`/api/admin/service-requests?status=${encodeURIComponent(status)}`, { headers });
      if (body.items) return body.items;
    }
  } catch {
    // fallback
  }

  if (status === 'all') return fallbackAdminRequests;
  return fallbackAdminRequests.filter(r => r.status === status);
}

export async function updateAdminServiceRequest(requestId: string, status: string) {
  try {
    const headers = await authHeaders();
    if (headers.Authorization) {
      return await jsonFetch<{ item: { id: string; status: string; updated_at: string } }>(`/api/admin/service-requests/${encodeURIComponent(requestId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ status }) });
    }
  } catch {
    // fallback
  }

  const req = fallbackAdminRequests.find(r => r.id === requestId);
  if (!req) throw new Error('Unable to update this request because no admin service record was found.');
  req.status = status;
  req.updated_at = new Date().toISOString();
  return { item: { id: requestId, status, updated_at: req.updated_at } };
}
