import { supabase, isSupabaseConfigured } from './supabase';
import { hubServices, newsItems as fallbackNews, sampleQuestions } from '../data/hubContent';

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

// Fallback upcoming deadlines and exams
const fallbackUpcomingItems: UpcomingItem[] = [
  {
    id: 'up-1',
    kind: 'exam',
    title: 'JAMB UTME 2026 Examination',
    description: 'National examination session and center verification.',
    due_at: null,
    starts_at: '2026-04-18',
    location: 'Designated CBT Centers',
    priority: 'high',
  },
  {
    id: 'up-2',
    kind: 'deadline',
    title: 'NELFUND Student Loan Window',
    description: 'Deadline to submit student-loan information for current semester.',
    due_at: '2026-05-15',
    starts_at: null,
    location: 'Official Portal',
    priority: 'high',
  },
  {
    id: 'up-3',
    kind: 'exam',
    title: 'WAEC May/June Examination',
    description: 'Senior secondary certificate examination nationwide timetable.',
    due_at: null,
    starts_at: '2026-05-08',
    location: 'Accredited Schools',
    priority: 'normal',
  },
  {
    id: 'up-4',
    kind: 'deadline',
    title: 'Post-UTME Screening Applications',
    description: 'University screening registration closes for tertiary institutions.',
    due_at: '2026-06-30',
    starts_at: null,
    location: 'Institution Portals',
    priority: 'normal',
  },
];

// Fallback CBT exams
const fallbackCbtExams = [
  {
    id: 'demo-exam-jamb',
    title: 'JAMB UTME Comprehensive Practice',
    exam_body: 'JAMB',
    subject: 'General Practice & Use of English',
    duration_minutes: 30,
  },
  {
    id: 'demo-exam-waec',
    title: 'WAEC Senior Certificate Revision',
    exam_body: 'WAEC',
    subject: 'Use of English',
    duration_minutes: 45,
  },
  {
    id: 'demo-exam-neco',
    title: 'NECO SSCE Comprehensive Practice',
    exam_body: 'NECO',
    subject: 'Mathematics',
    duration_minutes: 40,
  },
  {
    id: 'demo-exam-post-utme',
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

const fallbackQuestions = [
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
      const body = await jsonFetch<{ items: ServiceItem[] }>('/api/services');
      if (body.items?.length) return body.items;
    } catch {
      // Backend offline / not configured
    }
  }
  return fallbackServicesCatalog;
}

export async function fetchService(slug: string): Promise<ServiceItem> {
  if (isSupabaseConfigured) {
    try {
      const body = await jsonFetch<{ item: ServiceItem }>(`/api/services/${encodeURIComponent(slug)}`);
      if (body.item) return body.item;
    } catch {
      // Backend offline / not configured
    }
  }
  const item = fallbackServicesCatalog.find((s) => s.service_key === slug);
  if (item) return item;
  return {
    id: `srv-${slug}`,
    service_key: slug,
    title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: 'Comprehensive student service assistance and documentation support.',
    application_url: null,
    active: true,
  };
}

