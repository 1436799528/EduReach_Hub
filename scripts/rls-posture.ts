import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from './replay';

// BASE-1b: one classification per table in `public`, and the audit that proves
// the database matches it. The rule for granting a client role anything is
// narrow — a module that imports the browser Supabase client must actually read
// or write the table, or the table must be public-read by design. Everything
// else is server-only (reached as service_role, which bypasses RLS) or dormant
// (kept, but closed until a reviewed change opens it).
//
// See docs/features/BASE-1b.md. `tests/rls-posture.test.ts` fails if a table is
// missing from here, if the two disagree, or if any client-reachable table has
// RLS disabled.

export type Privilege = 'select' | 'insert' | 'update' | 'delete';
export type Access = 'public-read' | 'owner' | 'server-only' | 'dormant';

export interface TablePosture {
  table: string;
  access: Access;
  /** anon is the publishable key: never privileged, only ever public data. */
  anon: Privilege[];
  authenticated: Privilege[];
  /** Minimum number of policies expected on the table. */
  policies: number;
  /** True when the browser Supabase client reads or writes the table. */
  browser: boolean;
  why: string;
}

const SELECT: Privilege[] = ['select'];
const OWN_FULL: Privilege[] = ['select', 'insert', 'update', 'delete'];
const NONE: Privilege[] = [];

