/**
 * Which Supabase project is this checkout pointed at?
 *
 *   npm run env:check
 *
 * The answer matters because two very different jobs share one `.env`: read-only
 * verification (safe against production) and the manual walkthrough that creates
 * accounts, attempts and uploads (never safe against production). On 2026-10-22
 * the owner's `.env` was found pointing at the production project while the plan
 * called it "staging" — no harm done, because every command run against it was
 * read-only, but the next step in that plan was not.
 *
 * So this command prints the project reference and says, plainly, how to treat
 * it. It never prints a key, a URL path or any other part of the connection
 * string: the project reference is already public (it appears in the deployed
 * site's own network requests).
 */
import 'dotenv/config';

/** The project named as production in docs/audit and docs/operations. */
export const PRODUCTION_PROJECT_REF = 'gjdfatwcoosyuhakrrhh';

export type ProjectKind = 'production' | 'staging-or-other' | 'unconfigured';

export interface ProjectVerdict {
  kind: ProjectKind;
  /** The `abc…` part of `https://abc….supabase.co`, or null. */
  reference: string | null;
  /** What a person may safely do against this project. */
  guidance: string[];
}

/** Pull the project reference out of a Supabase URL without keeping the rest. */
export function projectReference(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = /^https?:\/\/([a-z0-9-]+)\.supabase\.(co|in)\/?$/i.exec(url.trim());
  return match ? match[1] : null;
}

/** Pure: classify the project and say what is allowed against it. */
export function classifyProject(reference: string | null): ProjectVerdict {
  if (!reference) {
    return {
      kind: 'unconfigured',
      reference: null,
      guidance: [
        'No Supabase project URL is configured, so nothing can reach a database.',
        'That is the correct state for building and for the browser test suite.',
      ],
    };
  }
  if (reference === PRODUCTION_PROJECT_REF) {
    return {
      kind: 'production',
      reference,
      guidance: [
        'Read-only checks are fine: prod:validate, duplicate:audit, analytics:retention (no --apply), newsroom:integrity.',
        'Do NOT create accounts, practise a paper, upload a file or run anything with --apply here.',
        'Do NOT run `supabase db push`, `db reset` or `migration repair` against it.',
        'For the write-heavy walkthrough, point .env at a staging project instead.',
      ],
    };
  }
  return {
    kind: 'staging-or-other',
    reference,
    guidance: [
      'This is not the documented production project, so accounts, CBT attempts and uploads may be created here.',
      'Confirm it is really your staging project before you run the walkthrough.',
      'Migration history still gets compared read-only (supabase/ci/production-validation.sql); nothing is applied.',
    ],
  };
}

/**
 * The endpoint a network probe should hit: the project's PostgREST root.
 *
 * No key is attached. Supabase answers an unauthenticated request with 401,
 * which is exactly the evidence wanted — the host is reachable and speaking
 * PostgREST. A blocked network produces no response at all, and the two must not
 * be confused: "401" means the path works, "no response" means this machine
 * cannot reach Supabase.
 */
export function probeUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const reference = projectReference(env.VITE_SUPABASE_URL || env.SUPABASE_URL);
  return reference ? `https://${reference}.supabase.co/rest/v1/` : null;
}

export interface ProbeVerdict {
  reachable: boolean;
  httpStatus: number | null;
  /** One line a non-programmer can act on. */
  summary: string;
}

/**
 * Pure: turn a probe result into a verdict.
 *
 * `status === null` means the request never completed — DNS failure, refused
 * connection or an egress block. Any HTTP status (401 included) proves the
 * network path exists.
 */
export function interpretProbe(status: number | null, errorMessage?: string): ProbeVerdict {
  if (status === null) {
    return {
      reachable: false,
      httpStatus: null,
      summary: `No HTTP response${errorMessage ? ` (${errorMessage})` : ''}. This machine cannot reach Supabase, so no live check can run here.`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      reachable: true,
      httpStatus: status,
      summary: `Reachable and answering (HTTP ${status} without a key is the expected answer). Live checks can run here if the keys are configured.`,
    };
  }
  return {
    reachable: true,
    httpStatus: status,
    summary: `Reachable (HTTP ${status}).`,
  };
}

