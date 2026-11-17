/**
 * The institution data-access boundary.
 *
 * Every institution read in the app goes through this module, for one reason:
 * the deployed schema and the schema the product is being built for are not the
 * same schema, and only one place should know the difference.
 *
 *   * `public.institutions` is live. It holds 329 rows and the columns listed
 *     in `INSTITUTION_DIRECTORY_COLUMNS`. It is the directory.
 *   * `institution_profiles`, `institution_campuses`, `institution_academic_units`,
 *     `institution_programme_offerings`, `institution_admission_routes`,
 *     `institution_programme_requirements`, `institution_admission_benchmarks`
 *     and `institution_portal_guides` are defined by
 *     `supabase/migrations/20261117120000_institution_intelligence.sql`, which is
 *     **not applied to production**. Nothing here queries them.
 *
 * `INSTITUTION_INTELLIGENCE_DEPLOYED` is the deployment contract. It is a
 * single, reviewed constant — not a runtime probe, not a `try/catch` around a
 * missing-table error, and not a browser-side schema inspection. Flipping it
 * before the migration and the verified import are in place would make the
 * frontend ask for tables that do not exist.
 */

import { fetchInstitutionIntelligence } from '../api';
import { isSupabaseConfigured, supabase } from '../supabase';
import { canonicalInstitutionId } from './aliases';
import { deduplicateInstitutions } from './selectors';
import {
  INSTITUTION_DIRECTORY_COLUMNS,
  mapDirectoryRow,
  mapProfileFromDirectory,
  mergeIntelligence,
  type InstitutionIntelligencePayload,
  type InstitutionRow,
} from './mappers';
import { isInstitutionId } from './normalizers';
import type { InstitutionProfile, InstitutionSummary } from './types';

/**
 * Whether the institution-intelligence schema is applied and its import has
 * been verified in the environment this bundle targets.
 *
 * Flip to `true` only when all three are true:
 *   1. `20261117120000_institution_intelligence.sql` and
 *      `20261117121000_institution_import_function.sql` are applied to the
 *      target database;
 *   2. the researched batch has been imported and reviewed through
 *      `/admin/institution-intelligence`;
 *   3. the production-validate and RLS-posture scripts pass against it.
 */
export const INSTITUTION_INTELLIGENCE_DEPLOYED = {
  applied: false,
};

export function institutionIntelligenceDeployed(): boolean {
  return INSTITUTION_INTELLIGENCE_DEPLOYED.applied === true;
}

/* -------------------------------------------------------------------------- */
/* Client shape                                                                */
/* -------------------------------------------------------------------------- */

type RowsResult = PromiseLike<{ data: unknown[] | null; error: unknown }>;

/**
 * The structural surface of the Supabase client this module needs.
 *
 * Kept narrow so the repository is testable with a plain object — no network,
 * no live project — and so a page cannot quietly add its own institution query.
 */
export interface InstitutionDirectoryClient {
  from(table: 'institutions'): {
    select(columns: string): {
      order(column: string, options?: { ascending?: boolean }): RowsResult & {
        limit(count: number): RowsResult;
      };
    };
  };
}

/** Rows above the directory cap are not a directory the finder should paginate. */
export const DIRECTORY_ROW_LIMIT = 500;

/**
 * Load the live institution directory.
 *
 * Reads only columns that exist in the deployed table. Returns an empty array
 * when Supabase is not configured; the caller decides what an unconfigured
 * preview shows.
 */
export async function fetchInstitutionDirectory(
  client?: InstitutionDirectoryClient,
): Promise<InstitutionSummary[]> {
  // Injecting a client takes responsibility for the connection, which is what
  // the tests and server-side callers do. Without one, an unconfigured
  // environment must not fire a request at the inert fallback client.
  if (!client && !isSupabaseConfigured) return [];
  const active = client ?? (supabase as unknown as InstitutionDirectoryClient);
  const { data, error } = await active
    .from('institutions')
    .select(INSTITUTION_DIRECTORY_COLUMNS)
    .order('school_name', { ascending: true })
    .limit(DIRECTORY_ROW_LIMIT);
  if (error) throw error;
  return (data ?? [])
    .map((row) => mapDirectoryRow((row ?? {}) as InstitutionRow))
    .filter((institution): institution is InstitutionSummary => institution !== null);
}

