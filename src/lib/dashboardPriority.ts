/**
 * DASH-1 — "what matters to me right now?".
 *
 * The dashboard used to lead with static profile details and treat every
 * `in_progress` attempt as resumable, even one the server had already expired.
 * Both made the page describe state instead of helping the student act.
 *
 * This module holds the two rules that decide that, as pure functions, so they
 * can be tested without a browser:
 *
 *   1. `cbtAttemptState` — an attempt is only resumable while its own
 *      server-issued expiry is in the future. The server enforces the same
 *      rule; this keeps the card from promising something the server will
 *      refuse.
 *   2. `dashboardPriorities` — an ordered, capped list of what to do next,
 *      most time-critical first. It never invents a task: every item is derived
 *      from state the page already loaded, and when there is nothing to do it
 *      says so with a single sensible next step.
 */

export type CbtAttemptLike = {
  id: string;
  status?: string | null;
  expires_at?: string | null;
  submitted_at?: string | null;
  score?: number | null;
  subject?: string | null;
  exam_id?: string | null;
};

export type AttemptState = 'active' | 'expired' | 'finished';

/**
 * Whether an attempt can still be resumed, ran out of time, or is a record.
 *
 * `status === 'expired'` is what the server writes when it expires an attempt
 * on read; a stored `in_progress` row whose `expires_at` has passed is the same
 * thing one clock tick before the server notices.
 */
export function cbtAttemptState(attempt: CbtAttemptLike, now: number = Date.now()): AttemptState {
  const status = String(attempt.status || '').toLowerCase();
  if (status === 'expired') return 'expired';
  if (status !== 'in_progress' && status !== 'started') return 'finished';
  const expiresAt = attempt.expires_at ? new Date(attempt.expires_at).getTime() : Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= now) return 'expired';
  return 'active';
}

/** Whole minutes left, or null when there is no usable expiry. Never negative. */
export function minutesRemaining(expiresAt?: string | null, now: number = Date.now()): number | null {
  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.max(0, Math.floor((target - now) / 60_000));
}

/**
 * A phrase a student can act on. Returns null when the attempt states no
 * expiry, so the caller can say "in progress" rather than guess a number.
 */
export function remainingLabel(expiresAt?: string | null, now: number = Date.now()): string | null {
  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  if (!Number.isFinite(target)) return null;
  if (target <= now) return 'Time is up';
  const minutes = minutesRemaining(expiresAt, now) ?? 0;
  if (minutes < 1) return 'Less than a minute left';
  if (minutes === 1) return '1 minute left';
  return `${minutes} minutes left`;
}

export type PriorityTone = 'urgent' | 'attention' | 'next';

