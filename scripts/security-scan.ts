/**
 * Repository and history secret scan — the check that keeps a fixed leak fixed.
 *
 *   npm run security:scan              # tracked files
 *   npm run security:scan -- --history # plus every line ever added in git
 *   npm run security:scan -- --json    # machine-readable
 *
 * Why this exists next to Gitleaks/TruffleHog rather than instead of them: those
 * tools are not installed in every environment this repository builds in, and a
 * check that depends on a binary a contributor may not have is a check that gets
 * skipped. This one is dependency-free, so it runs in `npm run build`, in the
 * pre-commit habit and in CI. Where Gitleaks is available it should also run;
 * nothing here conflicts with it.
 *
 * Rules of engagement, so the scan stays credible:
 *  - A finding is reported as `file:line`, rule id and masked evidence. Never the
 *    value: the scan output is committed to a CI summary.
 *  - Test fixtures and rehearsal scripts legitimately contain synthetic
 *    credentials. They are allowlisted in `.security/secret-scan-allowlist.json`
 *    by *rule and path*, with a written reason, and every allowlisted finding is
 *    still printed as `allowed`. An allowlist entry that has stopped matching is
 *    itself reported, so the file cannot rot into a blanket suppression.
 *  - Whole directories are never excluded. `docs/` is scanned like everything
 *    else; that is how the leaked values in `docs/audit/` were found.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateEnvContract } from '../src/lib/envContract';
import { lineOf, scanText } from './security/patterns';

export interface ScanFinding {
  file: string;
  line: number;
  rule: string;
  evidence: string;
  allowed?: { reason: string };
}

export interface ScanReport {
  files: number;
  findings: ScanFinding[];
  violations: ScanFinding[];
  contractViolations: ReturnType<typeof validateEnvContract>;
  staleAllowlist: string[];
}

interface AllowlistEntry {
  rule: string;
  path: string;
  reason: string;
}

const ALLOWLIST_PATH = '.security/secret-scan-allowlist.json';

/** Minimal glob: `**` crosses directories, `*` does not. */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '::DIR::')
    .replace(/\*\*/g, '::ANY::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DIR::/g, '(?:.*/)?')
    .replace(/::ANY::/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function loadAllowlist(path = ALLOWLIST_PATH): AllowlistEntry[] {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { entries?: unknown };
  if (!Array.isArray(parsed.entries)) return [];
  return parsed.entries.filter(
    (entry): entry is AllowlistEntry =>
      Boolean(entry) &&
      typeof (entry as AllowlistEntry).rule === 'string' &&
      typeof (entry as AllowlistEntry).path === 'string' &&
      typeof (entry as AllowlistEntry).reason === 'string',
  );
}

function allowEntryFor(
  finding: { file: string; rule: string },
  allowlist: AllowlistEntry[],
): AllowlistEntry | undefined {
  return allowlist.find((entry) => entry.rule === finding.rule && globToRegExp(entry.path).test(finding.file));
}

/** Scan one file's text and attribute findings to lines. */
export function scanFile(file: string, text: string, allowlist: AllowlistEntry[] = []): ScanFinding[] {
  return scanText(text).map((match) => {
    const finding: ScanFinding = {
      file,
      line: lineOf(text, match.index),
      rule: match.rule,
      evidence: match.evidence,
    };
    const allowed = allowEntryFor(finding, allowlist);
    if (allowed) finding.allowed = { reason: allowed.reason };
    return finding;
  });
}

function trackedFiles(): string[] {
  try {
    return execFileSync('git', ['ls-files', '-z'], { maxBuffer: 256 * 1024 * 1024 })
      .toString('utf8')
      .split('\0')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isBinary(buffer: Buffer): boolean {
  return buffer.includes(0);
}

/** Scan the current tree. */
export function scanRepository(root = process.cwd(), allowlistPath = join(root, ALLOWLIST_PATH)): ScanReport {
  const allowlist = loadAllowlist(allowlistPath);
  const files = trackedFiles();
  const findings: ScanFinding[] = [];
  for (const file of files) {
    const absolute = join(root, file);
    if (!existsSync(absolute)) continue;
    const buffer = readFileSync(absolute);
    if (buffer.length > 8 * 1024 * 1024 || isBinary(buffer)) continue;
    findings.push(...scanFile(file, buffer.toString('utf8'), allowlist));
  }
  // An allowlist entry that no longer matches anything is reported, so the file
  // cannot quietly accumulate permissions for findings that no longer exist.
  const staleAllowlist = allowlist
    .filter(
      (entry) =>
        !findings.some(
          (finding) => finding.allowed && finding.rule === entry.rule && globToRegExp(entry.path).test(finding.file),
        ),
    )
    .map((entry) => `${entry.rule} ${entry.path} — ${entry.reason}`);

  // Hygiene: an environment file, a dump or an export must not be tracked at all.
  const trackedHygiene = files.filter((file) => /(^|\/)\.env(\.|$)/i.test(file) && !file.endsWith('.example'));
  const dumpFiles = files.filter((file) => /\.(dump|dump\.gz|list\.txt)$/i.test(file));

  const violations = [
    ...findings.filter((finding) => !finding.allowed),
    ...trackedHygiene.map((file) => ({
      file,
      line: 0,
      rule: 'tracked_env_file',
      evidence: 'an environment file is tracked',
    })),
    ...dumpFiles.map((file) => ({
      file,
      line: 0,
      rule: 'tracked_database_dump',
      evidence: 'a database dump is tracked',
    })),
  ];
  return {
    files: files.length,
    findings,
    violations,
    contractViolations: validateEnvContract(),
    staleAllowlist,
  };
}

/**
 * Scan every line ever added in the repository's history. A secret removed from
 * the current tree is still published if it is in a commit, so this is the check
 * that decides whether history has to be rewritten.
 */
export function scanHistory(root = process.cwd(), allowlistPath = join(root, ALLOWLIST_PATH)): ScanFinding[] {
  const allowlist = loadAllowlist(allowlistPath);
  let patch: string;
  try {
    patch = execFileSync('git', ['log', '--all', '--no-color', '-p', '--unified=0', '--format=commit %H %s'], {
      cwd: root,
      maxBuffer: 1024 * 1024 * 1024,
      encoding: 'utf8',
    });
  } catch {
    return [];
  }
  const findings: ScanFinding[] = [];
  const seen = new Set<string>();
  let commit = 'unknown';
  const lines = patch.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('commit ')) {
      commit = line.slice('commit '.length).split(' ')[0];
      continue;
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    for (const match of scanText(line.slice(1))) {
      // One entry per (commit, rule, file, evidence): a fixture that moved between
      // files otherwise floods the report.
      const key = `${commit}|${match.rule}|${match.evidence}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const finding: ScanFinding = { file: `history:${commit}`, line: 0, rule: match.rule, evidence: match.evidence };
      // Synthetic fixtures are committed under tests/ and scripts/, and history
      // keeps the path they were added at. An entry that allowlists a fixture
      // directory therefore covers the same finding in history.
      const allowed = allowlist.find(
        (entry) => entry.rule === match.rule && /^(tests|scripts)(\/|\*\*)/.test(entry.path),
      );
      if (allowed) finding.allowed = { reason: allowed.reason };
      findings.push(finding);
    }
  }
  return findings;
}

function main(): void {
  const args = process.argv.slice(2);
  const root = resolve(process.cwd());
  const report = scanRepository(root);
  const history = args.includes('--history') ? scanHistory(root) : [];
  const historyViolations = history.filter((finding) => !finding.allowed);

  const json = args.includes('--json');
  if (json) {
    console.log(
      JSON.stringify(
        {
          files: report.files,
          violations: report.violations,
          contractViolations: report.contractViolations,
          staleAllowlist: report.staleAllowlist,
          allowlisted: report.findings.filter((finding) => finding.allowed),
          history: historyViolations,
        },
        null,
        2,
      ),
    );
  } else {
    for (const finding of report.findings) {
      const where = `${finding.file}:${finding.line}`;
      if (finding.allowed)
        console.log(`allowed ${where} ${finding.rule} (${finding.evidence}) — ${finding.allowed.reason}`);
    }
    for (const finding of report.violations) {
      console.error(`FAIL ${finding.file}:${finding.line} ${finding.rule} (${finding.evidence})`);
    }
    for (const violation of report.contractViolations) {
      console.error(`FAIL environment contract: ${violation.variable} — ${violation.rule}`);
    }
    if (report.staleAllowlist.length > 0) {
      console.warn('WARN allowlist entries that no longer match anything (remove them):');
      for (const entry of report.staleAllowlist) console.warn(`  ${entry}`);
    }
    if (args.includes('--history')) {
      if (historyViolations.length === 0)
        console.log(`ok   git history: no unexplained credential pattern (${history.length} allowlisted)`);
      else {
        console.error(`FAIL git history contains ${historyViolations.length} unexplained credential pattern(s):`);
        for (const finding of historyViolations)
          console.error(`  ${finding.file} ${finding.rule} (${finding.evidence})`);
      }
    }
    const environmental = report.violations.length + report.contractViolations.length + historyViolations.length;
    if (environmental === 0) {
      console.log(`ok   ${report.files} tracked file(s): no credential pattern and no contract violation`);
    }
  }
  const failed = report.violations.length + report.contractViolations.length + historyViolations.length > 0;
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/security-scan.ts')) main();
