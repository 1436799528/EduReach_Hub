import { isPrivilegedKey } from '../src/lib/supabaseKey';

/** Vite exposes VITE_ values to browser code, even if runtime use is refused.
 * This catches known formats and secret-like names; it cannot recognize every
 * possible provider credential. Never put any secret in a client variable. */
export function hasPrivilegedClientValue(env: Record<string, unknown>): boolean {
  return Object.entries(env).some(([name, value]) => {
    if (!name.startsWith('VITE_') || typeof value !== 'string' || !value.trim()) return false;
    // A secret-looking variable name is unsafe even if its value uses an
    // unknown key format. All VITE_ variables are exposed, not just those used.
    if (/_(?:SECRET(?:_KEY)?|SERVICE_ROLE(?:_KEY)?|PRIVATE_KEY)$/i.test(name) || /^VITE_SUPABASE_SERVICE_KEY$/i.test(name)) return true;
    // Values may contain a secret within a URL or JSON rather than being a
    // bare key. Never include the value (or a matching fragment) in an error.
    if (value.includes('sb_secret_') || isPrivilegedKey(value)) return true;
    return (value.match(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []).some(isPrivilegedKey);
  });
}
