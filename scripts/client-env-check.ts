/** Enforce browser Supabase configuration before a production build. */
import 'dotenv/config';
import { hasPrivilegedClientValue } from './client-secret-guard';

export const CLIENT_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;

export interface ClientEnvVerdict {
  ok: boolean;
  missing: string[];
  enforced: boolean;
  reason: string;
  privilegedClientValue: boolean;
}

export function evaluateClientEnv(env: Record<string, string | undefined>): ClientEnvVerdict {
  const missing: string[] = [];
  if (!env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY && !env.VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  const productionContext = env.VERCEL_ENV === 'production' || env.CONTEXT === 'production';
  const explicit = env.EDUREACH_REQUIRE_CLIENT_ENV === '1';
  const privilegedClientValue = hasPrivilegedClientValue(env);
  const enforced = productionContext || explicit || privilegedClientValue;
  const reason = explicit ? 'EDUREACH_REQUIRE_CLIENT_ENV=1' : productionContext ? 'Vercel production build' : 'not a production build';
  return { ok: missing.length === 0 && !privilegedClientValue, missing, enforced, reason, privilegedClientValue };
}

function main(): void {
  const verdict = evaluateClientEnv(process.env);
  const configured = CLIENT_VARS.join(' + ') + ' (or VITE_SUPABASE_ANON_KEY)';
  if (verdict.privilegedClientValue) {
    console.error('FAIL privileged Supabase key in client-exposed configuration. Remove it from VITE_ variables before building.');
    process.exitCode = 1;
    return;
  }
  if (verdict.ok) {
    console.log('ok   client Supabase contract is satisfied (' + configured + ')');
    return;
  }
  const details = 'Missing: ' + verdict.missing.join(', ');
  if (verdict.enforced) {
    console.error('FAIL client Supabase contract is unmet (' + verdict.reason + '). ' + details + '. Production builds must not deploy without browser Supabase configuration.');
    process.exitCode = 1;
    return;
  }
  console.warn('WARN client Supabase contract is unmet (' + verdict.reason + '). ' + details + '. This local build uses fallbacks; visitor submissions will not persist.');
}

if (process.argv[1] && process.argv[1].endsWith('client-env-check.ts')) main();
