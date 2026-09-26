import { supabase, isSupabaseConfigured } from './supabase';
import { hubServices } from '../data/hubContent';
import { localStorageKey } from './localPreview';

export function userFacingError(value: unknown, fallback = 'We could not complete that request. Please try again.') {
  const raw = value instanceof Error ? value.message : String(value || '');
  const message = raw.trim();
  if (!message) return fallback;

  const known: Array<[RegExp, string]> = [
    [/failed to fetch|networkerror|load failed|fetch failed/i, 'Please check your internet connection and try again.'],
    [/invalid or expired session|authentication required|administrator session required/i, 'Your session has expired. Please sign in again.'],
    [/not found|could not be found|no .* was found/i, 'The requested information is not available.'],
    [/already been submitted|duplicate|already exists/i, 'This action has already been completed.'],
    [/expired/i, 'This session has expired. Please start again.'],
    [/no questions|question bank/i, 'This CBT is not ready yet. Please choose another available question bank.'],
    [/not available|not accepting requests/i, 'This service is not currently available. Please choose another option.'],
    [/required|invalid.*input|valid .* required/i, 'Please check the information entered and try again.'],
    [/permission|forbidden|not authorized|access denied/i, 'You do not have permission to perform this action.'],
    [/too large|payload|size limit/i, 'The submitted file or information is too large. Please reduce it and try again.'],
    [/timeout|timed out/i, 'The request took too long. Please try again.'],
  ];
  const match = known.find(([pattern]) => pattern.test(message));
  if (match) return match[1];

  // Never expose SQL, database, stack traces, file paths, RPC names or server internals.
  if (/postgres|postgresql|supabase|sqlstate|column .* (ambiguous|does not exist)|relation .* does not exist|constraint|violates|rpc|function .* does not exist|syntax error|stack|at [\w./:-]+\(/i.test(message)) {
    return fallback;
  }
  return message.length <= 180 && !/[\n\r]/.test(message) ? message : fallback;
}

export type CbtSubmitPayload = { examId: string; attemptId: string; answers: Record<number, number> };
export type CbtStartResponse = { attemptId: string; startedAt: string; expiresAt: string; totalQuestions: number; guest?: boolean };
export type CbtSubmitResponse = {
  attemptId: string;
  score: number;
  breakdown: Array<{ question: number; selected: number | null; correct: number; explanation?: string }>;
  result?: Record<string, unknown>;
};
export type ServiceSubmitPayload = { serviceSlug: string; details: Record<string, unknown> };
export type ServiceItem = {
  id: string;
  service_key: string;
  title: string;
  description: string;
  application_url: string | null;
  active: boolean;
  route?: string | null;
  category?: string | null;
  sort_order?: number | null;
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
  image_url: string | null;
  published_at: string | null;
  author: string | null;
  last_verified_at: string | null;
  verification_status: string;
  featured: boolean;
  tags: string[];
};

/** Parses the stored comma-separated tag list into clean strings. */
export function parseNewsTags(value: unknown): string[] {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}
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

// Built-in CBT practice catalog.
//
// DEVELOPMENT PREVIEW ONLY. When Supabase credentials are configured, the
// production `cbt_exams` table is the single source of truth and this array
// is never rendered. It exists so the CBT flow can be exercised locally
// without a backend; it is not production content.
const fallbackCbtExams = [
  {
    id: 'practice-exam-jamb',
    title: 'JAMB UTME Comprehensive Practice',
    exam_body: 'JAMB',
    subject: 'General Practice & Use of English',
    description: 'Local preview question bank used when no CBT catalogue is configured.',
    duration_minutes: 30,
  },
  {
    id: 'practice-exam-waec',
    title: 'WAEC Senior Certificate Revision',
    exam_body: 'WAEC',
    subject: 'Use of English',
    description: 'Local preview question bank used when no CBT catalogue is configured.',
    duration_minutes: 45,
  },
  {
    id: 'practice-exam-neco',
    title: 'NECO SSCE Comprehensive Practice',
    exam_body: 'NECO',
    subject: 'Mathematics',
    description: 'Local preview question bank used when no CBT catalogue is configured.',
    duration_minutes: 40,
  },
  {
    id: 'practice-exam-post-utme',
    title: 'Federal Universities Post-UTME Screening',
    exam_body: 'POST-UTME',
    subject: 'Aptitude & General Studies',
    description: 'Local preview question bank used when no CBT catalogue is configured.',
    duration_minutes: 25,
  },
];

// DEVELOPMENT PREVIEW ONLY — used exclusively when no Supabase backend is
// configured (see fetchCbtQuestions). Production question pools always come
// from `exam_questions` rows managed in the Admin CBT console.
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

const API_BASE_PATH = import.meta.env.PROD ? '/.netlify/functions/api' : '/api';

function apiPath(path: string): string {
  if (!path.startsWith('/api/')) return path;
  return `${API_BASE_PATH}${path.slice('/api'.length)}`;
}

async function jsonFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const requestInput = typeof input === 'string' ? apiPath(input) : input;
    response = await fetch(requestInput, init);
  } catch {
    throw new Error('Please check your internet connection and try again.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(userFacingError(body?.error, 'We could not complete that request. Please try again.'));
  return body as T;
}




// The full active service catalogue — form services, in-app routes and
// external links, in admin-controlled order. Without a configured backend the
// code-defined four form services are shown so local QA stays honest.
export async function fetchServices(): Promise<ServiceItem[]> {
  if (!isSupabaseConfigured) return fallbackServicesCatalog;

  const { data, error } = await supabase
    .from('service_catalog')
    .select('id,service_key,title,description,application_url,route,category,sort_order,active')
    .eq('active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true });
  if (error) throw new Error(userFacingError(error));
  return (data || []) as ServiceItem[];
}

export async function fetchService(slug: string): Promise<ServiceItem> {
  // The database catalogue contains planned and historical products as well as
  // the four workflows that are currently supported by this student hub. Keep
  // direct deep links subject to the same catalogue boundary as /services so an
  // active but unsupported row cannot accidentally render the NELFUND form.
  const normalizedSlug = slug.trim().toLowerCase();
  const supportedSlugs = new Set(hubServices.map((service) => service.slug));
  if (!supportedSlugs.has(normalizedSlug)) {
    throw new Error('This service is not available. Browse the services catalogue for active student services.');
  }

  if (!isSupabaseConfigured) {
    const item = fallbackServicesCatalog.find((s) => s.service_key === normalizedSlug);
    if (item) return item;
    throw new Error('This service is not available. Browse the services catalogue for active student services.');
  }

  const { data, error } = await supabase
    .from('service_catalog')
    .select('id,service_key,title,description,application_url,active')
    .eq('service_key', normalizedSlug)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  if (data && supportedSlugs.has(data.service_key)) return data as ServiceItem;
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
  if (!isSupabaseConfigured) return fallbackCbtExams;

  const { data, error } = await supabase
    .from('cbt_exams')
    .select('id,title,exam_body,subject,description,duration_minutes')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function startCbt(examId: string, durationMinutes = 30): Promise<CbtStartResponse> {
  if (isSupabaseConfigured) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const startedAt = new Date();
      return {
        attemptId: `guest-cbt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt: startedAt.toISOString(),
        expiresAt: new Date(startedAt.getTime() + durationMinutes * 60 * 1000).toISOString(),
        totalQuestions: 0,
        guest: true,
      };
    }

    const { data, error } = await supabase.rpc('start_cbt_attempt', { p_exam_id: examId });
    if (error || !data?.length) throw new Error(userFacingError(error, 'Unable to start this CBT practice session.'));
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
    expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
    totalQuestions: practiceQuestions.length,
  };
}

export async function submitCbt(payload: CbtSubmitPayload): Promise<CbtSubmitResponse> {
  if (isSupabaseConfigured) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const guestResult = await jsonFetch<any>('/api/cbt/guest-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: payload.examId, answers: payload.answers }),
      });
      try {
        localStorage.setItem(localStorageKey(`cbt-result-${guestResult.attemptId}`), JSON.stringify(guestResult));
        localStorage.setItem(localStorageKey('last-cbt-attempt'), guestResult.attemptId);
      } catch {
        // localStorage may be disabled
      }
      return guestResult;
    }

    const { data, error } = await supabase.rpc('submit_cbt_attempt', {
      p_attempt_id: payload.attemptId,
      p_exam_id: payload.examId,
      p_answers: payload.answers,
    });
    if (error || !data?.length) throw new Error(userFacingError(error, 'CBT submission failed.'));
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
  const fallbackExam = fallbackCbtExams.find((exam) => exam.id === payload.examId);
  const resultData = {
    exam: fallbackExam ? { title: fallbackExam.title, exam_body: fallbackExam.exam_body, subject: fallbackExam.subject, duration_minutes: fallbackExam.duration_minutes } : null,
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
    localStorage.setItem(localStorageKey(`cbt-result-${payload.attemptId}`), JSON.stringify(resultData));
    localStorage.setItem(localStorageKey('last-cbt-attempt'), payload.attemptId);
  } catch {
    // localStorage may be disabled
  }

  return { attemptId: payload.attemptId, score, breakdown };
}

export async function fetchCbtQuestions(examId: string) {
  if (!isSupabaseConfigured) {
    const examMeta = fallbackCbtExams.find((e) => e.id === examId);
    if (!examMeta) throw new Error('This CBT exam is not available. Choose another question bank.');
    return {
      exam: { id: examId, title: examMeta.title, durationMinutes: examMeta.duration_minutes, subject: examMeta.subject },
      questions: practiceQuestions,
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const guest = await jsonFetch<any>(`/api/cbt/exams/${encodeURIComponent(examId)}/guest-questions`);
    return {
      exam: { id: guest.exam.id, title: guest.exam.title, examBody: guest.exam.examBody, durationMinutes: guest.exam.durationMinutes, subject: guest.exam.subject },
      questions: guest.questions,
    };
  }

  const { data: exam, error: examError } = await supabase.from('cbt_exams').select('id,title,exam_body,duration_minutes,subject').eq('id', examId).eq('is_active', true).maybeSingle();
  if (examError) throw examError;
  if (!exam) throw new Error('This CBT exam is not available. Choose another question bank.');

  const { data: questions, error: questionError } = await supabase.rpc('get_cbt_questions', { p_exam_id: examId });
  if (questionError) throw questionError;
  if (!questions?.length) throw new Error('This CBT exam has no questions yet. Choose another question bank.');

  return {
    exam: { id: exam.id, title: exam.title, examBody: exam.exam_body, durationMinutes: exam.duration_minutes, subject: exam.subject },
    questions: questions.map((q: any) => ({ id: q.position, text: q.question_text, options: [q.option_a, q.option_b, q.option_c, q.option_d] })),
  };
}

export type CbtAttemptProgress = { answers: Record<number, number>; questionIndex?: number };

export async function fetchCbtAttemptProgress(attemptId: string): Promise<CbtAttemptProgress> {
  if (!isSupabaseConfigured || !attemptId || attemptId.startsWith('guest-cbt-')) return { answers: {} };
  const headers = await authHeaders();
  if (!headers.Authorization) return { answers: {} };
  const body = await jsonFetch<{ answers: Record<string, number>; questionIndex?: number }>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/progress`, { headers });
  return {
    answers: Object.fromEntries(Object.entries(body.answers || {}).map(([key, value]) => [Number(key), value])),
    questionIndex: Number.isInteger(body.questionIndex) ? body.questionIndex : undefined,
  };
}

export async function saveCbtAttemptProgress(attemptId: string, answers: Record<number, number>, questionIndex?: number): Promise<void> {
  if (!isSupabaseConfigured || !attemptId || attemptId.startsWith('guest-cbt-')) return;
  const headers = await authHeaders();
  if (!headers.Authorization) return;
  await jsonFetch(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ answers, questionIndex }),
  });
}

