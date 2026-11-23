/**
 * D5 - the production environment-variable contract, and the security
 * classification of every variable the application reads.
 *
 * One declaration of every variable, so four things cannot drift apart: what the
 * code consumes, what the runbook tells an operator to set, where a hosting
 * platform must scope it, and what `scripts/prod-validate.ts`,
 * `scripts/client-env-check.ts`, `scripts/dist-secret-scan.ts` and
 * `scripts/security-scan.ts` check before a deployment is trusted.
 *
 * Rules encoded here:
 *  - `VITE_*` variables are inlined into the browser bundle at build time. They are
 *    not secrets and must never hold one.
 *  - Server-only variables are read at runtime by the Express server (or by a
 *    Netlify/Vercel function). Anything classified `SECRET` or
 *    `SENSITIVE_OPERATIONAL` is never printed, logged, or returned by an
 *    endpoint - `describeEnv` reports presence, never value.
 *  - `aliases` exist because the repository accepts both the modern Supabase key
 *    names and the legacy ones; a deployment may satisfy a variable through any
 *    alias, and the contract says so rather than forcing a rename. Aliases also
 *    carry the `EDUREACH_PUBLIC_*` names, which exist so a hosting platform can
 *    hold public configuration in a variable that is *not* flagged secret.
 *  - `classification` is the security boundary itself (see
 *    `.env.example` header and `docs/ENVIRONMENT-VARIABLES.md`):
 *
 *      PUBLIC                  intentionally shipped to browsers. Safe in the
 *                              bundle, safe in a public repository.
 *      PRIVATE                 server/deployment configuration that is not a
 *                              credential but should not be published (canonical
 *                              origin, feature flags, ports).
 *      SECRET                  a credential. Server/function scope only. Rotating
 *                              one is an incident; leaking one is a breach.
 *      SENSITIVE_OPERATIONAL   real-world identity or access detail that is not a
 *                              credential but must not be public: the admin
 *                              bootstrap address, a mail sender, a DSN.
 *      DEVELOPMENT_ONLY        rehearsal/test switches. Never set in production.
 *
 * Keep this dependency-free: a Node script imports it directly.
 */

export type EnvVisibility = 'client' | 'server';
export type EnvRequirement = 'required' | 'recommended' | 'optional';

/**
 * The security classification, not a severity. `PUBLIC` is the only class that may
 * reach a browser bundle.
 */
export type EnvClassification =
  | 'PUBLIC'
  | 'PRIVATE'
  | 'SECRET'
  | 'SENSITIVE_OPERATIONAL'
  | 'DEVELOPMENT_ONLY';

/**
 * Where the value is needed at runtime. A hosting platform should scope
 * `function`-only variables to the functions that need them and leave them out of
 * the build environment entirely.
 */
