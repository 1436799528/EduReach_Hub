/**
 * D5 — the production environment-variable contract.
 *
 * One declaration of every variable the application reads, so three things cannot
 * drift apart: what the code consumes, what the runbook tells an operator to set,
 * and what `scripts/prod-validate.ts` checks before a deployment is trusted.
 *
 * Rules encoded here:
 *  - `VITE_*` variables are inlined into the browser bundle at build time. They are
 *    not secrets and must never hold one.
 *  - Server-only variables are read at runtime by Express or a Netlify function.
 *    Anything classified `secret` is never printed, logged, or returned by an
 *    endpoint — `describeEnv` reports presence, never value.
 *  - `aliases` exist because the repository accepts both the modern Supabase key
 *    names and the legacy ones; a deployment may satisfy a variable through any
 *    alias, and the contract says so rather than forcing a rename.
 *
 * Keep this dependency-free: a Node script imports it directly.
 */

export type EnvVisibility = 'client' | 'server';
export type EnvRequirement = 'required' | 'recommended' | 'optional';

/**
 * An alternative name that satisfies the same requirement.
 *
 * Visibility is per alias, not inherited from the primary name, and that is not
 * pedantry: Vite only inlines `VITE_*` into the browser bundle, so a server-side
 * fallback for a client-visible variable will satisfy the *server* and silently
 * leave the *browser* unconfigured. An operator who sets only the alias gets a site
 * that looks configured and cannot talk to Supabase.
 */
export interface EnvAlias {
  name: string;
  visibility: EnvVisibility;
  /** Why this alias exists, when it is not obvious. */
  note?: string;
}

export interface EnvSpec {
  name: string;
  /** Alternative names that satisfy the same requirement. */
  aliases: EnvAlias[];
  purpose: string;
  requirement: EnvRequirement;
  visibility: EnvVisibility;
  secret: boolean;
  /** Where it is read, so a reader can trace it. */
  consumedBy: string[];
}

export const ENV_CONTRACT: EnvSpec[] = [
  {
    name: 'VITE_SUPABASE_URL',
    aliases: [
      {
        name: 'SUPABASE_URL',
        visibility: 'server',
        note: 'Server-side fallback only. Not inlined into the browser bundle, so setting this alone leaves the client unconfigured.',
      },
    ],
    purpose: 'Supabase project origin. Used by the browser client and by the server to build its own client.',
    requirement: 'required',
    visibility: 'client',
    secret: false,
    consumedBy: ['src/lib/supabase.ts', 'server.ts'],
  },
  {
    name: 'VITE_SUPABASE_PUBLISHABLE_KEY',
    aliases: [
      { name: 'VITE_SUPABASE_ANON_KEY', visibility: 'client', note: 'The pre-rename browser key name; still accepted.' },
      {
        name: 'SUPABASE_ANON_KEY',
        visibility: 'server',
        note: 'Server-side fallback only. Not inlined into the browser bundle.',
      },
    ],
    purpose: 'Browser-facing Supabase key. Deliberately public; every browser request is subject to RLS.',
    requirement: 'required',
    visibility: 'client',
    secret: false,
    consumedBy: ['src/lib/supabase.ts'],
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    aliases: [{ name: 'SUPABASE_SECRET_KEY', visibility: 'server', note: 'The modern secret-key name; both are accepted.' }],
    purpose:
      'Server-only key that bypasses RLS. Used for admin routes, service-role functions, the newsroom pipeline and analytics ingestion. Must be a service_role key; a browser key is rejected.',
    requirement: 'required',
    visibility: 'server',
    secret: true,
    consumedBy: ['lib/supabase-config.ts', 'server.ts', 'netlify/functions/*'],
  },
  {
    name: 'NODE_ENV',
    aliases: [],
    purpose: 'Selects the strict production header set (CSP, X-Frame-Options, HSTS) and disables dev-only branches.',
    requirement: 'required',
    visibility: 'server',
    secret: false,
    consumedBy: ['server.ts'],
  },
  {
    name: 'EDUREACH_SITE_URL',
    aliases: [],
    purpose:
      'Canonical public origin for sitemap, canonical URLs and absolute metadata. Without it the origin is inferred from request headers, which a proxy can distort.',
    requirement: 'recommended',
    visibility: 'server',
    secret: false,
    consumedBy: ['src/server/seo.ts'],
  },
  {
    name: 'EDUREACH_NEWSROOM_USER_AGENT',
    aliases: [],
    purpose: 'User-Agent the newsroom sends to publishers. Polite crawling identifies the crawler rather than hiding it.',
    requirement: 'recommended',
    visibility: 'server',
    secret: false,
    consumedBy: ['src/server/newsroom/run.ts', 'netlify/functions/daily-news-refresh.ts'],
  },
  {
    name: 'EDUREACH_ADMIN_BOOTSTRAP_EMAIL',
    aliases: [],
    purpose: 'Email allowed to bootstrap the first administrator. Leave unset in steady state; setting it opens the bootstrap route.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    consumedBy: ['server.ts'],
  },
  // WHATSAPP_API_ENDPOINT / WHATSAPP_API_TOKEN were declared here and consumed by
  // src/server/whatsapp.ts, which had no caller anywhere in the repository: the
  // contract advertised an outbound integration that could never run (audit
  // P2-3, previously MED-8 in the 2026-10-02 audit). Both the module and the
  // variables are gone. Student-facing WhatsApp links are static `wa.me`
  // deep links built from src/data/hubContent.ts and need no credential.
  {
    name: 'PORT',
    aliases: [],
    purpose: 'Listen port for the standalone Express server. Netlify sets its own; only used when self-hosting.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    consumedBy: ['server.ts'],
  },
];