function readLocalCbtResult(attemptId: string): any | null {
  try {
    const direct = localStorage.getItem(localStorageKey(`cbt-result-${attemptId}`));
    if (direct) return JSON.parse(direct);
    const suffix = `:cbt-result-${attemptId}`;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('edureach-local:') && key.endsWith(suffix)) {
        const stored = localStorage.getItem(key);
        if (stored) return JSON.parse(stored);
      }
    }
  } catch {
    // localStorage may be disabled
  }
  return null;
}

export async function fetchCbtResult(attemptId: string) {
  const localResult = readLocalCbtResult(attemptId);
  if (localResult && (attemptId.startsWith('guest-cbt-') || !isSupabaseConfigured)) return localResult;

  if (isSupabaseConfigured) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in to view this CBT result.');

    const { data, error } = await supabase.rpc('get_cbt_result', { p_attempt_id: attemptId });
    if (error) throw new Error(userFacingError(error));
    if (!data?.length) throw new Error('No CBT result was found for this attempt.');

    const first = data[0];
    const { data: exam } = await supabase
      .from('cbt_exams')
      .select('id,title,exam_body,subject,duration_minutes')
      .eq('id', first.exam_id)
      .maybeSingle();
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
    return { attempt, exam: exam || null, answers, questions };
  }

  try {
    const resultSuffix = `:cbt-result-${attemptId}`;
    const candidateKeys = new Set<string>([localStorageKey(`cbt-result-${attemptId}`)]);
    // A completed scorecard is a direct, shareable destination. Allow a guest
    // to reopen it with the exact attempt id even after signing out, without
    // exposing the current student's entire result list.
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('edureach-local:') && key.endsWith(resultSuffix)) candidateKeys.add(key);
    }
    for (const key of candidateKeys) {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    }
  } catch {
    // localStorage may be disabled
  }

  throw new Error('No CBT result was found for this attempt. Complete a CBT practice session to generate a scorecard.');
}

