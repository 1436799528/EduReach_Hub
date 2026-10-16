/**
 * P2-1 — the client contract, enforced at build time.
 *
 * `src/lib/supabase.ts` never throws: with `VITE_SUPABASE_URL` and a
 * publishable key missing at build time, the deployed site still renders a
 * complete-looking product, and a student can "apply" for a service or "sit" an
 * exam that is never persisted. The server knows the truth
 * (`/api/health/ready` → 503 degraded); nothing at the client end did.
 *
 * This check runs first in `npm run build`. It fails the build only when the
 * build is a production deployment (`CONTEXT=production`, which Netlify sets for
 * the production context) or when a caller opts in explicitly
 * (`EDUREACH_REQUIRE_CLIENT_ENV=1`, for a self-hosted release pipeline). A local
 * build, a test run and a Netlify deploy preview all warn loudly and continue —
 * they legitimately build without production credentials, and a guard that
 * breaks them would be removed within a week.
 */

/** Vite inlines only `VITE_`-prefixed variables into the browser bundle. */
export const CLIENT_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;

export interface ClientEnvVerdict {
  /** True when nothing required is missing. */
  ok: boolean;
  /** Required variables with no value. */
  missing: string[];
  /** True when a missing variable must fail the build rather than warn. */
  enforced: boolean;
  /** Where the enforcement decision came from, for the log line. */
  reason: string;
}

export function evaluateClientEnv(env: Record<string, string | undefined>): ClientEnvVerdict {
  const missing: string[] = [];
  if (!env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  // Either name satisfies the client: supabase.ts accepts the publishable key
  // or the legacy anon key.
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY && !env.VITE_SUPABASE_ANON_KEY) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  const productionContext = env.CONTEXT === 'production' || env.NETLIFY_CONTEXT === 'production';
  const explicit = env.EDUREACH_REQUIRE_CLIENT_ENV === '1';
  const enforced = productionContext || explicit;
  const reason = explicit
    ? 'EDUREACH_REQUIRE_CLIENT_ENV=1'
    : productionContext
      ? `CONTEXT=${env.CONTEXT ?? env.NETLIFY_CONTEXT}`
      : 'not a production build';

  return { ok: missing.length === 0, missing, enforced, reason };
}

function main(): void {
  const verdict = evaluateClientEnv(process.env);
  const configured = CLIENT_VARS.join(' + ') + ' (or VITE_SUPABASE_ANON_KEY)';

  if (verdict.ok) {
    console.log(`ok   client Supabase contract is satisfied (${configured})`);
    return;
  }
  if (verdict.enforced) {
    console.error(
      `\nFAIL client Supabase contract is unmet (${verdict.reason}).\n` +
        `     Missing: ${verdict.missing.join(', ')}\n` +
        '     A production build without these deploys a site that looks complete but\n' +
        '     persists nothing: applications and exam attempts are kept only in the\n' +
        '     visitor\'s browser. Set them in the build environment, then build again.\n',
    );
    process.exitCode = 1;
    return;
  }
  console.warn(
    `\nWARN client Supabase contract is unmet (${verdict.reason}); continuing.\n` +
      `     Missing: ${verdict.missing.join(', ')}\n` +
      '     This build is a dev/preview artifact: the app runs on local fallbacks and\n' +
      '     nothing a visitor submits is persisted. A production deploy (CONTEXT=production)\n' +
      '     will refuse to build in this state.\n',
  );
}

if (process.argv[1] && process.argv[1].endsWith('client-env-check.ts')) {
  main();
}
