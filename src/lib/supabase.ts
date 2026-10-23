import { createClient } from '@supabase/supabase-js';
import { isPrivilegedKey } from './supabaseKey';

const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : (typeof process !== 'undefined' ? process.env : {});

const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL) as string | undefined;
const supabaseKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY) as string | undefined;

// Defence in depth: a privileged key bypasses RLS and must never run in a
// browser, even if pasted into a VITE_ variable by mistake. The predicate lives
// in `src/lib/supabaseKey.ts` so it can be tested directly, and so the server's
// key rules and the browser's cannot drift: it refuses both the legacy
// service_role JWT and the current `sb_secret_` key format.
//
// A refused key falls through to the unconfigured fallback below, so the site
// renders its offline state instead of ever using the secret key.
const safeSupabaseKey = isPrivilegedKey(supabaseKey) ? undefined : supabaseKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && safeSupabaseKey);

// In frontend-first / preview environments without active Supabase credentials,
// provide an inert fallback client so the bundle doesn't crash on initial load.
const effectiveUrl = supabaseUrl || 'https://edureach-unconfigured.supabase.co';
const effectiveKey = safeSupabaseKey || 'anon-key-unconfigured-frontend-preview';

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