export async function submitServiceRequest(payload: ServiceSubmitPayload) {
  const supportedSlugs = new Set(hubServices.map((service) => service.slug));
  const normalizedSlug = payload.serviceSlug.trim().toLowerCase();
  if (!supportedSlugs.has(normalizedSlug)) {
    throw new Error('This service is not available. Browse the services catalogue for active student services.');
  }

  if (isSupabaseConfigured) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in before submitting a service request.');

    const { data: service, error: serviceError } = await supabase
      .from('service_catalog')
      .select('id, service_key, title')
      .eq('service_key', normalizedSlug)
      .eq('active', true)
      .maybeSingle();
    if (serviceError) throw serviceError;
    if (!service) throw new Error('This service is no longer accepting requests. Browse the services catalogue for active services.');

    const { data, error } = await supabase
      .from('service_requests')
      .insert({ user_id: user.id, service_id: service.id, status: 'submitted', form_data: payload.details })
      .select('id, reference_code, created_at, status')
      .single();
    if (error) throw error;
    if (!data) throw new Error('The service request could not be created.');
    return data;
  }

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
    const existing = JSON.parse(localStorage.getItem(localStorageKey('service-requests')) || '[]');
    existing.unshift(localRecord);
    localStorage.setItem(localStorageKey('service-requests'), JSON.stringify(existing));
  } catch {
    // localStorage may be disabled
  }

  return localRecord;
}

