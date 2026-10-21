/**
 * Server-side Supabase client, created once per (url, key) pair.
 *
 * Previously every authenticated request constructed two brand-new Supabase
 * clients (service-role + a second one inside `verifyJWT`). The client is
 * stateless over HTTP and safe to share, so we cache it for the life of the
 * process instead of paying its allocation (and a fresh HTTP agent) per call.
 *
 * Every outbound request also carries a 10-second abort. Without it a hung
 * PostgREST/Auth call pinned the web request until the platform killed it;
 * with it the failure surfaces promptly as an error the route maps to 503,
 * so the student sees "connection problem, try again" instead of a spinner
 * or a misleading 400.
 */
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseKey } from './supabase-config';

export const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;


/** Fetch with a hard timeout, combined with any caller-provided signal. */
export function supabaseFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = SUPABASE_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}

function buildServerClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => supabaseFetch(input, init) },
  });
}

let cached: { url: string; key: string; client: ReturnType<typeof buildServerClient> } | null = null;

/** The shared service-role client, or null when Supabase is not configured. */
export function getServerSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = getServerSupabaseKey();
  if (!url || !key) return null;
  if (!cached || cached.url !== url || cached.key !== key) {
    cached = { url, key, client: buildServerClient(url, key) };
  }
  return cached.client;
}
