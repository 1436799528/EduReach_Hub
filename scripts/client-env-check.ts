/** Enforce browser Supabase configuration before a production build. */
import 'dotenv/config';
import { describeClientExposures, findClientExposures, hasPrivilegedClientValue } from './client-secret-guard';
import { isPrivilegedKey } from '../src/lib/supabaseKey';

export const CLIENT_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;

/**
 * The two public values the browser needs, from either the Vite names or the
 * unprefixed names a host may already provide. A host that sets
 * `SUPABASE_URL` + `SUPABASE_ANON_KEY` has a working public configuration; the
 * build inlines these two values into the bundle (see `vite.config.ts`). The
 * service-role key is never read here.
 *
 * `EDUREACH_PUBLIC_SUPABASE_URL` / `EDUREACH_PUBLIC_SUPABASE_KEY` are the last
 * fallback, and they exist for one specific platform problem: a hosting provider
 * cannot clear the "secret" flag on a variable once it is set, so a public value
 * (the project origin, the publishable key) may be stuck under a name the
 * provider refuses to treat as public. These names are unambiguous at a glance —
 * they say `PUBLIC` — so the pair can be recreated correctly without ever
 * reading, printing or rotating the value that is stuck. Precedence is unchanged
 * for every deployment that already works.
 */
export function clientSupabaseEnv(env: Record<string, string | undefined>): {
  url?: string;
  key?: string;
} {
  const value = (...names: string[]) => names.map((name) => env[name]?.trim()).find(Boolean);
  return {
    url: value('VITE_SUPABASE_URL', 'EDUREACH_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
    key: value(
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'EDUREACH_PUBLIC_SUPABASE_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_ANON_KEY',
    ),
  };
}

const URL_NAMES = ['VITE_SUPABASE_URL', 'EDUREACH_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'] as const;

/**
 * The URL variable must hold the project origin and nothing else.
 *
 * This is a warning, not a failure, and deliberately so. A value with a path (the
 * REST endpoint copied from the dashboard), a query string, or embedded
 * credentials still reads as "configured" while producing a client that fails
 * every request, so it is worth printing; but a trailing slash is harmless, a
 * self-hosted Supabase may legitimately serve the API from a sub-path, and a
 * release should not fail on a shape the deployment already works with. The value
 * itself is never printed — the variable name and the shape are.
 */
export function describeClientUrlShape(env: Record<string, string | undefined>): string | null {
  const name = URL_NAMES.find((candidate) => Boolean(env[candidate]?.trim()));
  if (!name) return null;
  const raw = (env[name] as string).trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return `WARN ${name} is not an absolute URL; it must be the project origin (https://<project-ref>.supabase.co).`;
  }
  if (parsed.username || parsed.password) {
    return `WARN ${name} carries credentials in the URL; it must be the bare project origin with no user or password.`;
  }
  const path = parsed.pathname.replace(/\/+$/, '');
  if (path) {
    return `WARN ${name} carries a path ("${path}"); it must be the bare project origin, without the REST endpoint or a trailing path.`;
  }
  if (parsed.search || parsed.hash) {
    return `WARN ${name} carries a query string or fragment; it must be the bare project origin.`;
  }
  return null;
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
  const shape = describeClientUrlShape(process.env);
  if (shape) console.warn(shape);
  const configured = CLIENT_VARS.join(' + ') + ' (or VITE_SUPABASE_ANON_KEY)';
  if (verdict.privilegedClientValue) {
    // Name the variable and the rule; never the value. A build log is stored and
    // shared, so printing the credential would repeat the exposure it reports.
    const exposures = findClientExposures(process.env);
    console.error(
      'FAIL privileged or private value in client-exposed configuration. Remove it from the VITE_ variable before building.',
    );
    for (const line of describeClientExposures(exposures)) console.error(line);
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
