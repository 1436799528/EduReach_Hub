import { supabase, isSupabaseConfigured } from './supabase';
import { hubServices, newsItems as fallbackNews } from '../data/hubContent';
import { localStorageKey } from './localPreview';

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

// Real photography for the built-in news feed (Supabase rows carry their own image_url)
const fallbackNewsPhotos: Record<string, string> = {
  'jamb-caps-status-guide': '/news/photos/jamb-cbt.jpg',
  'nelfund-student-loan-checklist': '/news/photos/nelfund.webp',
  'waec-neco-result-checking': '/news/photos/waec-result.png',
  'campus-gist-week': '/news/photos/campus.jpg',
  'student-opportunities': '/news/photos/graduates.jpg',
};

const fallbackNewsAuthors: Record<string, string> = {
  'jamb-caps-status-guide': 'EduReach Exams Desk',
  'nelfund-student-loan-checklist': 'EduReach Student Funding Desk',
  'waec-neco-result-checking': 'EduReach Exams Desk',
  'campus-gist-week': 'EduReach Campus Desk',
  'student-opportunities': 'EduReach Opportunities Desk',
};

/** Built-in stories are guides, not live announcements. Keep the full explainer available offline. */
const fallbackNewsBodies: Record<string, string> = {
  'jamb-caps-status-guide': `JAMB CAPS is the admission-status area where a candidate can review an admission offer and follow the next instruction shown on the official JAMB portal. The exact options available to a candidate depend on the current admission cycle and the candidate's record, so this guide is for orientation rather than a substitute for the official portal.

Start with the basics: confirm that you are on the official JAMB website, sign in with the details attached to your registration, and check that the name, registration number and examination year shown on the profile are yours. Do not hand over your password or profile code to a third party who promises to change an admission outcome.

When an offer appears, read the institution and course carefully before taking an action. A candidate should understand the difference between checking an offer, accepting it and declining it. If the page is not loading or the details look inconsistent, save a screenshot and contact JAMB or the institution through an official support channel before making an irreversible choice.

After checking CAPS, keep the evidence you may need later: the status page, admission letter instructions, school screening notice and any payment receipt issued through the official portal. EduReach can help you organise questions for a service request, but it cannot create an admission offer or replace the institution's published instructions.

Before the next deadline, compare the course requirements with your O-Level subjects, confirm the institution's current registration window and use only the official links supplied by JAMB or the school. Requirements and menus can change between admission cycles, so verify them again before submitting anything.`,
  'nelfund-student-loan-checklist': `A NELFUND application is a funding request, not an automatic award. Before starting, organise the information that the official NELFUND portal asks for and make sure your institution and programme details match the records held by your school.

Prepare access to an active email address and phone number, your student or matriculation information, admission or institutional details, and any identity or banking information requested on the live application. Do not upload a document simply because an unofficial message asks for it; first read the current requirement on the official portal.

Complete the form slowly and review every field before submitting. Names, registration numbers, institution, department and session should be consistent with your school record. If a required field is unavailable or your institution is not listed, stop and confirm the correct process with NELFUND or your institution rather than selecting a random entry.

After submission, keep the reference or confirmation message and monitor the status from the same official account. A request may require institutional verification or additional information, and an approval should not be assumed until the official system shows it.

EduReach can help you prepare a checklist and organise a guided request. We do not approve loans, ask for a password or guarantee funding. Check the current NELFUND notice for eligibility, deadlines, repayment information and the active application URL before you proceed.`,
  'waec-neco-result-checking': `Result checking should begin on the official WAEC or NECO channel for the examination year. A result checker token, PIN or candidate detail is private information, so avoid sending it in public groups or to an unverified agent.

Before entering any details, confirm the examination body, candidate number, examination year and the exact result-checking instructions. Keep your token or PIN safe and make sure the name and candidate number you enter match the registration record. Repeated failed attempts can create avoidable support problems.

If the result page reports that a result is unavailable, withheld or requires a different checker route, do not conclude that the result has been cancelled. Save the exact message, check the official help guidance and contact the examination body or your school using a verified channel.

Download or print the result statement only from the official flow when it becomes available, and keep a private copy for admission or scholarship applications. Do not pay a social-media contact who promises to alter a grade or release a result outside the examination body's process.

This is a safety and preparation guide. Result availability, fees and checker requirements change, so confirm the active WAEC or NECO notice before using a token or submitting a request.`,
  'campus-gist-week': `A useful campus update is one a student can trace to an official notice, a named institution or a clearly identified event organiser. This weekly guide helps you sort the updates competing for your attention without treating an unverified rumour as a confirmed announcement.

Begin with the deadlines that affect you directly: registration, course forms, screening, examinations, accommodation and bursary applications. Check the school website, student portal, faculty noticeboard or verified communication channel for the original notice and record the closing date in a place you will revisit.

For a campus event or opportunity, confirm the organiser, venue, eligibility, cost and contact details before sharing it. Be especially careful with messages that demand a transfer to a personal account, request a password or promise admission in exchange for an urgent payment.

When an update cannot be confirmed, EduReach will keep it labelled as unverified or leave it out rather than present it as fact. Students can send the original notice for review, but should still rely on their institution's official channel for a final decision.`,
  'student-opportunities': `A ready application folder can save time when a verified scholarship, internship or campus opportunity opens. Keep a clean copy of your current CV, a short personal statement, academic results, identification documents and a record of your institution and programme, while sharing only what the application genuinely requires.

Use clear filenames and check that your phone number, email address, course, level and session are current. If a referee or institutional letter is needed, request it early and confirm the required format. Do not reuse a document with an old registration number or deadline without checking it.

Before applying, verify the organisation, eligibility, closing date, official application URL and any stated cost. A genuine listing should explain what is being offered and how applications are assessed. Treat requests for passwords, unexplained fees or guaranteed selection as warning signs.

EduReach lists opportunities only when the available details can be checked. If a category has no verified listing, that means there is no confirmed item in the current catalogue—not that every opportunity has been searched or that a student is ineligible. Recheck the page and the organiser's official channel before a deadline.`,
};