/**
 * Should a write-heavy staging step be allowed to run?
 *
 * `classifyProject` only *describes* the target; it exits 0 whatever it finds,
 * which is right for a read-only report and wrong as a gate. The walkthrough
 * creates accounts, CBT attempts and uploads, and the owner's `.env` has already
 * once been pointed at production while a plan called it "staging". This is the
 * gate: it fails closed unless the project is configured, is not the documented
 * production project, and — when the operator names the project they expect —
 * matches that reference exactly.
 *
 * A project that is merely "not the documented production project" is *not*
 * proof that it is disposable. That is why the expected reference is required:
 * the human states the target, and the check proves the configuration agrees.
 */
export interface StagingGuardVerdict {
  ok: boolean;
  reason: string;
}

export function stagingGuard(verdict: ProjectVerdict, expectedReference: string | null): StagingGuardVerdict {
  if (verdict.kind === 'unconfigured' || !verdict.reference) {
    return { ok: false, reason: 'No Supabase project is configured, so there is no verified target. Set VITE_SUPABASE_URL and try again.' };
  }
  if (verdict.kind === 'production') {
    return { ok: false, reason: `${verdict.reference} is the documented PRODUCTION project. Staging steps must never run against it.` };
  }
  if (!expectedReference) {
    return {
      ok: false,
      reason: `The target ${verdict.reference} cannot be confirmed as disposable on its own. Re-run with STAGING_PROJECT_REF=${verdict.reference} after checking it is your staging project.`,
    };
  }
  if (expectedReference.trim().toLowerCase() !== verdict.reference.toLowerCase()) {
    return {
      ok: false,
      reason: `The configured project is ${verdict.reference} but STAGING_PROJECT_REF says ${expectedReference.trim()}. Refusing to guess which one is intended.`,
    };
  }
  return { ok: true, reason: `Target ${verdict.reference} confirmed: configured, not production, and named explicitly.` };
}

export function describeProject(env: NodeJS.ProcessEnv = process.env): ProjectVerdict {
  return classifyProject(projectReference(env.VITE_SUPABASE_URL || env.SUPABASE_URL));
}

async function main(): Promise<void> {
  const verdict = describeProject();
  const label = verdict.kind === 'production'
    ? 'PRODUCTION'
    : verdict.kind === 'staging-or-other' ? 'staging or another project' : 'not configured';

  console.log('EduReach project check\n');
  console.log(`  project reference: ${verdict.reference ?? '(none configured)'}`);
  console.log(`  classification:    ${label}`);
  console.log(`  keys present:      url ${process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL ? 'yes' : 'no'},`
    + ` publishable ${process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY ? 'yes' : 'no'},`
    + ` service-role ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY ? 'yes' : 'no'}`);

  if (process.argv.includes('--probe')) {
    const url = probeUrl();
    console.log('\nNetwork probe (no key attached, nothing is written):');
    if (!url) {
      console.log('  skipped — no project URL is configured, so there is nothing to reach.');
    } else {
      let status: number | null = null;
      let message: string | undefined;
      try {
        const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
        status = response.status;
      } catch (error) {
        message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      }
      const probe = interpretProbe(status, message);
      console.log(`  ${probe.summary}`);
    }
  }

  console.log('\nWhat that means:');
  for (const line of verdict.guidance) console.log(`  - ${line}`);
  console.log('');

  if (process.argv.includes('--require-staging')) {
    const guard = stagingGuard(verdict, process.env.STAGING_PROJECT_REF || null);
    console.log(guard.ok ? `GATE: ${guard.reason}` : `GATE: BLOCKED — ${guard.reason}`);
    console.log('');
    // Fail closed: no target, production, an unnamed target, or a mismatch.
    if (!guard.ok) process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  void main();
}
