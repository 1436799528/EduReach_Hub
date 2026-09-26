/** Accept modern secret keys and legacy service-role JWTs, never browser keys.
 * JWT decoding here identifies configuration only; Supabase verifies the key.
 */
export function getServerSupabaseKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '').trim();
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
