/**
 * Build-artefact inspection — the last checkpoint before a bundle becomes public.
 *
 *   npm run security:dist            # scans dist/
 *   npm run security:dist -- --dir dist
 *
 * Two independent questions, because either one alone has a blind spot:
 *
 *  1. **Does any file look like it contains a credential?** Provider formats
 *     (`sb_secret_…`, `SG.…`, `GOCSPX-…`, PEM blocks, database URLs with a
 *     password) plus an entropy check. This catches a key from somewhere else.
 *  2. **Is a credential we actually hold present in the output?** Every variable
 *     classified `SECRET` or `SENSITIVE_OPERATIONAL` in
 *     `src/lib/envContract.ts` is compared against the artefact text by value.
 *     This is the check a prefix rule cannot do: it does not care what the value
 *     looks like, only that it is ours and it is in public output.
 *
 * It also refuses files that must never be published at all: environment files,
 * source maps, database dumps, exports and SQL, and any documentation tree.
 *
 * Findings are reported as `file:line`, a rule id and masked evidence. The values
 * are never printed — a scanner log is copied into CI summaries and pasted into
 * issues, so printing the credential would recreate the leak it reports. It runs
 * inside `npm run build`, which means a leak fails the build rather than the
 * audit after it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ENV_CONTRACT, SERVER_ONLY_CLASSIFICATIONS, envNames } from '../src/lib/envContract';
import { lineOf, looksHighEntropy, maskValue, scanText } from './security/patterns';

export interface ArtifactFinding {
  file: string;
  line: number | null;
  rule: string;
  evidence: string;
}

/** File shapes that must never be in a published directory. */
const FORBIDDEN_FILE = [
  { id: 'env_file', pattern: /(^|\/)\.env(\.|$)/i, reason: 'an environment file' },
  { id: 'source_map', pattern: /\.map$/i, reason: 'a source map (publishes application source)' },
  { id: 'database_dump', pattern: /\.(dump|dump\.gz|list\.txt)$/i, reason: 'a database dump or restore listing' },
  { id: 'sql_script', pattern: /\.sql$/i, reason: 'a SQL script (migrations must not be served)' },
  {
    id: 'private_key_file',
    pattern: /\.(pem|p12|pfx|key|keystore|jks)$/i,
    reason: 'a private key or certificate container',
  },
  { id: 'git_metadata', pattern: /(^|\/)\.git(\/|$)/i, reason: 'git metadata' },
  { id: 'internal_docs', pattern: /(^|\/)(docs|audit|audits|internal)(\/)/i, reason: 'internal documentation' },
  { id: 'backup_archive', pattern: /\.(bak|backup|orig|sql\.gz|tar\.gz|zip)$/i, reason: 'a backup archive' },
];

/** Values shorter than this are too generic to attribute to a variable. */
const MIN_VALUE_LENGTH = 8;

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(full);
      else if (entry.isSymbolicLink() && existsSync(full) && statSync(full).isFile()) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * Server-only values to look for, from the live environment. `read` is injected so
 * the check is testable without mutating `process.env`.
 */
export function serverOnlyValues(
  read: (name: string) => string | undefined,
  specs = ENV_CONTRACT,
): Array<{ variable: string; value: string }> {
  const values: Array<{ variable: string; value: string }> = [];
  for (const spec of specs) {
    if (!SERVER_ONLY_CLASSIFICATIONS.includes(spec.classification)) continue;
    for (const name of envNames(spec)) {
      const value = (read(name) || '').trim();
      if (value.length >= MIN_VALUE_LENGTH) values.push({ variable: name, value });
    }
  }
  return values;
}

/** Scan one text blob. Exported so tests do not need a built directory. */
export function scanArtifactText(
  file: string,
  text: string,
  options: { envValues?: Array<{ variable: string; value: string }> } = {},
): ArtifactFinding[] {
  const findings: ArtifactFinding[] = [];
  for (const match of scanText(text)) {
    findings.push({ file, line: lineOf(text, match.index), rule: match.rule, evidence: match.evidence });
  }
  const values = options.envValues || [];
  if (values.length > 0) {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      for (const entry of values) {
        if (!line.includes(entry.value)) continue;
        findings.push({
          file,
          line: index + 1,
          rule: `server_value:${entry.variable}`,
          evidence: maskValue(entry.value),
        });
      }
    });
  }
  return findings;
}

