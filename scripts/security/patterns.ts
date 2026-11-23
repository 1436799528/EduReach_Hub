/**
 * Shared credential patterns.
 *
 * Three call sites need the same opinion about what a credential looks like:
 *
 *  - `scripts/client-secret-guard.ts` — refuse to build or serve a bundle whose
 *    client-exposed configuration contains one;
 *  - `scripts/dist-secret-scan.ts` — inspect the built artefacts before they are
 *    published;
 *  - `scripts/security-scan.ts` — inspect the repository and its history.
 *
 * Duplicating the patterns is how one of the three silently falls behind. The
 * other rule this module enforces is that a finding is never printed in full: a
 * scan log is as public as the thing it is scanning, so every consumer reports
 * `rule`, `file`, `line` and a masked fragment only.
 *
 * These patterns are deliberately high-precision. A false negative is caught by
 * the value-containment check (any value of a server-only variable appearing in
 * client output) and by the provider's own scanning; a false positive that
 * demands a broad allowlist is how real findings get suppressed.
 */

export interface SecretRule {
  /** Stable id, used by the allowlist and by tests. */
  id: string;
  /** What it is, in operator language. */
  description: string;
  /** Global, case-sensitive where it matters. */
  pattern: RegExp;
  /** `secret` blocks a deployment; `sensitive` is reported and triaged. */
  severity: 'secret' | 'sensitive';
}

/**
 * Supabase secret keys (`sb_secret_…`) are opaque, not JWTs. The length floor
 * avoids matching documentation placeholders such as `sb_secret_…`.
 */
const SUPABASE_SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{16,}/g;

/**
 * Legacy Supabase/Postgres JWTs (`eyJ…`). Only a `service_role` (or an
 * unrecognised, therefore unclassifiable) key is a finding: an `anon` or
 * `authenticated` JWT is a public key by design and appears in every deployment.
 */
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

export const SECRET_RULES: SecretRule[] = [
  {
    id: 'supabase_secret_key',
    description: 'Supabase secret key (bypasses RLS)',
    pattern: SUPABASE_SECRET_KEY,
    severity: 'secret',
  },
  {
    id: 'sendgrid_api_key',
    description: 'SendGrid API key',
    pattern: /SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g,
    severity: 'secret',
  },
  {
    id: 'google_oauth_client_secret',
    description: 'Google OAuth client secret',
    pattern: /GOCSPX-[A-Za-z0-9_-]{16,}/g,
    severity: 'secret',
  },
  {
    id: 'private_key_block',
    description: 'PEM private key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
    severity: 'secret',
  },
  {
    id: 'database_url_with_credentials',
    description: 'Database URL containing a password',
    pattern: /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/g,
    severity: 'secret',
  },
  {
    id: 'url_with_credentials',
    description: 'URL with embedded user:password',
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]{3,}@[^\s/]+/gi,
    severity: 'secret',
  },
  {
    id: 'stripe_secret_key',
    description: 'Stripe live/test secret key',
    pattern: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/g,
    severity: 'secret',
  },
  {
    id: 'github_token',
    description: 'GitHub personal access token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
    severity: 'secret',
  },
  {
    id: 'aws_access_key_id',
    description: 'AWS access key id',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'secret',
  },
  {
    id: 'resend_api_key',
    description: 'Resend API key',
    pattern: /\bre_[A-Za-z0-9]{20,}/g,
    severity: 'secret',
  },
  {
    id: 'openai_api_key',
    description: 'Provider API key in sk- form',
    pattern: /\bsk-[A-Za-z0-9]{32,}/g,
    severity: 'secret',
  },
  {
    id: 'slack_token',
    description: 'Slack token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
    severity: 'secret',
  },
];

export interface SecretMatch {
  rule: string;
  description: string;
  severity: 'secret' | 'sensitive';
  /** Masked, never the value itself. */
  evidence: string;
  index: number;
}

/**
 * Mask a candidate value for reporting: enough to recognise which credential it
 * is when the owner looks at the platform console, never enough to use it.
 */
export function maskValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '(empty)';
  if (trimmed.length <= 8) return '*'.repeat(trimmed.length);
  // Keep a short prefix for recognisability and report the length; both are safe
  // and both let an owner match the finding to a console entry.
  return `${trimmed.slice(0, 4)}…(${trimmed.length} chars)`;
}

/** Read only the `role` claim of a JWT, for classification. Never logs the token. */
export function jwtRole(token: string): string | null {
  const payload = String(token.split('.')[1] || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!payload) return null;
  try {
    const claims = JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '='))) as {
      role?: unknown;
    };
    return typeof claims?.role === 'string' ? claims.role : null;
  } catch {
    return null;
  }
}

/** A JWT that is privileged (or unreadable and therefore not provably public). */
export function isPrivilegedJwt(token: string): boolean {
  const role = jwtRole(token);
  return role !== 'anon' && role !== 'authenticated';
}

/**
 * Shannon entropy per character. Used only as a second signal on long opaque
 * strings in client-exposed configuration, where a provider format is not known.
 * A URL, a UUID or a normal sentence falls well below the threshold.
 */
export function entropyPerChar(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) || 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

/**
 * Long, high-entropy, credential-shaped string. The floor (43 chars, 4.0 bits per
 * character, at least three character classes) keeps base64 ids, hashes used in
 * tests and every documentation placeholder out.
 */
export function looksHighEntropy(value: string): boolean {
  if (value.length < 43) return false;
  if (!/^[A-Za-z0-9_\-+/=.]+$/.test(value)) return false;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  return classes >= 3 && entropyPerChar(value) >= 4.0;
}

/** Scan one string. Returns masked findings only. */
export function scanText(text: string, options: { includeJwt?: boolean } = {}): SecretMatch[] {
  const matches: SecretMatch[] = [];
  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0;
    let found: RegExpExecArray | null;
    while ((found = rule.pattern.exec(text))) {
      matches.push({
        rule: rule.id,
        description: rule.description,
        severity: rule.severity,
        evidence: maskValue(found[0]),
        index: found.index,
      });
      if (found[0].length === 0) break;
    }
  }
  if (options.includeJwt !== false) {
    JWT.lastIndex = 0;
    let found: RegExpExecArray | null;
    while ((found = JWT.exec(text))) {
      if (!isPrivilegedJwt(found[0])) continue;
      matches.push({
        rule: 'privileged_jwt',
        description: 'Service-role or unclassifiable JWT',
        severity: 'secret',
        evidence: maskValue(found[0]),
        index: found.index,
      });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

/** Line number for an offset, so a report points at the right place. */
export function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}
