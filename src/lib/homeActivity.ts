/**
 * UX-7 - the home screen's "what has happened" layer.
 *
 * A student opening the product should see their own recent work before they
 * see a catalogue. This module keeps that summary pure so the rule can be
 * tested without a browser: only finished attempts count as a paper, scores are
 * averaged only when they are real numbers, and a subject is counted once even
 * if it appears in several papers.
 */
import { cbtAttemptState, summarizeCbtAttempts } from './dashboardPriority';
import { localStorageKey } from './localPreview';

export type HomeAttempt = {
  id: string;
  status?: string | null;
  mode?: string | null;
  exam_id?: string | null;
  expires_at?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  score?: number | null;
  total_questions?: number | null;
  selected_subjects?: unknown;
  subject_plan?: unknown;
};

export type HomeSummary = {
  papers: number;
  averageScore: number | null;
  bestScore: number | null;
  subjects: number;
};

function subjectNames(attempt: HomeAttempt): string[] {
  const values: string[] = [];
  for (const raw of [attempt.selected_subjects, attempt.subject_plan]) {
    if (Array.isArray(raw)) {
      for (const item of raw) if (typeof item === 'string' && item.trim()) values.push(item.trim());
    } else if (raw && typeof raw === 'object') {
      for (const key of Object.keys(raw as Record<string, unknown>)) {
        if (key.trim()) values.push(key.trim());
      }
    }
  }
  return values;
}

export function summarizeHomeActivity(attempts: HomeAttempt[]): HomeSummary {
  const summary = summarizeCbtAttempts(attempts);
  const subjects = new Set<string>();
  for (const attempt of summary.completedAttempts) {
    for (const subject of subjectNames(attempt)) subjects.add(subject.toLowerCase());
  }
  return {
    papers: summary.completedAttempts.length,
    averageScore: summary.averageScore,
    bestScore: summary.bestScore,
    subjects: subjects.size,
  };
}

/** Newest first, using the submitted time where the paper has one. */
export function recentHomeAttempts(attempts: HomeAttempt[], limit = 3): HomeAttempt[] {
  return [...attempts]
    .sort((a, b) => {
      const aTime = new Date(a.submitted_at || a.created_at || 0).getTime();
      const bTime = new Date(b.submitted_at || b.created_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, limit);
}

/**
 * A short, honest label. A bank id is not a human exam name, so an unknown id
 * becomes "CBT practice" rather than leaking a uuid into the UI.
 */
export function homeAttemptLabel(attempt: HomeAttempt): string {
  const raw = String(attempt.exam_id || attempt.mode || '').trim().toLowerCase();
  const known: Array<[string, string]> = [
    ['jamb', 'JAMB'],
    ['waec', 'WAEC'],
    ['neco', 'NECO'],
    ['nabteb', 'NABTEB'],
    ['post-utme', 'Post-UTME'],
    ['post utme', 'Post-UTME'],
  ];
  for (const [needle, label] of known) {
    if (raw.includes(needle)) return `${label} practice`;
  }
  return 'CBT practice';
}

/** The result page for a submitted paper, the session for a live one, and the
 *  history for an expired/cancelled attempt that has no result to open. */
export function homeAttemptHref(attempt: HomeAttempt): string {
  const state = cbtAttemptState(attempt);
  if (state === 'active') return `/cbt/session/${encodeURIComponent(attempt.id)}`;
  if (attempt.submitted_at || typeof attempt.score === 'number') {
    return `/dashboard/cbt/results/${encodeURIComponent(attempt.id)}`;
  }
  return '/dashboard/cbt';
}

/**
 * Preview fallback. The unconfigured build keeps finished papers in the same
 * scoped local keys the dashboard reads, so the home summary must read those
 * rather than show an empty record to a student who has just sat a paper.
 */
export function readLocalHomeAttempts(): HomeAttempt[] {
  const attempts: HomeAttempt[] = [];
  try {
    const prefix = localStorageKey('cbt-result-');
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const stored = JSON.parse(localStorage.getItem(key) || 'null') as {
        attempt?: Record<string, unknown>;
        exam?: { title?: string; subject?: string };
        questions?: unknown[];
      } | null;
      const raw = stored?.attempt;
      if (!raw) continue;
      attempts.push({
        id: String(raw.id || key.slice(prefix.length)),
        status: 'submitted',
        exam_id: typeof raw.exam_id === 'string' ? raw.exam_id : stored?.exam?.title || stored?.exam?.subject,
        submitted_at: typeof raw.submitted_at === 'string' ? raw.submitted_at : null,
        created_at: typeof raw.created_at === 'string' ? raw.created_at : typeof raw.started_at === 'string' ? raw.started_at : null,
        score: typeof raw.score === 'number' ? raw.score : null,
        total_questions: Number(raw.total_questions || stored?.questions?.length || 0) || null,
        selected_subjects: raw.selected_subjects,
        subject_plan: raw.subject_plan,
      });
    }
  } catch {
    // storage unavailable or malformed
  }
  return attempts;
}
