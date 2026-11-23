/**
 * Accept modern secret keys and legacy service-role JWTs, never browser keys.
 * Prefer the modern secret key so an exposed legacy service-role key cannot
 * shadow it when both environment variables are configured.
 * JWT decoding here identifies configuration only; Supabase verifies the key.
 */
export function getServerSupabaseKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (key.startsWith('sb_secret_')) return key;
  const parts = key.split('.');
  if (parts.length !== 3) return '';
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.role === 'service_role' ? key : '';
  } catch {
    return '';
  }
}

/**
 * The Supabase project origin the server talks to.
 *
 * Public by definition — it is in every browser bundle — so it is read from
 * whichever public name the deployment provides. `EDUREACH_PUBLIC_SUPABASE_URL`
 * exists for a platform that cannot clear a mistaken "secret" flag on the
 * original variable: the pair can be re-created under a name that says what it
 * is. No credential is read here.
 */
export function getServerSupabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.VITE_SUPABASE_URL || env.EDUREACH_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '').trim();
}

/**
 * The publishable (anon) key for a user-scoped client.
 *
 * Ownership-critical RPCs resolve the caller from `auth.uid()`, which requires a
 * user-scoped client rather than the service-role one. A privileged key is
 * rejected here as well: this value is only ever used with a caller's token, and
 * a secret key would silently run every request as the owner of the database.
 */
export function getPublicSupabaseKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = (
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.EDUREACH_PUBLIC_SUPABASE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!key) return '';
  if (key.startsWith('sb_secret_')) return '';
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') return '';
    } catch {
      return '';
    }
  }
  return key;
}