export async function fetchNews(): Promise<NewsItem[]> {
  // No hardcoded news dataset: without a configured account service the page
  // shows its honest empty state; with one configured, Supabase is the only
  // source of what students read.
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('news_articles')
    .select('id,slug,title,excerpt,body,category,image_url,source_url,source_name,published_at,updated_at,published,featured,tags')
    .eq('published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(30);
  if (error) throw error;
  return (data || []).map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    summary: item.excerpt,
    body: item.body,
    category: item.category,
    priority: 'normal',
    source_url: item.source_url,
    image_url: item.image_url ?? null,
    published_at: item.published_at,
    author: item.source_name || 'EduReach Editorial Desk',
    last_verified_at: item.updated_at,
    verification_status: 'verified',
    featured: item.featured === true,
    tags: parseNewsTags(item.tags),
  }));
}

export async function fetchNewsItem(slug: string): Promise<NewsItem> {
  if (!isSupabaseConfigured) {
    throw new Error('News is not configured in this environment.');
  }

  const { data, error } = await supabase
    .from('news_articles')
    .select('id,slug,title,excerpt,body,category,image_url,source_url,source_name,published_at,updated_at,published,featured,tags')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) throw new Error(userFacingError(error));
  if (!data) throw new Error('This news article could not be found.');
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    summary: data.excerpt,
    body: data.body,
    category: data.category,
    priority: 'normal',
    source_url: data.source_url,
    image_url: data.image_url ?? null,
    published_at: data.published_at,
    author: data.source_name || 'EduReach Editorial Desk',
    last_verified_at: data.updated_at,
    verification_status: 'verified',
    featured: data.featured === true,
    tags: parseNewsTags(data.tags),
  };
}

