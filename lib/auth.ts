import { createClient, type User } from '@supabase/supabase-js';

export interface UserPayload {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'student';
}

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'moderator']);

function getServerSupabase() {
  const url = process.env.VITE_SUPABASE_URL || 'https://gjdfatwcoosyuhakrrhh.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function extractBearerToken(authorization?: string | string[]) {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

export async function verifyJWT(token: string): Promise<UserPayload | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const user = data.user as User;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const profileRole = String(profile?.role || 'student');
  const role: UserPayload['role'] = ADMIN_ROLES.has(profileRole) ? 'admin' : 'student';

  return {
    id: user.id,
    email: user.email || '',
    fullName: String(profile?.full_name || user.user_metadata?.full_name || ''),
    role,
  };
}

export async function verifyAdminToken(token: string) {
  const user = await verifyJWT(token);
  return user?.role === 'admin' ? user : null;
}
