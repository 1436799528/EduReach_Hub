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

export function describeProject(env: NodeJS.ProcessEnv = process.env): ProjectVerdict {
  return classifyProject(projectReference(env.VITE_SUPABASE_URL || env.SUPABASE_URL));
}

function main(): void {
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
  console.log('\nWhat that means:');
  for (const line of verdict.guidance) console.log(`  - ${line}`);
  console.log('');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