export type AdminActivityBreakdown = {
  since: string;
  topPages: Array<{ path: string; views: number }>;
  topSearches: Array<{ term: string; count: number }>;
  serviceViews: Array<{ path: string; views: number }>;
  serviceSubmits: Array<{ path: string; count: number }>;
  cbtStarts: Array<{ exam: string; count: number }>;
  eventsTotal: number;
};

export type AdminAnalytics = {
  metrics: Record<string, number>;
  activity: AdminActivityBreakdown | null;
  audit: Array<Record<string, unknown>>;
  recentRequests: Array<Record<string, any>>;
  recentUsers: Array<Record<string, any>>;
};

export type AdminService = {
  id: string; service_key: string; title: string; description: string | null;
  application_url: string | null; route: string | null; category: string | null;
  sort_order: number | null; active: boolean; is_form_service?: boolean;
};

export async function fetchAdminServices(): Promise<AdminService[]> {
  const body = await adminApiFetch<{ items: AdminService[] }>('/api/admin/services');
  return body.items || [];
}

export async function createAdminService(values: Record<string, unknown>): Promise<AdminService> {
  const body = await adminApiFetch<{ item: AdminService }>('/api/admin/services', { method: 'POST', body: JSON.stringify(values) });
  return body.item;
}

export async function deleteAdminService(serviceId: string): Promise<void> {
  await adminApiFetch(`/api/admin/services/${encodeURIComponent(serviceId)}`, { method: 'DELETE' });
}

// ---- Opportunities (scholarships / grants / jobs) ---------------------------

export type Opportunity = {
  id: string; title: string; organisation: string | null; category: string;
  description: string | null; link_url: string | null; deadline: string | null;
  locations: string | null; is_active?: boolean; created_at?: string; updated_at?: string;
};

export async function fetchOpportunities(): Promise<Opportunity[]> {
  if (!isSupabaseConfigured) return [];
  const body = await jsonFetch<{ items: Opportunity[] }>('/api/opportunities');
  return body.items || [];
}

export async function fetchAdminOpportunities(): Promise<Opportunity[]> {
  const body = await adminApiFetch<{ items: Opportunity[] }>('/api/admin/opportunities');
  return body.items || [];
}

export async function createAdminOpportunity(values: Record<string, unknown>): Promise<Opportunity> {
  const body = await adminApiFetch<{ item: Opportunity }>('/api/admin/opportunities', { method: 'POST', body: JSON.stringify(values) });
  return body.item;
}

export async function updateAdminOpportunity(id: string, values: Record<string, unknown>): Promise<Opportunity> {
  const body = await adminApiFetch<{ item: Opportunity }>(`/api/admin/opportunities/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(values) });
  return body.item;
}

export async function deleteAdminOpportunity(id: string): Promise<void> {
  await adminApiFetch(`/api/admin/opportunities/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const body = await jsonFetch<AdminAnalytics>('/api/admin/analytics', { headers });
  return body;
}

// Generic authenticated admin fetch for endpoints without a dedicated wrapper.
export async function adminApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  return await jsonFetch<T>(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers, ...(init.headers || {}) },
  });
}

export async function bootstrapAdmin(): Promise<void> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Sign in with the configured administrator account first.');
  await jsonFetch('/api/admin/bootstrap', { method: 'POST', headers });
}

export type AdminUser = { id: string; full_name: string; school: string; faculty: string; department: string; level: string; role: string; matric_number: string | null; created_at: string; suspended?: boolean };

export async function fetchAdminUsers(search = ''): Promise<AdminUser[]> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const body = await jsonFetch<{ items: AdminUser[] }>(`/api/admin/users${query}`, { headers });
  return body.items || [];
}