export type PriorityItem = {
  id: string;
  tone: PriorityTone;
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export type DashboardPriorityInput = {
  now?: number;
  profileComplete: boolean;
  /** Labels of the profile fields that are still empty, for an exact message. */
  profileMissing?: string[];
  attempts?: CbtAttemptLike[];
  requests?: Array<{ status: string; reference_code?: string | null }>;
  unreadNotifications?: number;
  savedCount?: number;
  /** 1-based position, so the first step can be worded as "your first". */
  attemptCount?: number;
};

const MAX_ITEMS = 3;

const FINISHED_REQUEST_STATUSES = new Set(['completed', 'closed', 'rejected', 'cancelled']);

function listMissing(labels: string[]): string {
  const shown = labels.slice(0, 3);
  const extra = labels.length - shown.length;
  // A comma list when a count follows ("A, B, C, and 3 more"), a conjunction
  // when it ends the sentence ("A and B").
  if (extra > 0) return `${shown.join(', ')}, and ${extra} more`;
  if (shown.length <= 1) return shown[0] || '';
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

export function dashboardPriorities(input: DashboardPriorityInput): PriorityItem[] {
  const now = input.now ?? Date.now();
  const items: PriorityItem[] = [];

  // 1. Time-critical: a test that is running and will be lost when the clock
  //    runs out. Least time left first.
  const resumable = (input.attempts || [])
    .map((attempt) => ({ attempt, state: cbtAttemptState(attempt, now) }))
    .filter((entry) => entry.state === 'active')
    .sort((a, b) => {
      const left = (value: CbtAttemptLike) => new Date(value.expires_at || '').getTime() || Number.POSITIVE_INFINITY;
      return left(a.attempt) - left(b.attempt);
    });
  if (resumable.length > 0) {
    const { attempt } = resumable[0];
    const left = remainingLabel(attempt.expires_at, now);
    items.push({
      id: 'resume-attempt',
      tone: 'urgent',
      title: resumable.length > 1 ? `Finish your ${attempt.subject || 'practice test'} — ${resumable.length - 1} more open` : `Finish your ${attempt.subject || 'practice test'}`,
      detail: left
        ? `${left}. Your answers are saved, so you can pick up exactly where you stopped.`
        : 'Your answers are saved, so you can pick up exactly where you stopped.',
      href: `/cbt/session/${encodeURIComponent(attempt.id)}`,
      cta: 'Resume test',
    });
  }

  // 2. EduReach is waiting on the student: the request cannot move without them.
  const blocked = (input.requests || [])
    .filter((request) => String(request.status).toLowerCase() === 'awaiting_information')
    .sort((a, b) => String(a.reference_code).localeCompare(String(b.reference_code)));
  if (blocked.length > 0) {
    const request = blocked[0];
    items.push({
      id: 'request-needs-info',
      tone: 'attention',
      title: blocked.length > 1 ? `${blocked.length} requests need your information` : 'A request needs more information',
      detail: `EduReach cannot continue ${request.reference_code ? `request ${request.reference_code}` : 'your request'} until you answer the question on it.`,
      href: request.reference_code ? `/dashboard/services?ref=${encodeURIComponent(request.reference_code)}` : '/dashboard/services',
      cta: 'Answer now',
    });
  }

  // 3. Personalisation is blocked until the academic profile is complete.
  const missing = input.profileMissing || [];
  if (!input.profileComplete) {
    items.push({
      id: 'profile-incomplete',
      tone: 'attention',
      title: 'Finish your academic profile',
      detail: missing.length
        ? `Still missing: ${listMissing(missing)}. Exam guidance and school matching use these details.`
        : 'Exam guidance and school matching need your institution, course and level.',
      href: '/profile',
      cta: 'Complete profile',
    });
  }

  // 4. Unread notices, only when nothing above is more pressing.
  if ((input.unreadNotifications || 0) > 0 && items.length < MAX_ITEMS) {
    const count = input.unreadNotifications || 0;
    items.push({
      id: 'unread-notifications',
      tone: 'attention',
      title: count === 1 ? 'One unread notification' : `${count} unread notifications`,
      detail: 'Status changes on the requests you submitted appear here first.',
      href: '/dashboard',
      cta: 'Read them',
    });
  }

  // 5. Nothing needs the student: one honest next step rather than an empty box.
  if (items.length === 0) {
    if ((input.attemptCount ?? (input.attempts || []).length) === 0) {
      items.push({
        id: 'first-practice',
        tone: 'next',
        title: 'Take your first practice test',
        detail: 'Pick a question bank, choose how many questions and how long, then practise under the real timer.',
        href: '/cbt',
        cta: 'Start practising',
      });
    } else if ((input.savedCount || 0) === 0) {
      items.push({
        id: 'shortlist-schools',
        tone: 'next',
        title: 'Shortlist the institutions you are considering',
        detail: 'Saved schools sit in Tools & Saved with your CGPA calculator, so you can compare before you apply.',
        href: '/dashboard/tools',
        cta: 'Open School Finder',
      });
    } else {
      items.push({
        id: 'browse-papers',
        tone: 'next',
        title: 'Browse past questions and papers',
        detail: 'Verified papers open from the library; anything not published yet can be requested from EduReach.',
        href: '/past-questions',
        cta: 'Open library',
      });
    }
  }

  return items.slice(0, MAX_ITEMS);
}
