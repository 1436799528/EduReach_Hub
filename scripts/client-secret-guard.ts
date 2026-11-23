import { isPrivilegedKey } from '../src/lib/supabaseKey';
import { softSecretName } from '../src/lib/envContract';
import { scanText } from './security/patterns';

/**
 * Vite exposes VITE_ values to browser code, even if runtime use is refused.
 *
 * This is the build-time refusal, and it is deliberately stricter than a prefix
 * check. A prefix check answers “is the name allowed to be exported?”, which is
 * the wrong question: the answer is always yes for VITE_, and the leak is in the
 * value. So three questions are asked, in order of confidence:
 *
 *  1. **Does the name promise a credential or an administrative identity?** A
 *     `VITE_` variable called `…_SERVICE_ROLE_KEY`, `…_SECRET`, `…_PASSWORD` or
 *     `…_ADMIN_BOOTSTRAP_EMAIL` is unsafe whatever its value looks like. The
 *     name list is shared with `src/lib/envContract.ts` so the classification
 *     table and this guard cannot drift.
 *  2. **Is the value a known credential format?** Supabase secret keys, legacy
 *     service-role JWTs, SendGrid keys, Google OAuth client secrets, PEM private
 *     keys, database URLs with a password, and the other provider formats in
 *     `scripts/security/patterns.ts`.
 *  3. **Is a known credential embedded in a larger value?** A key pasted into a
 *     query string or a JSON blob is still a key.
 *
 * What this cannot know is whether an arbitrary opaque string is somebody's
 * credential in a format nobody has seen yet. `scripts/dist-secret-scan.ts` closes
 * that gap from the other direction: it compares the finished artefacts against
 * the actual values of every server-only variable in this environment, plus an
 * entropy heuristic. Together they answer both “does this look like a secret?” and
 * “is a secret we hold actually in the bundle?”.
 *
 * A finding is reported by variable name, rule id and a masked fragment — never
 * the value — because a build log is stored and shared like any other artefact.
 */

export interface ClientExposure {
  /** The client-exposed variable that carries the problem. */
  variable: string;
  /** `name` when the variable's name is unsafe, otherwise the credential rule id. */
  rule: string;
  /** Masked evidence, or the matched variable name. */
  evidence: string;
}

function isViteScoped(name: string): boolean {
  return /^VITE_/i.test(name) || /^NEXT_PUBLIC_/i.test(name) || /^PUBLIC_/i.test(name);
}

/**
 * Every reason the given client-exposed configuration must not be bundled.
 * Returns an empty array for a safe configuration.
 */
export function findClientExposures(env: Record<string, unknown>): ClientExposure[] {
  const exposures: ClientExposure[] = [];
  for (const [name, raw] of Object.entries(env)) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    if (!isViteScoped(name)) continue;
    const value = raw.trim();

    // 1. The name itself is the finding: a credential-named client variable is
    //    unsafe even when today's value happens to be a placeholder.
    if (softSecretName(name)) {
      exposures.push({ variable: name, rule: 'credential-sounding name', evidence: name });
      continue;
    }

    // 2/3. The value, or a credential embedded in it.
    const matches = scanText(value);
    for (const match of matches) {
      exposures.push({ variable: name, rule: match.rule, evidence: match.evidence });
    }

    // The Supabase predicate is retained as its own rule: it is the one credential
    // format this application holds, and a regression here is a total compromise
    // of RLS rather than a third-party key leak.
    if (value.includes('sb_secret_') || isPrivilegedKey(value)) {
      if (!exposures.some((entry) => entry.variable === name && entry.rule === 'supabase_secret_key'))
        exposures.push({ variable: name, rule: 'privileged_supabase_key', evidence: 'sb_secret_…(masked)' });
    }

    const embedded = (value.match(/[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []).some(isPrivilegedKey);
    if (embedded && !exposures.some((entry) => entry.variable === name))
      exposures.push({ variable: name, rule: 'embedded_privileged_supabase_key', evidence: 'JWT…(masked)' });
  }
  return exposures;
}

/**
 * Boolean form, kept because `vite.config.ts` and the existing tests call it.
 * Behaviour is identical to a non-empty `findClientExposures`.
 */
export function hasPrivilegedClientValue(env: Record<string, unknown>): boolean {
  return findClientExposures(env).length > 0;
}

/** Human-readable, value-free summary lines for a build failure. */
export function describeClientExposures(exposures: ClientExposure[]): string[] {
  return exposures.map((entry) => `  ${entry.variable}: ${entry.rule} (${entry.evidence})`);
}
