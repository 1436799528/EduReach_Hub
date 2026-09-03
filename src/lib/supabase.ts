import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function decodeBase64Safe(str: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(str);
    }
  } catch {
    // Ignore error
  }
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'base64').toString('utf-8');
    }
  } catch {
    // Ignore error
  }
  return '';
}

function parseProjectRefFromJwt(token?: string | null): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const jsonStr = decodeBase64Safe(parts[1]);
    if (!jsonStr) return null;
    const payload = JSON.parse(jsonStr);
    if (payload && payload.iss === 'supabase' && typeof payload.ref === 'string') {
      const ref = payload.ref.trim();
      if (/^[a-z0-9_-]+$/i.test(ref)) {
        return ref;
      }
    }
  } catch {
    // Ignore error
  }
  return null;
}

function getSanitizedSupabaseUrl(urlCandidate?: string | null, keyCandidate?: string | null): string | null {
  if (urlCandidate && typeof urlCandidate === 'string') {
    const trimmed = urlCandidate.trim();
    if (
      trimmed &&
      trimmed !== 'undefined' &&
      trimmed !== 'null' &&
      !trimmed.startsWith('sb_secret_') &&
      !trimmed.startsWith('sb_token_')
    ) {
      try {
        const withProtocol = trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : `https://${trimmed}`;
        const parsed = new URL(withProtocol);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.origin;
        }
      } catch {
        // Fall through to JWT fallback
      }
    }
  }

  // Fallback: If VITE_SUPABASE_URL was misconfigured or invalid, derive the URL from the anon JWT ref
  const projectRef = parseProjectRefFromJwt(keyCandidate);
  if (projectRef) {
    return `https://${projectRef}.supabase.co`;
  }

  return null;
}

function initSupabase(): SupabaseClient | null {
  const resolvedUrl = getSanitizedSupabaseUrl(rawSupabaseUrl, rawSupabaseAnonKey);
  const resolvedKey = rawSupabaseAnonKey?.trim();

  if (!resolvedUrl || !resolvedKey || resolvedKey === 'undefined' || resolvedKey === 'null') {
    return null;
  }

  try {
    return createClient(resolvedUrl, resolvedKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error);
    return null;
  }
}

export const supabase: SupabaseClient | null = initSupabase();

export const isSupabaseConfigured = Boolean(supabase);

export function isValidUuid(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