/**
 * One institution EduReach can actually serve for Post-UTME practice.
 *
 * `method` is the institution's own published screening method. It is never
 * assumed from the institution's name or from what other schools do.
 */
export interface PostUtmeSchool {
  id: string;
  name: string;
  acronym: string | null;
  state: string | null;
  method: 'cbt' | 'handwritten';
  sourceUrl: string | null;
}

/**
 * Institutions whose Post-UTME participation is verified.
 *
 * Two filters, both from the institutions' own verified configuration:
 * participation must be switched on *and* reviewed, and a screening method
 * must be published. A school with no published method is not offered, because
 * guessing CBT for a paper-based school would send a student to the wrong
 * practice. The list is also de-duplicated through the identity layer, so a
 * reconciled institution appears once.
 */
export async function fetchPostUtmeDirectory(
  client: InstitutionDirectoryClient = supabase as unknown as InstitutionDirectoryClient,
): Promise<PostUtmeSchool[]> {
  const directory = await fetchInstitutionDirectory(client);
  return deduplicateInstitutions(directory)
    .filter((institution) => {
      const postUtme = institution.postUtme;
      return postUtme?.available === true && (postUtme.method === 'cbt' || postUtme.method === 'handwritten');
    })
    .map((institution) => ({
      id: institution.id,
      name: institution.name,
      acronym: institution.acronym,
      state: institution.state,
      method: institution.postUtme!.method as 'cbt' | 'handwritten',
      sourceUrl: institution.postUtme!.sourceUrl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/**
 * Load one institution's profile.
 *
 * The directory row is the identity and always comes from the deployed table.
 * The richer sections are only requested when the deployment contract says the
 * intelligence schema exists; otherwise they are reported as `not_imported`,
 * which is the true state of the product rather than a loading placeholder.
 */
export async function fetchInstitutionProfile(
  institutionId: string,
  options: {
    client?: InstitutionDirectoryClient;
    signal?: AbortSignal;
  } = {},
): Promise<InstitutionProfile | null> {
  const canonicalId = canonicalInstitutionId(institutionId);
  if (!isInstitutionId(canonicalId)) return null;

  const client = options.client;
  if (!client && !isSupabaseConfigured) return null;
  const active = client ?? (supabase as unknown as InstitutionDirectoryClient);

  const { data, error } = await active
    .from('institutions')
    .select(INSTITUTION_DIRECTORY_COLUMNS)
    .order('school_name', { ascending: true })
    .limit(DIRECTORY_ROW_LIMIT);
  if (error) throw error;

  const rows = (data ?? []) as InstitutionRow[];
  const row = rows.find((candidate) => String(candidate?.id ?? '').toLowerCase() === canonicalId.toLowerCase());
  if (!row) return null;

  const summary = mapDirectoryRow(row);
  if (!summary) return null;

  if (!institutionIntelligenceDeployed()) {
    return mapProfileFromDirectory(summary);
  }

  try {
    const payload = (await fetchInstitutionIntelligence(canonicalId)) as unknown as InstitutionIntelligencePayload;
    return mergeIntelligence(summary, payload);
  } catch (cause) {
    // A failed intelligence read must not lose the directory identity the
    // student came for: the profile degrades to "not published yet" per
    // section, and the error is surfaced rather than swallowed.
    const profile = mapProfileFromDirectory(summary);
    return {
      ...profile,
      readError: cause instanceof Error ? cause.message : 'Institution intelligence is temporarily unavailable.',
    };
  }
}
