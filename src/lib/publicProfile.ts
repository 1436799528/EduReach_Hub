/**
 * UI-5 — the public profile model.
 *
 * A shared link must show an approved subset of a student's academic identity
 * and nothing else. The whitelist lives here, in one function, so the API
 * response, the page and the tests cannot disagree about what "public" means.
 *
 * Deliberately absent: id, email, phone, matric number, JAMB registration
 * number, role, wallet, examination history and notifications.
 */

export const PUBLIC_PROFILE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{5,31}$/;

export type PublicProfileRow = {
  full_name?: string | null;
  school?: string | null;
  course_programme?: string | null;
  department?: string | null;
  faculty?: string | null;
  level?: string | null;
  avatar_url?: string | null;
  public_profile_slug?: string | null;
};

export type PublicProfile = {
  full_name: string;
  school: string;
  /** The student's programme. Department/faculty are only a fallback label. */
  course_programme: string;
  level: string;
  avatar_url: string | null;
  slug: string;
  /** True only when the account's email is confirmed. Never assumed. */
  email_verified: boolean;
};

/** The columns the server may select; `id` is used for verification, not returned. */
export const PUBLIC_PROFILE_SELECT = [
  'id',
  'full_name',
  'school',
  'course_programme',
  'department',
  'faculty',
  'level',
  'avatar_url',
  'public_profile_slug',
].join(',');

function text(value: unknown, max = 160): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function projectPublicProfile(row: PublicProfileRow, emailVerified = false): PublicProfile {
  return {
    full_name: text(row.full_name, 80) || 'EduReach student',
    school: text(row.school, 120),
    // Only the approved academic fields leave the server. Department and
    // faculty can fill an empty programme label, but they are never returned
    // as separate facts.
    course_programme: text(row.course_programme || row.department || row.faculty, 120),
    level: text(row.level, 40),
    avatar_url: /^https?:\/\//i.test(text(row.avatar_url, 500)) ? text(row.avatar_url, 500) : null,
    slug: text(row.public_profile_slug, 32),
    email_verified: Boolean(emailVerified),
  };
}

/**
 * A readable prefix plus random entropy. The prefix helps a student recognise
 * their own link; the suffix stops one student's URL being guessable from
 * another's name. Shorter than 32 characters, so it always satisfies the
 * database constraint.
 */
export function generatePublicProfileSlug(displayName: string): string {
  const prefix = String(displayName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12) || 'student';
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(6);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `${prefix}-${suffix}`;
}
