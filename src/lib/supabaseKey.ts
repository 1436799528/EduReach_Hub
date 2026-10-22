/**
 * Is this Supabase key one that must never run in a browser?
 *
 * Defence in depth, not the primary control. The primary control is that a
 * secret never goes into a `VITE_*` variable at all (Vite inlines those into the
 * bundle, so anyone who loads the site can read it). This predicate exists for
 * the day that rule is broken by mistake: if a privileged key is pasted into
 * `VITE_SUPABASE_PUBLISHABLE_KEY`, the browser client must refuse to start with
 * it rather than ship a key that bypasses every RLS policy to every visitor.
 *
 * Two key formats have to be recognised, and only one of them was:
 *
 *   - legacy JWT keys (`eyJ…`) carry their role in the payload: a service-role
 *     key says `"role":"service_role"`;
 *   - current secret keys are opaque and start with `sb_secret_`. They are not
 *     JWTs, so the payload check below cannot see them - `lib/supabase-config.ts`
 *     already recognises the prefix on the server, and this keeps the two in
 *     agreement.
 *
 * Publishable keys (`sb_publishable_…`) and legacy anon JWTs are public by
 * design and pass through. The key itself is never logged or thrown with.
 */

/** Prefix Supabase uses for server-only secret keys (not a JWT). */
const SECRET_KEY_PREFIX = 'sb_secret_';

/** Published, safe-for-the-browser prefixes. */
const PUBLIC_KEY_PREFIXES = ['sb_publishable_', 'sb_temp_'];

/**
 * True when the key is privileged - a secret key or a service-role JWT - and
 * therefore must not be used by a browser client.
 */
export function isPrivilegedKey(key: string | undefined | null): boolean {
  const value = (key || '').trim();
  if (!value) return false;
  if (value.startsWith(SECRET_KEY_PREFIX)) return true;
  if (PUBLIC_KEY_PREFIXES.some((prefix) => value.startsWith(prefix))) return false;

  try {
    // base64url -> base64, then read only the role claim.
    const payload = String(value.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/');
    if (!payload) return false;
    const claims = JSON.parse(atob(payload)) as { role?: unknown };
    return claims?.role === 'service_role';
  } catch {
    // Not a JWT this code can read: not provably privileged, and the client's
    // own unconfigured path is the safe outcome for anything unusable.
    return false;
  }
}