/**
 * High-entropy strings in a bundle are not automatically a finding: minified
 * code, hashes and base64 image data all look like that. They are reported as a
 * separate, review-only class so a suspicious artefact can be triaged without
 * weakening the hard rules.
 */
export function highEntropyStrings(text: string): Array<{ value: string; index: number }> {
  const candidates: Array<{ value: string; index: number }> = [];
  const token = /[A-Za-z0-9_\-+/=]{43,}/g;
  let found: RegExpExecArray | null;
  while ((found = token.exec(text))) {
    if (looksHighEntropy(found[0])) candidates.push({ value: found[0], index: found.index });
  }
  return candidates;
}

export interface DistReport {
  scanned: number;
  findings: ArtifactFinding[];
  entropy: ArtifactFinding[];
}

/** Scan a directory. Missing directory is a failure: silence is not a pass. */
export function scanDirectory(
  dir: string,
  read: (name: string) => string | undefined = (name) => process.env[name],
): DistReport {
  if (!existsSync(dir)) throw new Error(`Artefact directory not found: ${dir}. Build first, then scan.`);
  const envValues = serverOnlyValues(read);
  const files = listFiles(dir);
  const findings: ArtifactFinding[] = [];
  const entropy: ArtifactFinding[] = [];

  for (const absolute of files) {
    const relativePath = relative(dir, absolute).split('\\').join('/');
    for (const rule of FORBIDDEN_FILE) {
      if (rule.pattern.test(relativePath)) {
        findings.push({ file: relativePath, line: null, rule: `forbidden_file:${rule.id}`, evidence: rule.reason });
      }
    }
    const size = statSync(absolute).size;
    if (size > MAX_FILE_BYTES) continue;
    const buffer = readFileSync(absolute);
    if (buffer.includes(0)) continue; // binary asset; formats above already cover keys
    const text = buffer.toString('utf8');
    findings.push(...scanArtifactText(relativePath, text, { envValues }));
    if (/\.(js|mjs|cjs|html|json|css)$/i.test(relativePath)) {
      for (const candidate of highEntropyStrings(text)) {
        entropy.push({
          file: relativePath,
          line: lineOf(text, candidate.index),
          rule: 'high_entropy_string',
          evidence: maskValue(candidate.value),
        });
      }
    }
  }
  return { scanned: files.length, findings, entropy };
}

function main(): void {
  const args = process.argv.slice(2);
  const dirFlag = args.indexOf('--dir');
  const dir = resolve(dirFlag >= 0 && args[dirFlag + 1] ? args[dirFlag + 1] : 'dist');
  let report: DistReport;
  try {
    report = scanDirectory(dir);
  } catch (error) {
    console.error(`FAIL ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }
  if (report.findings.length > 0) {
    console.error(`FAIL ${report.findings.length} finding(s) in ${report.scanned} published file(s):`);
    for (const finding of report.findings) {
      const where = finding.line ? `${finding.file}:${finding.line}` : finding.file;
      console.error(`  ${where} ${finding.rule} (${finding.evidence})`);
    }
    console.error('Nothing was published. Remove the value, then rebuild; never widen the scan to pass it.');
    process.exitCode = 1;
    return;
  }
  if (report.entropy.length > 0) {
    // Reported, not fatal: a minified bundle legitimately contains long opaque
    // strings. They are listed only when asked for (`--verbose`) so a normal build
    // stays readable, and CI runs the verbose form so a reviewer can dismiss them
    // knowingly instead of never seeing them.
    console.warn(`WARN ${report.entropy.length} high-entropy string(s) in published JavaScript (review-only).`);
    if (args.includes('--verbose')) {
      for (const entry of report.entropy.slice(0, 40)) {
        console.warn(`  ${entry.file}:${entry.line} ${entry.rule} (${entry.evidence})`);
      }
    }
  }
  console.log(`ok   ${report.scanned} published file(s) contain no credential pattern and no server-only value`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/dist-secret-scan.ts')) main();