export type AdminServiceRequest = { id: string; user_id: string; status: string; form_data: Record<string, unknown>; created_at: string; updated_at: string; reference_code?: string | null; admin_note?: string | null; service_catalog?: { title: string } | null };

export async function fetchAdminServiceRequests(status = 'all'): Promise<AdminServiceRequest[]> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const body = await jsonFetch<{ items: AdminServiceRequest[] }>(`/api/admin/service-requests?status=${encodeURIComponent(status)}`, { headers });
  return body.items || [];
}

export async function updateAdminServiceRequest(requestId: string, patch: string | { status?: string; admin_note?: string | null }) {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const body = typeof patch === 'string' ? { status: patch } : patch;
  return await jsonFetch<{ item: { id: string; status: string; admin_note: string | null; updated_at: string } }>(`/api/admin/service-requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

export type AdminNewsArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string;
  image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  published: boolean;
  published_at: string | null;
  featured?: boolean;
  tags?: string | null;
  updated_at: string;
};

export type AdminNewsInput = {
  title: string;
  slug?: string;
  excerpt?: string | null;
  body: string;
  category?: string;
  image_url?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  published?: boolean;
  published_at?: string | null;
  featured?: boolean;
  tags?: string | null;
};

export async function fetchAdminNews(): Promise<AdminNewsArticle[]> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const body = await jsonFetch<{ items: AdminNewsArticle[] }>('/api/admin/news', { headers });
  return body.items || [];
}

export async function createAdminNews(input: AdminNewsInput): Promise<AdminNewsArticle> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const body = await jsonFetch<{ item: AdminNewsArticle }>('/api/admin/news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(input),
  });
  return body.item;
}

export async function updateAdminNews(id: string, input: Partial<AdminNewsInput>): Promise<AdminNewsArticle> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const body = await jsonFetch<{ item: AdminNewsArticle }>(`/api/admin/news/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(input),
  });
  return body.item;
}

export async function deleteAdminNews(id: string): Promise<void> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  await jsonFetch(`/api/admin/news/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
}

// ---------------------------------------------------------------------------
// Real-usage telemetry. The server allowlist accepts page_view, service_view,
// service_submit, cbt_start, cbt_submit and search; events land in
// site_analytics_events through the same-origin API. Failures are silent —
// analytics must never break the student experience.
// ---------------------------------------------------------------------------

export type TelemetryEvent = 'page_view' | 'service_view' | 'service_submit' | 'cbt_start' | 'cbt_submit' | 'search';

export function analyticsSessionId(): string {
  const key = 'edureach-analytics-session';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
    return value;
  } catch {
    return `session-${Date.now().toString(36)}`;
  }
}

export function trackEvent(eventName: TelemetryEvent, payload: { path?: string; metadata?: Record<string, unknown> } = {}) {
  try {
    void fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event_name: eventName,
        path: payload.path ?? window.location.pathname,
        session_id: analyticsSessionId(),
        metadata: payload.metadata || {},
      }),
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Admin control-centre API wrappers (calendar, institutions, services,
// account suspension, uploads). All require an admin bearer session and hit
// the same-origin Express API, which performs the role check server-side.
// ---------------------------------------------------------------------------

export type AdminCalendarItem = {
  id: string; title: string; description: string | null;
  due_at?: string | null; starts_at?: string | null; ends_at?: string | null;
  location?: string | null; priority: string; status: string; created_at: string;
};

export async function fetchAdminCalendarItems(type: 'deadline' | 'exam'): Promise<AdminCalendarItem[]> {
  const body = await adminApiFetch<{ items: AdminCalendarItem[] }>(`/api/admin/calendar-items?type=${type}`);
  return body.items || [];
}

export async function createAdminCalendarItem(type: 'deadline' | 'exam', values: Record<string, unknown>): Promise<AdminCalendarItem> {
  const body = await adminApiFetch<{ item: AdminCalendarItem }>(`/api/admin/calendar-items?type=${type}`, { method: 'POST', body: JSON.stringify(values) });
  return body.item;
}

export async function updateAdminCalendarItem(type: 'deadline' | 'exam', id: string, values: Record<string, unknown>): Promise<AdminCalendarItem> {
  const body = await adminApiFetch<{ item: AdminCalendarItem }>(`/api/admin/calendar-items/${encodeURIComponent(id)}?type=${type}`, { method: 'PATCH', body: JSON.stringify(values) });
  return body.item;
}

export async function deleteAdminCalendarItem(type: 'deadline' | 'exam', id: string): Promise<void> {
  await adminApiFetch(`/api/admin/calendar-items/${encodeURIComponent(id)}?type=${type}`, { method: 'DELETE' });
}

export type AdminInstitution = { id: string; school_name: string; acronym: string | null; slug: string | null; state: string | null; institution_type: string | null; website_url: string | null; admission_portal_url: string | null; student_portal_url: string | null; is_verified: boolean; created_at?: string; updated_at?: string };

export async function fetchAdminInstitutions(search = ''): Promise<AdminInstitution[]> {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const body = await adminApiFetch<{ items: AdminInstitution[] }>(`/api/admin/institutions${query}`);
  return body.items || [];
}

export async function createAdminInstitution(values: Record<string, unknown>): Promise<AdminInstitution> {
  const body = await adminApiFetch<{ item: AdminInstitution }>('/api/admin/institutions', { method: 'POST', body: JSON.stringify(values) });
  return body.item;
}

export async function updateAdminInstitution(id: string, values: Record<string, unknown>): Promise<AdminInstitution> {
  const body = await adminApiFetch<{ item: AdminInstitution }>(`/api/admin/institutions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(values) });
  return body.item;
}

