/** Enforce browser Supabase configuration before a production build. */
import 'dotenv/config';
import { hasPrivilegedClientValue } from './client-secret-guard';
import { isPrivilegedKey } from '../src/lib/supabaseKey';

export const CLIENT_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;

/**
 * The two public values the browser needs, from either the Vite names or the
 * unprefixed names a host may already provide. A host that sets
 * `SUPABASE_URL` + `SUPABASE_ANON_KEY` has a working public configuration; the
 * build inlines these two values into the bundle (see `vite.config.ts`). The
 * service-role key is never read here.
 */
export function clientSupabaseEnv(env: Record<string, string | undefined>): {
  url?: string;
  key?: string;
} {
  const value = (...names: string[]) => names.map((name) => env[name]?.trim()).find(Boolean);
  return {
    url: value('VITE_SUPABASE_URL', 'SUPABASE_URL'),
    key: value(
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_ANON_KEY',
    ),
  };
}

export interface ClientEnvVerdict {
  ok: boolean;
  missing: string[];
  enforced: boolean;
  reason: string;
  privilegedClientValue: boolean;
}

export function evaluateClientEnv(env: Record<string, string | undefined>): ClientEnvVerdict {
  const client = clientSupabaseEnv(env);
  const missing: string[] = [];
  if (!client.url) missing.push('VITE_SUPABASE_URL');
  if (!client.key) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  const productionContext = env.VERCEL_ENV === 'production' || env.CONTEXT === 'production';
  const explicit = env.EDUREACH_REQUIRE_CLIENT_ENV === '1';
  // A privileged key under an unprefixed name would be inlined by the build,
  // which is exactly the mistake this guard exists to stop.
  const privilegedClientValue = hasPrivilegedClientValue(env) || Boolean(client.key && isPrivilegedKey(client.key));
  // A host whose site settings are outside this repository may need to publish
  // an unconfigured build (the app renders its honest offline state). That is
  // an explicit, named opt-out and never bypasses the privileged-key refusal.
  const allowUnconfigured = env.EDUREACH_ALLOW_UNCONFIGURED_CLIENT === '1';
  const enforced = privilegedClientValue || (!allowUnconfigured && (productionContext || explicit));
  const reason = explicit
    ? 'EDUREACH_REQUIRE_CLIENT_ENV=1'
    : allowUnconfigured
      ? 'EDUREACH_ALLOW_UNCONFIGURED_CLIENT=1'
      : productionContext
        ? 'Vercel production build'
        : 'not a production build';
  return { ok: missing.length === 0 && !privilegedClientValue, missing, enforced, reason, privilegedClientValue };
}

function main(): void {
  const verdict = evaluateClientEnv(process.env);
  const configured = CLIENT_VARS.join(' + ') + ' (or VITE_SUPABASE_ANON_KEY)';
  if (verdict.privilegedClientValue) {
    console.error(
      'FAIL privileged Supabase key in client-exposed configuration. Remove it from VITE_ variables before building.',
    );
    process.exitCode = 1;
    return;
  }
  if (verdict.ok) {
    console.log('ok   client Supabase contract is satisfied (' + configured + ')');
    return;
  }
  const details = 'Missing: ' + verdict.missing.join(', ');
  if (verdict.enforced) {
    console.error(
      'FAIL client Supabase contract is unmet (' +
        verdict.reason +
        '). ' +
        details +
        '. Production builds must not deploy without browser Supabase configuration.',
    );
    process.exitCode = 1;
    return;
  }
  console.warn(
    'WARN client Supabase contract is unmet (' +
      verdict.reason +
      '). ' +
      details +
      '. This local build uses fallbacks; visitor submissions will not persist.',
  );
}

if (process.argv[1] && process.argv[1].endsWith('client-env-check.ts')) main();
