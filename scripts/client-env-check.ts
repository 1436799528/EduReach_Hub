/**
 * Enforce the browser Supabase configuration before a production build.
 * The guard prevents a deployed site from looking functional while silently
 * keeping student submissions only in the visitor's browser.
 */
import 'dotenv/config';
import { hasPrivilegedClientValue } from './client-secret-guard';

/** Vite inlines only VITE_-prefixed variables into the browser bundle. */
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
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY && !env.VITE_SUPABASE_ANON_KEY) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  const productionContext = env.VERCEL_ENV === 'production' || env.CONTEXT === 'production';
  const explicit = env.EDUREACH_REQUIRE_CLIENT_ENV === '1';
  const privilegedClientValue = hasPrivilegedClientValue(env);
  const enforced = productionContext || explicit || privilegedClientValue;
  const reason = explicit
    ? 'EDUREACH_REQUIRE_CLIENT_ENV=1'
    : productionContext
      ? (env.VERCEL_ENV === 'production' ? 'VERCEL_ENV=production' : 'CONTEXT=production')
      : 'not a production build';

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
    console.log(`ok   client Supabase contract is satisfied (${configured})`);
    return;
  }
  if (verdict.enforced) {
    console.error(
      `\\nFAIL client Supabase contract is unmet (${verdict.reason}).\\n` +
        `     Missing: ${verdict.missing.join(', ')}\\n` +
        '     A production build without these deploys a site that looks complete but\\n' +
        '     persists nothing: applications and exam attempts are kept only in the\\n' +
        '     visitor\\'s browser. Set them in the Vercel build environment, then build again.\\n',
    );
    process.exitCode = 1;
    return;
  }
  console.warn(
    `\\nWARN client Supabase contract is unmet (${verdict.reason}); continuing.\\n` +
      `     Missing: ${verdict.missing.join(', ')}\\n` +
      '     This is a local/non-production build: the app uses local fallbacks and\\n' +
      '     nothing a visitor submits is persisted. A production Vercel build will\\n' +
      '     refuse to build in this state.\\n',
  );
}

if (process.argv[1] && process.argv[1].endsWith('client-env-check.ts')) {
  main();
}