export const RLS_POSTURE: TablePosture[] = [
  // --- public read: the browser reads these with or without a session -------
  {
    table: 'institutions', access: 'public-read', anon: SELECT, authenticated: SELECT, policies: 1, browser: true,
    why: 'School finder and school detail pages read the directory without a session; row filtering lives in institutions_public_read (using true).',
  },
  {
    table: 'service_catalog', access: 'public-read', anon: SELECT, authenticated: SELECT, policies: 1, browser: true,
    why: 'Live service catalogue is advertised publicly; service_catalog_read_public filters to visible rows.',
  },
  {
    table: 'cbt_exams', access: 'public-read', anon: SELECT, authenticated: SELECT, policies: 1, browser: true,
    why: 'Exam setup lists active exams before sign-in; the policy filters on is_active.',
  },
  {
    table: 'news_articles', access: 'public-read', anon: SELECT, authenticated: SELECT, policies: 1, browser: true,
    why: 'Published news is public content; the policy hides unpublished rows.',
  },
  {
    table: 'opportunities', access: 'public-read', anon: SELECT, authenticated: SELECT, policies: 1, browser: true,
    why: 'Scholarships and jobs are public content; the policy filters to active rows.',
  },

  // --- owner-scoped: authenticated, restricted to its own rows by policy ----
  {
    table: 'profiles', access: 'owner', anon: NONE, authenticated: ['select', 'insert', 'update'], policies: 1, browser: true,
    why: 'Auth, dashboard and profile screens read and update the signed-in user; no delete verb is granted because no policy allows it.',
  },
  {
    table: 'service_requests', access: 'owner', anon: NONE, authenticated: ['select', 'insert', 'update'], policies: 1, browser: true,
    why: 'Students submit and track their own requests; staff read/update is policy-gated, deletes are server-side.',
  },
  {
    table: 'student_notifications', access: 'owner', anon: NONE, authenticated: OWN_FULL, policies: 1, browser: true,
    why: 'NTF-1 notifications are owner-scoped; the staff-insert policy is additionally constrained to staff roles.',
  },
  {
    table: 'student_saved_items', access: 'owner', anon: NONE, authenticated: OWN_FULL, policies: 1, browser: true,
    why: 'Personal saved items, owner-only policies for all four verbs.',
  },
  {
    table: 'student_cgpa_courses', access: 'owner', anon: NONE, authenticated: OWN_FULL, policies: 1, browser: true,
    why: 'CGPA calculator stores per-student courses; owner-only policies.',
  },
  {
    table: 'student_cgpa_terms', access: 'owner', anon: NONE, authenticated: OWN_FULL, policies: 1, browser: true,
    why: 'CGPA calculator stores per-student terms; owner-only policies.',
  },
  {
    table: 'student_security_events', access: 'owner', anon: NONE, authenticated: ['select', 'insert'], policies: 1, browser: true,
    why: 'Security modal records and lists the signed-in user events; no update/delete policy exists, so none is granted.',
  },
  {
    table: 'cbt_attempts', access: 'owner', anon: NONE, authenticated: SELECT, policies: 1, browser: true,
    why: 'The dashboard reads its own attempts; starting, answering and submitting go through security-definer RPCs, so no write verb is granted.',
  },

  // --- server-only: active features reached as service_role ----------------
  {
    table: 'student_wallets', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Financial balances. Written by handle_new_user() and wallet RPCs; there is no balance UI, so no client role may read it.',
  },
  {
    table: 'student_wallet_transactions', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Ledger rows. The owner-select policy stays in the history but is deliberately not granted until a wallet UI exists.',
  },
  {
    table: 'payment_events', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Payment idempotency ledger, written and read by the server only.',
  },
  {
    table: 'admin_audit_logs', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Audit trail. Reachable through admin_audit_log(), which is granted to service_role alone.',
  },
  {
    table: 'edureach_audit_logs', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Legacy audit trail, server-only.',
  },
  {
    table: 'rate_limit_hits', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Rate limiting state; exposing it would leak traffic patterns and invite tampering.',
  },
  {
    table: 'site_analytics_events', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Analytics arrive through the API, not PostgREST.',
  },
  {
    table: 'news_sources', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Newsroom configuration; managed by the pipeline.',
  },
  {
    table: 'news_ingest_runs', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Pipeline run log.',
  },
  {
    table: 'news_ingest_candidates', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Unpublished ingestion candidates; drafts must never be client-readable.',
  },
  {
    table: 'edureach_deadlines', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Read through the API by the server.',
  },
  {
    table: 'edureach_exams', access: 'server-only', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Legacy exam catalogue read by the server.',
  },
  {
    table: 'exam_questions', access: 'server-only', anon: NONE, authenticated: NONE, policies: 1, browser: false,
    why: 'Answer key. exam_questions_deny_client is a belt-and-braces policy behind the missing grant.',
  },

  // --- dormant / legacy: kept, closed, no application code path ------------
  {
    table: 'cbt_answers', access: 'dormant', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Client answer rows are written by RPC; the review of results goes through RPCs too, so no direct client access is needed.',
  },
  {
    table: 'campus_posts', access: 'dormant', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Campus Feed is not wired into the app. It had an insert-only policy with no read policy, which is not a coherent posture; closed until the feature is revived with a reviewed policy set.',
  },
  {
    table: 'campus_post_comments', access: 'dormant', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Legacy Campus Feed table, no RLS or policy ever existed.',
  },
  {
    table: 'campus_post_likes', access: 'dormant', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Legacy Campus Feed table, no RLS or policy ever existed.',
  },
  {
    table: 'resources', access: 'dormant', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Materials library has no UI. Its storage policy sub-selects this table, so reviving uploads must re-grant select together with the policy work (see 02-DATA-MODEL.md).',
  },
  {
    table: 'courses', access: 'dormant', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Course catalogue is not read by the app; the CGPA calculator keeps its own per-student courses.',
  },
  {
    table: 'past_questions', access: 'dormant', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'No UI reads the bank yet. The existing entitlement policy (uploader, staff, or approved and in the same programme) is good and stays; granting it is a reviewed change when the page becomes real.',
  },
  {
    table: 'edureach_material_notes', access: 'dormant', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Owner policies exist but no application reference; closed until used.',
  },
  {
    table: 'edureach_notifications', access: 'dormant', anon: NONE, authenticated: NONE, policies: 0, browser: false,
    why: 'Superseded by student_notifications and the NTF-1 owner model; the legacy staff-insert policy stays but has no table grant.',
  },
];

const PRIVILEGES: Privilege[] = ['select', 'insert', 'update', 'delete'];

export interface ActualPosture {
  table: string;
  rls: boolean;
  policies: number;
  anon: Privilege[];
  authenticated: Privilege[];
}

const POSTURE_QUERY = `
  select
    c.relname as "table",
    c.relrowsecurity as rls,
    (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies,
    has_table_privilege('anon', c.oid, 'select')          as anon_select,
    has_table_privilege('anon', c.oid, 'insert')          as anon_insert,
    has_table_privilege('anon', c.oid, 'update')          as anon_update,
    has_table_privilege('anon', c.oid, 'delete')          as anon_delete,
    has_table_privilege('authenticated', c.oid, 'select') as auth_select,
    has_table_privilege('authenticated', c.oid, 'insert') as auth_insert,
    has_table_privilege('authenticated', c.oid, 'update') as auth_update,
    has_table_privilege('authenticated', c.oid, 'delete') as auth_delete
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname`;

