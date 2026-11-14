/**
 * AUTH-1 — the sign-in methods the page offers.
 *
 * The page itself owns layout and validation messages. This module owns the
 * provider calls, phone normalisation and the small amount of vocabulary needed
 * to turn a provider failure into a sentence a student can act on.
 *
 * Google, Apple and phone authentication are Supabase features and must be
 * enabled in the project before they can succeed. The UI still offers them
 * because a missing provider is a configuration state, not a reason to hide a
 * method the product supports. The failure message says so instead of blaming
 * the person clicking the button.
 */

import { isSupabaseConfigured, supabase } from './supabase';

export type SocialProvider = 'google' | 'apple';

export const SOCIAL_PROVIDERS: Array<{
  value: SocialProvider;
  label: string;
  /** The sentence shown while the redirect is being prepared. */
  busyLabel: string;
}> = [
  { value: 'google', label: 'Continue with Google', busyLabel: 'Opening Google…' },
  { value: 'apple', label: 'Continue with Apple', busyLabel: 'Opening Apple…' },
];

/**
 * Turn a typed number into E.164 where the intent is unambiguous.
 *
 * Nigerian local numbers (080…) become +234…; anything already carrying a
 * country code is kept. A bare 10-digit number without a country code cannot
 * be assigned safely, so it is rejected and the hint asks for one. This avoids
 * silently attaching a random country to a student's phone.
 */
export function normalizePhone(input: string): string {
  const raw = String(input || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
  return '';
}

export function isValidPhone(input: string): boolean {
  return Boolean(normalizePhone(input));
}

type PhoneMetadata = Record<string, unknown>;

function phoneFailure(error: unknown): string {
  const message = String((error as { message?: string } | null)?.message || '').toLowerCase();
  if (/not configured|unsupported phone|sms provider|phone provider/.test(message)) {
    return 'Phone verification is not configured yet. Use email or Google/Apple for now.';
  }
  if (/signups? not allowed|signup.*disabled/.test(message)) {
    return 'Phone sign-up is not open yet. Use email to create your account.';
  }
  if (/rate limit|too many/.test(message)) {
    return 'Too many attempts. Wait a minute, then try again.';
  }
  if (/invalid.*phone|phone.*invalid/.test(message)) {
    return 'That phone number was not accepted. Include the country code, for example +234 801 234 5678.';
  }
  return 'We could not send or verify that code. Check the number and try again.';
}

export async function sendPhoneCode(
  input: string,
  intent: 'signin' | 'signup',
  metadata?: PhoneMetadata,
): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('Phone sign-in needs the live EduReach account service. It is not configured in this preview.');
  }
  const phone = normalizePhone(input);
  if (!phone) {
    throw new Error('Enter a phone number with its country code, for example +234 801 234 5678.');
  }
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: intent === 'signup',
      data: metadata,
    },
  });
  if (error) throw new Error(phoneFailure(error));
  return phone;
}

export async function verifyPhoneCode(input: string, token: string) {
  const phone = normalizePhone(input);
  const code = String(token || '').replace(/\D/g, '');
  if (!phone) throw new Error('Enter the phone number that received the code.');
  if (code.length < 4 || code.length > 8) throw new Error('Enter the code from the text message.');
  if (!isSupabaseConfigured) {
    throw new Error('Phone verification needs the live EduReach account service. It is not configured in this preview.');
  }
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
  if (error) throw new Error(phoneFailure(error));
  return data;
}

export async function startSocialSignIn(
  provider: SocialProvider,
  nextPath: string,
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Social sign-in needs the live EduReach account service. It is not configured in this preview.');
  }
  const label = provider === 'google' ? 'Google' : 'Apple';
  const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });
  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (/not enabled|unsupported provider|provider is not enabled/.test(message)) {
      throw new Error(`${label} sign-in is not enabled yet. Use email or phone for now.`);
    }
    throw new Error(`${label} sign-in could not start. Try email or phone instead.`);
  }
}