export type EnvFinding =
  | { spec: EnvSpec; ok: true; satisfiedBy: string }
  | { spec: EnvSpec; ok: false; reason: 'missing' | 'empty' };

/** Presence check only. Never returns or exposes a value. */
export function checkEnv(
  spec: EnvSpec,
  read: (name: string) => string | undefined,
): EnvFinding {
  for (const candidate of [spec.name, ...spec.aliases.map((alias) => alias.name)]) {
    const value = (read(candidate) ?? '').trim();
    if (value) return { spec, ok: true, satisfiedBy: candidate };
  }
  return { spec, ok: false, reason: 'missing' };
}

/**
 * Evaluate the whole contract. `severity` decides whether a gap blocks: a missing
 * `required` variable always does; `recommended` and `optional` never do.
 */
export function evaluateEnv(read: (name: string) => string | undefined): {
  findings: EnvFinding[];
  missingRequired: string[];
  missingRecommended: string[];
  ok: boolean;
} {
  const findings = ENV_CONTRACT.map((spec) => checkEnv(spec, read));
  const missingRequired = findings
    .filter((finding) => !finding.ok && finding.spec.requirement === 'required')
    .map((finding) => finding.spec.name);
  const missingRecommended = findings
    .filter((finding) => !finding.ok && finding.spec.requirement === 'recommended')
    .map((finding) => finding.spec.name);
  return { findings, missingRequired, missingRecommended, ok: missingRequired.length === 0 };
}

/**
 * A one-line, secret-safe description of a variable's state. This is what logs and
 * the validator print: the name, whether it is set, and which alias satisfied it.
 * The value itself is never included, for secret and non-secret alike.
 */
export function describeEnv(read: (name: string) => string | undefined): string[] {
  return ENV_CONTRACT.map((spec) => {
    const finding = checkEnv(spec, read);
    const state = finding.ok ? `set via ${finding.satisfiedBy}` : 'NOT SET';
    const tags = [spec.requirement, spec.visibility, spec.secret ? 'secret' : 'non-secret'].join(', ');
    return `${spec.name.padEnd(34)} ${state.padEnd(28)} (${tags})`;
  });
}
