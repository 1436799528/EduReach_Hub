/**
 * AUTH-1 — record consent that was given before an OAuth redirect.
 *
 * Google and Apple return the browser to /login with a session; at that point
 * the original form state is gone. The checkbox was still a real, explicit
 * action, so the timestamp is written to storage before the redirect and
 * settled against the account when the session appears. If storage is
 * unavailable the consent is not claimed: the account keeps no
 * `terms_agreed_at`, and the next sign-in can ask again.
 */

import { supabase } from './supabase';

export const PENDING_TERMS_KEY = 'edureach-pending-terms-acceptance';

function stores(): Storage[] {
  if (typeof window === 'undefined') return [];
  return [window.sessionStorage, window.localStorage].filter(Boolean);
}

export function markPendingTermsAcceptance(at = new Date().toISOString()): boolean {
  for (const store of stores()) {
    try {
      store.setItem(PENDING_TERMS_KEY, at);
      return true;
    } catch {
      // Try the next available store.
    }
  }
  return false;
}

function readPendingTermsAcceptance(): string {
  for (const store of stores()) {
    try {
      const value = store.getItem(PENDING_TERMS_KEY);
      if (value) return value;
    } catch {
      // Try the next available store.
    }
  }
  return '';
}

function clearPendingTermsAcceptance(): void {
  for (const store of stores()) {
    try { store.removeItem(PENDING_TERMS_KEY); } catch { /* unavailable */ }
  }
}

/**
 * Best effort: the account is already signed in, so a failed metadata write
 * must not block navigation. The marker is removed only after both writes
 * succeed so a later visit can retry.
 */
export async function settlePendingTermsAcceptance(userId: string): Promise<boolean> {
  const at = readPendingTermsAcceptance();
  if (!at || !userId) return false;

  const { error: metadataError } = await supabase.auth.updateUser({
    data: { terms_agreed: true, terms_agreed_at: at, account_type: 'student' },
  });
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ terms_agreed_at: at })
    .eq('id', userId);

  if (metadataError || profileError) return false;
  clearPendingTermsAcceptance();
  return true;
}

/**
 * Null means the check could not be made (offline, RLS, missing row); the
 * caller must not interpret that as refusal. False means the account exists and
 * has no recorded acceptance.
 */
export async function readTermsAcceptance(userId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('terms_agreed_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    if (!data) return null;
    return Boolean((data as { terms_agreed_at?: string | null }).terms_agreed_at);
  } catch {
    return null;
  }
}