export type EnvScope = 'build' | 'runtime' | 'function' | 'ci';

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
  /** True only for `SECRET`. Kept as a boolean because callers filter on it. */
  secret: boolean;
  classification: EnvClassification;
  scope: EnvScope;
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
        note: 'Public fallback. `vite.config.ts` inlines it into the browser bundle when the VITE_ name is absent, so a host that only sets this name still gets a configured client.',
      },
      {
        name: 'EDUREACH_PUBLIC_SUPABASE_URL',
        visibility: 'server',
        note: 'Public fallback for a host that cannot clear a mistaken "secret" flag on the VITE_ variable. `vite.config.ts` inlines it into the browser bundle through `clientSupabaseEnv`, so the browser still receives a configured client.',
      },
    ],
    purpose: 'Supabase project origin. Used by the browser client and by the server to build its own client.',
    requirement: 'required',
    visibility: 'client',
    secret: false,
    classification: 'PUBLIC',
    scope: 'build',
    consumedBy: ['src/lib/supabase.ts', 'server.ts', 'scripts/client-env-check.ts'],
  },
  {
    name: 'VITE_SUPABASE_PUBLISHABLE_KEY',
    aliases: [
      { name: 'VITE_SUPABASE_ANON_KEY', visibility: 'client', note: 'The pre-rename browser key name; still accepted.' },
      {
        name: 'SUPABASE_ANON_KEY',
        visibility: 'server',
        note: 'Public fallback. `vite.config.ts` inlines it into the browser bundle when no VITE_ key name is set.',
      },
      {
        name: 'EDUREACH_PUBLIC_SUPABASE_KEY',
        visibility: 'server',
        note: 'Public fallback for a host that cannot clear a mistaken "secret" flag on the VITE_ key variable. The build inlines it, and a privileged key is refused by name as well as by value.',
      },
    ],
    purpose: 'Browser-facing Supabase key. Public by design; every browser request is subject to RLS.',
    requirement: 'required',
    visibility: 'client',
    secret: false,
    classification: 'PUBLIC',
    scope: 'build',
    consumedBy: ['src/lib/supabase.ts', 'scripts/client-env-check.ts'],
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    aliases: [{ name: 'SUPABASE_SECRET_KEY', visibility: 'server', note: 'The modern secret-key name; both are accepted.' }],
    purpose:
      'Server-only key that bypasses RLS. Used for admin routes, service-role functions, the newsroom pipeline and analytics ingestion. Must be a service_role key; a browser key is rejected.',
    requirement: 'required',
    visibility: 'server',
    secret: true,
    classification: 'SECRET',
    scope: 'runtime',
    consumedBy: ['lib/supabase-config.ts', 'server.ts'],
  },
  {
    name: 'NODE_ENV',
    aliases: [],
    purpose: 'Selects the strict production header set (CSP, X-Frame-Options, HSTS) and disables dev-only branches.',
    requirement: 'required',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'runtime',
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
    classification: 'PUBLIC',
    scope: 'runtime',
    consumedBy: ['src/server/seo.ts', 'server.ts'],
  },
  {
    name: 'EDUREACH_NEWSROOM_USER_AGENT',
    aliases: [],
    purpose: 'User-Agent the newsroom sends to publishers. Polite crawling identifies the crawler rather than hiding it.',
    requirement: 'recommended',
    visibility: 'server',
    secret: false,
    classification: 'PUBLIC',
    scope: 'runtime',
    consumedBy: ['src/server/newsroom/run.ts'],
  },
  {
    name: 'EDUREACH_ADMIN_BOOTSTRAP_EMAIL',
    aliases: [],
    purpose:
      'Email allowed to bootstrap the first administrator. Leave unset in steady state; setting it opens the bootstrap route. Not a credential, but a real person’s address and an administrative control: server/function scope only, never the build environment, never a VITE_ name, never a document.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'SENSITIVE_OPERATIONAL',
    scope: 'function',
    consumedBy: ['server.ts'],
  },
  {
    name: 'SENTRY_DSN',
    aliases: [],
    purpose:
      'Error-aggregation ingest endpoint. Empty by default, which keeps the tracker off. Server-side only: a DSN is an ingest credential and must never be inlined into a bundle.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'SENSITIVE_OPERATIONAL',
    scope: 'runtime',
    consumedBy: ['lib/errorTracking.ts', 'server.ts'],
  },
  {
    name: 'SENTRY_MAX_EVENTS_PER_HOUR',
    aliases: [],
    purpose: 'Client-side volume cap for error events, so the free tier is unreachable.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'runtime',
    consumedBy: ['lib/errorTracking.ts'],
  },
  {
    name: 'SENTRY_MAX_EVENTS_PER_DAY',
    aliases: [],
    purpose: 'Daily volume cap for error events.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'runtime',
    consumedBy: ['lib/errorTracking.ts'],
  },
  {
    name: 'OBS_SLOW_REQUEST_MS',
    aliases: [],
    purpose: 'Slow-request threshold for the http.slow operational event, in milliseconds.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'runtime',
    consumedBy: ['server.ts'],
  },
  {
    name: 'CBT_LEGACY_SCHEMA',
    aliases: [],
    purpose:
      'Set to 1 only for a deployment that deliberately runs the legacy CBT schema. Readiness fails closed otherwise.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'runtime',
    consumedBy: ['server.ts'],
  },
  {
    name: 'EDUREACH_REQUIRE_CLIENT_ENV',
    aliases: [],
    purpose: 'Makes an unmet browser Supabase contract fatal outside a recognised production context.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'build',
    consumedBy: ['scripts/client-env-check.ts'],
  },
  {
    name: 'EDUREACH_ALLOW_UNCONFIGURED_CLIENT',
    aliases: [],
    purpose:
      'Publishes the honest unconfigured shell when a host holds the public Supabase pair outside this repository. Never bypasses the privileged-key refusal.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'build',
    consumedBy: ['scripts/client-env-check.ts'],
  },
  // WHATSAPP_API_ENDPOINT / WHATSAPP_API_TOKEN were declared here and consumed by
  // src/server/whatsapp.ts, which had no caller anywhere in the repository: the
  // contract advertised an outbound integration that could never run. Both the
  // module and the variables are gone. Student-facing WhatsApp links are static `wa.me`
  // deep links built from src/data/hubContent.ts and need no credential.
  {
    name: 'PORT',
    aliases: [],
    purpose: 'Listen port for the standalone Express server. Only used when self-hosting; the Vercel backend sets its own port.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'runtime',
    consumedBy: ['server.ts'],
  },
  {
    name: 'PROBE_BASE_URL',
    aliases: [],
    purpose: 'Target of the uptime probe. A public origin, used by CI only.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PUBLIC',
    scope: 'ci',
    consumedBy: ['scripts/uptime-check.ts'],
  },
  {
    name: 'UPTIME_READINESS_STRICT',
    aliases: [],
    purpose: 'Makes a readiness failure fatal for the uptime probe.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'ci',
    consumedBy: ['scripts/uptime-check.ts'],
  },
  {
    name: 'UPTIME_TIMEOUT_MS',
    aliases: [],
    purpose: 'Per-request timeout for the uptime probe.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PRIVATE',
    scope: 'ci',
    consumedBy: ['scripts/uptime-check.ts'],
  },
  {
    name: 'EDUREACH_SMOKE_URL',
    aliases: [],
    purpose: 'Target of the post-deploy smoke check. A public origin, used by CI only.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'PUBLIC',
    scope: 'ci',
    consumedBy: ['scripts/smoke-check.ts'],
  },
  {
    name: 'DISABLE_HMR',
    aliases: [],
    purpose: 'Disables the Vite HMR socket in constrained environments. Local development only.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'DEVELOPMENT_ONLY',
    scope: 'build',
    consumedBy: ['vite.config.ts'],
  },
  {
    name: 'STAGING_PROJECT_REF',
    aliases: [],
    purpose: 'Declares which Supabase project is staging, so a destructive rehearsal cannot target production.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'DEVELOPMENT_ONLY',
    scope: 'ci',
    consumedBy: ['scripts/env-check.ts'],
  },
  {
    name: 'CBT_V2_LOCAL_REHEARSAL',
    aliases: [],
    purpose: 'Opt-in switch for the local CBT v2 rehearsal harness. Never set in production.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'DEVELOPMENT_ONLY',
    scope: 'ci',
    consumedBy: ['server.ts', 'scripts/rehearse-cbt-v2-http.mjs'],
  },
  {
    name: 'CBT_V2_TEST_IMPORT',
    aliases: [],
    purpose: 'Allows the rehearsal harness to import disposable questions. Never set in production.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'DEVELOPMENT_ONLY',
    scope: 'ci',
    consumedBy: ['server.ts', 'scripts/rehearse-cbt-http-boundary.mjs'],
  },
  {
    name: 'CBT_HTTP_BROWSER',
    aliases: [],
    purpose: 'Browser binary used by the CBT HTTP-boundary rehearsal.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'DEVELOPMENT_ONLY',
    scope: 'ci',
    consumedBy: ['scripts/rehearse-cbt-http-boundary.mjs'],
  },
  {
    name: 'INSTITUTION_IMPORT_ENV',
    aliases: [],
    purpose: 'Declares the institution-research import target environment. Local tooling only.',
    requirement: 'optional',
    visibility: 'server',
    secret: false,
    classification: 'DEVELOPMENT_ONLY',
    scope: 'ci',
    consumedBy: ['scripts/institutions/importResearchBatch.ts'],
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
    const tags = [spec.requirement, spec.visibility, spec.classification.toLowerCase(), spec.secret ? 'secret' : 'non-secret'].join(', ');
    return `${spec.name.padEnd(34)} ${state.padEnd(28)} (${tags})`;
  });
}