const fallbackNewsItems: NewsItem[] = fallbackNews.map((n, index) => ({
  id: `news-${n.slug}-${index + 1}`,
  slug: n.slug,
  title: n.title,
  summary: n.excerpt,
  body: fallbackNewsBodies[n.slug] || `${n.excerpt}\n\nCheck the current official notice for requirements, deadlines and the correct application route. EduReach does not replace the examination body, institution or organiser's published instructions.`,
  category: n.tag.toLowerCase().replace(/[\s/]+/g, '_'),
  priority: 'normal',
  source_url: null,
  image_url: fallbackNewsPhotos[n.slug] ?? null,
  published_at: new Date(Date.now() - index * 86400000 * 2).toISOString(),
  author: fallbackNewsAuthors[n.slug] || 'EduReach Editorial Desk',
  last_verified_at: n.verified ? new Date().toISOString() : null,
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
  if (!isSupabaseConfigured) return fallbackServicesCatalog;

  const { data, error } = await supabase
    .from('service_catalog')
    .select('id,service_key,title,description,application_url,active')
    .eq('active', true)
    .order('title');
  if (error) throw error;
  const supportedSlugs = new Set(hubServices.map((service) => service.slug));
  return ((data || []) as ServiceItem[]).filter((service) => supportedSlugs.has(service.service_key));
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
    .select('id,title,exam_body,subject,duration_minutes')
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
    if (error) throw error;
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
  if (!isSupabaseConfigured) return fallbackNewsItems;

  const { data, error } = await supabase
    .from('news_articles')
    .select('id,slug,title,excerpt,body,category,image_url,source_url,source_name,published_at,updated_at,published')
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
  }));
}

export async function fetchNewsItem(slug: string): Promise<NewsItem> {
  if (!isSupabaseConfigured) {
    const match = fallbackNewsItems.find((n) => n.slug === slug);
    if (match) return match;
    throw new Error('This news article could not be found.');
  }

  const { data, error } = await supabase
    .from('news_articles')
    .select('id,slug,title,excerpt,body,category,image_url,source_url,source_name,published_at,updated_at,published')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) throw error;
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

export async function fetchAdminUsers(search = ''): Promise<AdminUser[]> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const body = await jsonFetch<{ items: AdminUser[] }>(`/api/admin/users${query}`, { headers });
  return body.items || [];
}

export type AdminServiceRequest = { id: string; user_id: string; status: string; form_data: Record<string, unknown>; created_at: string; updated_at: string; reference_code?: string | null; service_catalog?: { title: string } | null };

export async function fetchAdminServiceRequests(status = 'all'): Promise<AdminServiceRequest[]> {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  const body = await jsonFetch<{ items: AdminServiceRequest[] }>(`/api/admin/service-requests?status=${encodeURIComponent(status)}`, { headers });
  return body.items || [];
}

export async function updateAdminServiceRequest(requestId: string, status: string) {
  const headers = await authHeaders();
  if (!headers.Authorization) throw new Error('Administrator session required.');
  return await jsonFetch<{ item: { id: string; status: string; updated_at: string } }>(`/api/admin/service-requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ status }),
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
