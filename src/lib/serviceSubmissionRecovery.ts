// Extends the existing account-scoped session draft; it does not make browser
// storage an authorization boundary or deduplicate independent tabs/devices.
export type PendingServiceSubmission = { key: string; details: Record<string, unknown> };
const UNAVAILABLE = 'Your request draft is unavailable in this browser. No new submission was sent. Check My Requests before starting again.';
const CHANGED = 'Review the previous submission details before retrying. They may already have been received.';

export function draftKeyForAccount(userId: string, slug: string): string {
  return `edureach-service-draft-v2:${encodeURIComponent(userId)}:${encodeURIComponent(slug.trim().toLowerCase())}`;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function load(key: string): Record<string, unknown> {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!record(parsed)) throw new Error('invalid');
    if ('pending' in parsed && parsed.pending !== undefined) {
      if (!record(parsed.pending) || typeof parsed.pending.key !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.pending.key)
        || !record(parsed.pending.details)) throw new Error('invalid');
    }
    return parsed;
  } catch { throw new Error(UNAVAILABLE); }
}

export function readPendingSubmission(key: string): PendingServiceSubmission | null {
  return (load(key).pending as PendingServiceSubmission | undefined) || null;
}

export function saveServiceDraft(key: string, form: object, step: number): void {
  try {
    const existing = load(key);
    sessionStorage.setItem(key, JSON.stringify({ ...existing, form, step }));
  } catch { throw new Error(UNAVAILABLE); }
}

export function prepareServiceSubmission(key: string, details: Record<string, unknown>): PendingServiceSubmission {
  const existing = load(key);
  let encodedDetails: string;
  try { encodedDetails = JSON.stringify(details); } catch { throw new Error(UNAVAILABLE); }
  const pending = existing.pending as PendingServiceSubmission | undefined;
  if (pending) {
    if (JSON.stringify(pending.details) !== encodedDetails) throw new Error(CHANGED);
    return pending;
  }
  try {
    const value: PendingServiceSubmission = { key: crypto.randomUUID(), details: JSON.parse(encodedDetails) as Record<string, unknown> };
    const encoded = JSON.stringify({ ...existing, pending: value });
    sessionStorage.setItem(key, encoded);
    if (sessionStorage.getItem(key) !== encoded) throw new Error('not persisted');
    return value;
  } catch { throw new Error(UNAVAILABLE); }
}