/** Classifications whose values must never leave the server/function boundary. */
export const SERVER_ONLY_CLASSIFICATIONS: EnvClassification[] = ['SECRET', 'SENSITIVE_OPERATIONAL'];

/** True when the classification forbids a browser bundle and a public repository. */
export function isServerOnlyClassification(classification: EnvClassification): boolean {
  return classification === 'SECRET' || classification === 'SENSITIVE_OPERATIONAL' || classification === 'PRIVATE';
}

/** Every name (primary and alias) declared for a variable. */
export function envNames(spec: EnvSpec): string[] {
  return [spec.name, ...spec.aliases.map((alias) => alias.name)];
}

/** Every name the repository treats as server-only, for value-containment scans. */
export function serverOnlyEnvNames(): string[] {
  return ENV_CONTRACT.filter((spec) => SERVER_ONLY_CLASSIFICATIONS.includes(spec.classification)).flatMap(envNames);
}

export interface ContractViolation {
  variable: string;
  rule: string;
}

/**
 * Structural invariants of the classification table itself. Exported so the test
 * suite and `scripts/security-scan.ts` assert the same rules: a classification
 * mistake is a design defect, and it must fail before a bundle is built rather
 * than after a visitor downloads it.
 */
export function validateEnvContract(specs: EnvSpec[] = ENV_CONTRACT): ContractViolation[] {
  const violations: ContractViolation[] = [];
  const seen = new Set<string>();
  for (const spec of specs) {
    for (const name of envNames(spec)) {
      if (seen.has(name)) violations.push({ variable: name, rule: 'declared twice' });
      seen.add(name);
      if (name.startsWith('VITE_') && spec.classification !== 'PUBLIC')
        violations.push({ variable: name, rule: 'a VITE_ name must be classified PUBLIC (Vite inlines it)' });
      if (softSecretName(name) && spec.classification === 'PUBLIC')
        violations.push({ variable: name, rule: 'a credential-sounding name must not be classified PUBLIC' });
      if (name.startsWith('VITE_') && spec.visibility === 'server')
        violations.push({ variable: name, rule: 'a VITE_ name is client-visible by construction' });
    }
    if (SERVER_ONLY_CLASSIFICATIONS.includes(spec.classification) && spec.visibility === 'client')
      violations.push({ variable: spec.name, rule: `${spec.classification} must not be declared client-visible` });
    if (spec.secret !== (spec.classification === 'SECRET'))
      violations.push({ variable: spec.name, rule: '`secret` and `classification` disagree' });
    if (spec.classification === 'DEVELOPMENT_ONLY' && spec.scope === 'function')
      violations.push({ variable: spec.name, rule: 'a development-only switch has no function scope' });
    if (spec.consumedBy.length === 0) violations.push({ variable: spec.name, rule: 'no consumer is declared' });
  }
  return violations;
}

/**
 * A name that promises a credential or an administrative identity. Used by the
 * contract check and by `scripts/client-secret-guard.ts`, so the browser-side
 * refusal and the build-time refusal cannot drift.
 */
export function softSecretName(name: string): boolean {
  return /(?:^|_)(?:SECRET|SERVICE_ROLE|SERVICE_KEY|PRIVATE_KEY|PASSWORD|PASSWD|API_KEY|APIKEY|ACCESS_TOKEN|BOOTSTRAP_EMAIL|ADMIN_EMAIL|SMTP_PASS|CLIENT_SECRET)(?:_|$)/i.test(
    name,
  );
}