export async function readActualPosture(db: PGlite): Promise<ActualPosture[]> {
  const { rows } = await db.query<Record<string, boolean | number | string>>(POSTURE_QUERY);
  return rows.map((row) => {
    const collect = (prefix: 'anon' | 'auth'): Privilege[] =>
      PRIVILEGES.filter((privilege) => Boolean(row[`${prefix}_${privilege}`]));
    return {
      table: row.table as string,
      rls: row.rls as boolean,
      policies: row.policies as number,
      anon: collect('anon'),
      authenticated: collect('auth'),
    };
  });
}

export interface Finding {
  table: string;
  problem: string;
}

/** Compares the database with the classification. Empty findings = classified. */
export function comparePosture(actual: ActualPosture[]): Finding[] {
  const findings: Finding[] = [];
  const byTable = new Map(actual.map((row) => [row.table, row]));
  const classified = new Set(RLS_POSTURE.map((entry) => entry.table));

  for (const row of actual) {
    if (!classified.has(row.table)) {
      findings.push({ table: row.table, problem: 'unclassified: decide its access model in scripts/rls-posture.ts' });
    }
  }
  for (const expected of RLS_POSTURE) {
    const row = byTable.get(expected.table);
    if (!row) {
      findings.push({ table: expected.table, problem: 'classified but not created by any migration' });
      continue;
    }
    if (!row.rls) {
      findings.push({ table: expected.table, problem: 'RLS is disabled' });
    }
    const samePrivileges = (a: Privilege[], b: Privilege[]) =>
      a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');
    if (!samePrivileges(row.anon, expected.anon)) {
      findings.push({ table: expected.table, problem: `anon privileges are ${row.anon.join(',') || 'none'}, expected ${expected.anon.join(',') || 'none'}` });
    }
    if (!samePrivileges(row.authenticated, expected.authenticated)) {
      findings.push({ table: expected.table, problem: `authenticated privileges are ${row.authenticated.join(',') || 'none'}, expected ${expected.authenticated.join(',') || 'none'}` });
    }
    if (expected.policies > 0 && row.policies < expected.policies) {
      findings.push({ table: expected.table, problem: `has ${row.policies} policies, expected at least ${expected.policies}` });
    }
  }

  // The invariant that makes the rest meaningful: a reachable table without RLS
  // is readable by anyone holding the publishable key.
  for (const row of actual) {
    if (!row.rls && (row.anon.length > 0 || row.authenticated.length > 0)) {
      findings.push({ table: row.table, problem: 'client-reachable with RLS disabled' });
    }
  }
  // Any client access needs a policy to bound it to rows.
  for (const row of actual) {
    if ((row.anon.length > 0 || row.authenticated.length > 0) && row.policies === 0) {
      findings.push({ table: row.table, problem: 'client privileges granted but no policy exists' });
    }
  }
  return findings;
}

async function main() {
  const db = new PGlite();
  try {
    await applyMigrations(db);
    const actual = await readActualPosture(db);
    const findings = comparePosture(actual);
    const expected = new Map(RLS_POSTURE.map((entry) => [entry.table, entry]));
    console.log('table'.padEnd(28), 'rls', 'pol', 'anon'.padEnd(22), 'authenticated'.padEnd(28), 'access');
    for (const row of actual) {
      const entry = expected.get(row.table);
      console.log(
        row.table.padEnd(28),
        (row.rls ? 'on ' : 'OFF'),
        String(row.policies).padStart(3),
        (row.anon.join(',') || '-').padEnd(22),
        (row.authenticated.join(',') || '-').padEnd(28),
        entry ? `${entry.access}${entry.browser ? ' (browser)' : ''}` : 'UNCLASSIFIED',
      );
    }
    console.log(`\n${actual.length} public tables, ${RLS_POSTURE.length} classified, ${findings.length} findings.`);
    for (const finding of findings) console.log(`  ✗ ${finding.table}: ${finding.problem}`);
    if (findings.length > 0) process.exitCode = 1;
    else console.log('BASE-1b audit: every public table is classified and the database matches the classification.');
  } finally {
    await db.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