export async function deleteAdminInstitution(id: string): Promise<void> {
  await adminApiFetch(`/api/admin/institutions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function updateAdminService(serviceId: string, values: Record<string, unknown>): Promise<AdminService> {
  const body = await adminApiFetch<{ item: AdminService }>(`/api/admin/services/${encodeURIComponent(serviceId)}`, { method: 'PATCH', body: JSON.stringify(values) });
  return body.item;
}

export type AdminUserActivity = {
  requests: Array<{ id: string; reference_code: string | null; status: string; created_at: string; service_catalog?: { title: string } | null }>;
  attempts: Array<{ id: string; status: string; score: number | null; started_at: string; submitted_at: string | null; cbt_exams?: { title: string } | null }>;
  requestError?: string | null;
  attemptError?: string | null;
};

export async function fetchAdminUserActivity(userId: string): Promise<AdminUserActivity> {
  return await adminApiFetch<AdminUserActivity>(`/api/admin/users/${encodeURIComponent(userId)}/activity`);
}

export async function setUserSuspended(userId: string, suspended: boolean): Promise<void> {
  await adminApiFetch(`/api/admin/users/${encodeURIComponent(userId)}/${suspended ? 'ban' : 'unban'}`, { method: 'POST' });
}

export async function uploadAdminImage(dataUrl: string): Promise<{ url: string; path: string; bytes: number }> {
  return await adminApiFetch<{ url: string; path: string; bytes: number }>('/api/admin/uploads', {
    method: 'POST',
    body: JSON.stringify({ dataUrl }),
  });
}

// ---------------------------------------------------------------------------
// Admin CBT exam management (duration/default settings, active state, delete).
// Question management lives on the exam detail endpoints above.
// ---------------------------------------------------------------------------

export type AdminCbtExam = {
  id: string;
  title: string;
  exam_body: string;
  subject: string;
  description: string | null;
  duration_minutes: number;
  is_active: boolean;
  created_at?: string;
};

export async function fetchAdminCbtExams(): Promise<AdminCbtExam[]> {
  const body = await adminApiFetch<{ items: AdminCbtExam[] }>('/api/admin/cbt/exams');
  return body.items || [];
}

export async function updateAdminCbtExam(examId: string, values: Partial<Omit<AdminCbtExam, 'id' | 'created_at'>>): Promise<AdminCbtExam> {
  const body = await adminApiFetch<{ item: AdminCbtExam }>(`/api/admin/cbt/exams/${encodeURIComponent(examId)}`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  });
  return body.item;
}

export async function deleteAdminCbtExam(examId: string): Promise<void> {
  await adminApiFetch(`/api/admin/cbt/exams/${encodeURIComponent(examId)}`, { method: 'DELETE' });
}