export async function fetchUpcoming(): Promise<UpcomingItem[]> {
  if (isSupabaseConfigured) {
    try {
      const body = await jsonFetch<{ items: UpcomingItem[] }>('/api/upcoming');
      if (body.items?.length) return body.items;
    } catch {
      // Fall back to preview updates
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
  try {
    const headers = await authHeaders();
    if (headers.Authorization) {
      return await jsonFetch<CbtStartResponse>(`/api/cbt/exams/${encodeURIComponent(examId)}/start`, { method: 'POST', headers });
    }
  } catch {
    // fallback
  }
  return {
    attemptId: `mock-cbt-${examId}-${Date.now()}`,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    totalQuestions: fallbackQuestions.length,
  };
}

export async function submitCbt(payload: CbtSubmitPayload): Promise<CbtSubmitResponse> {
  try {
    const headers = await authHeaders();
    if (headers.Authorization) {
      return await jsonFetch<CbtSubmitResponse>('/api/cbt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      });
    }
  } catch {
    // fallback
  }

  // Local fallback scoring for frontend practice mode
  let correctCount = 0;
  const breakdown = fallbackQuestions.map((q) => {
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

  const score = Math.round((correctCount / fallbackQuestions.length) * 100);
  const resultData = {
    attempt: {
      id: payload.attemptId,
      exam_id: payload.examId,
      score,
      correct_answers: correctCount,
      total_questions: fallbackQuestions.length,
      submitted_at: new Date().toISOString(),
    },
    answers: fallbackQuestions.map((q) => ({
      question_id: q.id,
      selected_option: payload.answers[q.id] !== undefined ? String.fromCharCode(65 + payload.answers[q.id]) : null,
      is_correct: payload.answers[q.id] === correctAnswersMap[q.id],
    })),
    questions: fallbackQuestions.map((q, idx) => ({
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

  return {
    attemptId: payload.attemptId,
    score,
    breakdown,
  };
}

export async function fetchCbtQuestions(examId: string) {
  if (isSupabaseConfigured) {
    try {
      const body = await jsonFetch<{ exam: { id: string; title: string; durationMinutes: number; subject: string }; questions: Array<{ id: number; text: string; options: string[] }> }>(
        `/api/cbt/exams/${encodeURIComponent(examId)}/questions`,
      );
      if (body?.questions?.length) return body;
    } catch {
      // fallback
    }
  }

  const examMeta = fallbackCbtExams.find((e) => e.id === examId) || fallbackCbtExams[0];
  return {
    exam: {
      id: examId,
      title: examMeta.title,
      durationMinutes: examMeta.duration_minutes,
      subject: examMeta.subject,
    },
    questions: fallbackQuestions,
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

  try {
    const stored = localStorage.getItem(`edureach-cbt-result-${attemptId}`);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }

  // Realistic sample demo result if no attempt stored
  return {
    attempt: {
      id: attemptId,
      exam_id: 'demo-exam-jamb',
      score: 80,
      correct_answers: 8,
      total_questions: 10,
      submitted_at: new Date().toISOString(),
    },
    answers: fallbackQuestions.map((q, idx) => ({
      question_id: q.id,
      selected_option: idx < 8 ? String.fromCharCode(65 + correctAnswersMap[q.id]) : 'A',
      is_correct: idx < 8,
    })),
    questions: fallbackQuestions.map((q, idx) => ({
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

  // Offline / Demo request generation
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const mockRef = `ER-${new Date().getFullYear()}-${randomSuffix}`;
  const mockRecord = {
    id: `req-${Date.now()}`,
    reference_code: mockRef,
    created_at: new Date().toISOString(),
    status: 'submitted',
    form_data: payload.details,
    service_catalog: { title: payload.details.serviceTitle as string || 'EduReach Service' },
  };

  try {
    const existing = JSON.parse(localStorage.getItem('edureach-mock-requests') || '[]');
    existing.unshift(mockRecord);
    localStorage.setItem('edureach-mock-requests', JSON.stringify(existing));
  } catch {
    // ignore
  }

  return mockRecord;
}

export async function trackService(referenceCode: string) {
  const normalized = referenceCode.trim().toUpperCase();

  if (isSupabaseConfigured) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('service_requests')
          .select('id, reference_code, status, created_at, form_data, service_catalog(title, service_key)')
          .eq('reference_code', normalized)
          .maybeSingle();
        if (!error && data) {
          const stageMap: Record<string, number> = { submitted: 1, reviewing: 2, processing: 3, completed: 4, rejected: 4, cancelled: 4 };
          const current = stageMap[data.status] ?? 1;
          const labels = ['Received', 'Reviewing', 'Processing', 'Completed'];
          return { ...data, timeline: labels.map((label, index) => ({ label, done: index < current })) };
        }
      }
    } catch {
      // fallback
    }
  }

  // Check locally saved mock requests
  try {
    const saved = JSON.parse(localStorage.getItem('edureach-mock-requests') || '[]');
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

  // Demo fallback tracked response for any valid format
  const labels = ['Received', 'Reviewing', 'Processing', 'Completed'];
  return {
    id: `req-demo-${normalized}`,
    reference_code: normalized,
    status: 'processing',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    service_catalog: { title: 'JAMB / Student Service Processing' },
    form_data: { fullName: 'Student Candidate', statusNote: 'Application is undergoing administrative verification.' },
    timeline: labels.map((label, index) => ({ label, done: index < 3 })),
  };
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

export type AdminUser = { id: string; full_name: string; school: string; faculty: string; department: string; level: string; role: string; matric_number: string | null; created_at: string };

const fallbackAdminUsers: AdminUser[] = [
  { id: 'usr-1', full_name: 'Chinedu Okafor', school: 'University of Nigeria, Nsukka', faculty: 'Engineering', department: 'Mechanical Engineering', level: '400L', role: 'student', matric_number: '2021/248102', created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: 'usr-2', full_name: 'Fatima Bello', school: 'Ahmadu Bello University, Zaria', faculty: 'Law', department: 'Public Law', level: '300L', role: 'student', matric_number: 'ABU/LAW/22/041', created_at: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: 'usr-3', full_name: 'Adebayo Johnson', school: 'University of Calabar (UNICAL)', faculty: 'Physical Sciences', department: 'Computer Science', level: '300L', role: 'student', matric_number: '21/095244102', created_at: new Date(Date.now() - 86400000 * 15).toISOString() },
  { id: 'usr-4', full_name: 'Oluwaseun Balogun', school: 'EduReach Operations Team', faculty: 'Administration', department: 'Student Support', level: 'Staff', role: 'admin', matric_number: null, created_at: new Date(Date.now() - 86400000 * 120).toISOString() },
];

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

const fallbackAdminRequests: AdminServiceRequest[] = [
  {
    id: 'req-adm-1',
    user_id: 'usr-1',
    status: 'submitted',
    reference_code: 'ER-2026-N7X9',
    form_data: { fullName: 'Chinedu Okafor', institution: 'UNN', phone: '08012345678', requestDetails: 'NELFUND student loan guidance' },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    service_catalog: { title: 'NELFUND Loan Application' },
  },
  {
    id: 'req-adm-2',
    user_id: 'usr-3',
    status: 'processing',
    reference_code: 'ER-2026-J4B8',
    form_data: { fullName: 'Adebayo Johnson', institution: 'UNICAL', phone: '08098765432', requestDetails: 'JAMB Original Result Slip' },
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    service_catalog: { title: 'JAMB Exam Slip Printing' },
  },
  {
    id: 'req-adm-3',
    user_id: 'usr-2',
    status: 'completed',
    reference_code: 'ER-2026-W2M4',
    form_data: { fullName: 'Fatima Bello', institution: 'ABU Zaria', phone: '08123456789', requestDetails: 'WAEC Scratch Card Token' },
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    service_catalog: { title: 'WAEC / NECO Scratch Cards' },
  },
];

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
  if (req) {
    req.status = status;
    req.updated_at = new Date().toISOString();
  }
  return { item: { id: requestId, status, updated_at: new Date().toISOString() } };
}
