import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : (typeof process !== 'undefined' ? process.env : {});

const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL) as string | undefined;
const supabaseKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY) as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// In frontend-first / preview environments without active Supabase credentials,
// provide a resilient fallback client so the bundle doesn't crash on initial load.
const effectiveUrl = supabaseUrl || 'https://mock-edureach.supabase.co';
const effectiveKey = supabaseKey || 'mock-anon-key-frontend-preview';

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

