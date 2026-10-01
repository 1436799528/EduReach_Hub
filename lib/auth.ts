import { getServerSupabaseKey } from './supabase-config';
import { createClient, type User } from '@supabase/supabase-js';
import {
  capabilitiesForRole,
  isStaffRole,
  resolveAppRole,
  type AppRole,
  type Capability,
} from '../src/lib/capabilities';

/**
 * The resolved caller. Everything authorization needs is derived here, from the
 * validated Supabase session plus the trusted `profiles` row:
 *
 *  - `role`      coarse, kept for existing call sites and tests ('admin' | 'student');
 *  - `appRole`   the application role used for capability lookups;
 *  - `capabilities` the resolved capability list (see src/lib/capabilities.ts).
 *
 * User-editable `user_metadata` is never consulted for authorization.
 */
export interface UserPayload {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'student';
  appRole: AppRole;
  capabilities: Capability[];
}

type ServerSupabase = ReturnType<typeof createClient> | null;

function getServerSupabase(): ServerSupabase {
  const url = process.env.VITE_SUPABASE_URL;
  const key = getServerSupabaseKey();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function extractBearerToken(authorization?: string | string[]) {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

export async function verifyJWT(token: string): Promise<UserPayload | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const user = data.user as User;
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();
  // A missing or unreadable profile row must never grant staff access.
  if (profileError) return null;
  const profile = profileData as { role?: unknown; full_name?: unknown } | null;

  const appRole = resolveAppRole(profile?.role);
  const capabilities = [...capabilitiesForRole(appRole)];

  return {
    id: user.id,
    email: user.email || '',
    fullName: String(profile?.full_name || user.user_metadata?.full_name || ''),
    role: isStaffRole(appRole) ? 'admin' : 'student',
    appRole,
    capabilities,
  };
}

/** Any staff capability means the account may use the admin console. */
export async function verifyAdminToken(token: string) {
  const user = await verifyJWT(token);
  if (!user) return null;
  return isStaffRole(user.appRole) ? user : null;
}
