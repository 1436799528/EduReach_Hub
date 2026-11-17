/**
 * Institution intelligence API.
 *
 * Three audiences, three different rules:
 *
 *   * a visitor reads only rows that are both verified and published — this
 *     server uses the service role, so RLS does not filter for it and every
 *     read below names its own status filters. The assembled response is held in
 *     a short stale-while-revalidate cache so a popular school page does not
 *     rebuild eleven queries per reader;
 *   * staff see every row, including the unverified ones, and can correct it.
 *     Nothing is discarded during review: an unverified programme remains
 *     editable until someone checks it;
 *   * a student owns exactly one admission goal, always keyed by the session
 *     identity — never by an id in the request body.
 *
 * Verification and publication are separate acts. The API refuses to publish an
 * unverified row, and the database enforces the same rule in
 * `20261118120000_institution_review_gate.sql`.
 *
 * The student endpoints never project a practice percentage into a UTME score
 * and never claim an admission probability. See `src/lib/admissionGoal.ts`.
 */

import type { Express, Request, Response } from 'express';
import {
  computeGoalProgress,
  describeBenchmark,
  matchAttemptToRequirement,
  type MatchStatus,
} from '../lib/admissionGoal';
import {
  filterOptions,
  filterReviewRows,
  isAdmissionSession,
  isUuid,
  publicationGate,
  reviewChecklist,
  reviewChecklistForRow,
  summarizeReview,
  validateEvidencePatch,
  validateProfileSection,
  validateProgrammePatch,
  validateRequirementPatch,
  validateRoutePatch,
  validateUnitPatch,
  type ReviewOverviewRow,
} from './institutionAdmin';
import { createPublicCache, PRIVATE_CACHE_CONTROL, PUBLIC_CACHE_CONTROL } from './publicCache';

export interface InstitutionIntelligenceDeps {
  // Injected exactly as server.ts defines them; their capability unions are
  // wider than this module needs, so they are typed structurally here.
  requireUser: (req: Request, capability?: any) => Promise<{ supabase: any; rpcSupabase: any; user: { id: string } }>;
  requireCapability: (...capabilities: any[]) => any;
  getSupabase: () => any;
  recordAudit: (supabase: any, entry: any) => Promise<any>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROFILE_COLUMNS = [
  'institution_id', 'official_name', 'ownership', 'institution_category', 'year_established',
  'history_summary', 'overview', 'mission', 'vision', 'mandate', 'postal_address', 'city', 'country',
  'latitude', 'longitude', 'logo_url', 'hero_image_url', 'official_website_url', 'admission_portal_url',
  'student_portal_url', 'postgraduate_portal_url', 'profile_status', 'publication_status',
  'verification_status', 'profile_verified_at', 'source_id', 'source_url', 'review_note',
  'reviewed_by', 'last_checked_at', 'created_at', 'updated_at',
].join(',');

export interface InstitutionIntelligencePayload {
  institution: Record<string, unknown>;
  aliases: Array<Record<string, unknown>>;
  profile: Record<string, unknown> | null;
  leadership: Array<Record<string, unknown>>;
  campuses: Array<Record<string, unknown>>;
  academicUnits: Array<Record<string, unknown>>;
  offerings: Array<Record<string, unknown>>;
  admissionRoutes: Array<Record<string, unknown>>;
  programmeRequirements: Array<Record<string, unknown>>;
  benchmarks: Array<Record<string, unknown>>;
  portalGuides: Array<Record<string, unknown>>;
  nationalPolicies: Array<Record<string, unknown>>;
  generatedAt: string;
  verifiedOnly: true;
  caveats: string[];
}

class InstitutionNotFound extends Error {
  code = 'INSTITUTION_NOT_FOUND';
}

/**
 * The public payload. Every list below names `verified` (and, where the column
 * exists, `published`) in its own query: RLS does not apply to the service role,
 * so an omission here would be a leak.
 */
async function readPublicIntelligence(supabase: any, institutionId: string): Promise<InstitutionIntelligencePayload> {
  const institution = await supabase
    .from('institutions')
    .select('id,school_name,acronym,state,institution_type,website_url,admission_portal_url,student_portal_url')
    .eq('id', institutionId)
    .maybeSingle();
  if (institution.error) throw institution.error;
  if (!institution.data) throw new InstitutionNotFound('Institution not found.');

  const [profile, leadership, campuses, units, offerings, routes, guides, policies] = await Promise.all([
    supabase.from('institution_profiles')
      .select(PROFILE_COLUMNS)
      .eq('institution_id', institutionId).eq('publication_status', 'published').eq('verification_status', 'verified').maybeSingle(),
    supabase.from('institution_leadership')
      .select('office_key,office_title,full_name,acting_status,starts_on,is_current,verification_status')
      .eq('institution_id', institutionId).eq('is_current', true).eq('verification_status', 'verified'),
    supabase.from('institution_campuses')
      .select('id,campus_name,campus_type,city,state,address')
      .eq('institution_id', institutionId).eq('is_active', true).eq('verification_status', 'verified'),
    supabase.from('institution_academic_units')
      .select('id,parent_unit_id,unit_type,unit_name,slug')
      .eq('institution_id', institutionId).eq('is_active', true).eq('verification_status', 'verified'),
    supabase.from('institution_programme_offerings')
      .select('id,programme_name,programme_code,degree_title,award_level,duration_years,admission_session,academic_unit_id')
      .eq('institution_id', institutionId).eq('is_active', true).eq('publication_status', 'published').eq('verification_status', 'verified'),
    supabase.from('institution_admission_routes')
      .select('id,admission_session,entry_mode,assessment_methods,first_choice_required,change_of_institution_allowed,application_url,opens_on,closes_on,eligibility_notes')
      .eq('institution_id', institutionId).eq('publication_status', 'published').eq('verification_status', 'verified'),
    supabase.from('institution_portal_guides')
      .select('id,guide_type,title,admission_session,portal_url,summary,safety_note')
      .eq('institution_id', institutionId).eq('publication_status', 'published').eq('verification_status', 'verified'),
    supabase.from('national_admission_policies')
      .select('authority,admission_session,institution_category,entry_mode,policy_type,numeric_value,value_unit,notes')
      .eq('publication_status', 'published').eq('verification_status', 'verified').order('admission_session', { ascending: false }),
  ]);

  for (const result of [profile, leadership, campuses, units, offerings, routes, guides, policies]) {
    if (result.error) throw result.error;
  }

  const offeringIds = (offerings.data ?? []).map((row: any) => row.id);
  const guideIds = (guides.data ?? []).map((row: any) => row.id);

  const [benchmarks, requirements, steps, aliases] = await Promise.all([
    offeringIds.length
      ? supabase.from('institution_admission_benchmarks')
          .select('id,programme_offering_id,admission_session,benchmark_type,benchmark_label,benchmark_value,score_scale_min,score_scale_max,category_key,state_category,is_eligibility_floor,calculation_method,notes')
          .eq('institution_id', institutionId).eq('publication_status', 'published').eq('verification_status', 'verified')
      : Promise.resolve({ data: [], error: null }),
    offeringIds.length
      ? supabase.from('institution_programme_requirements')
          .select('id,programme_offering_id,admission_session,entry_mode,utme_subjects,o_level_requirements,a_level_requirements,other_requirements,minimum_utme_score,minimum_utme_scale,first_choice_required,notes')
          .in('programme_offering_id', offeringIds).eq('publication_status', 'published').eq('verification_status', 'verified')
      : Promise.resolve({ data: [], error: null }),
    guideIds.length
      ? supabase.from('institution_portal_guide_steps')
          .select('guide_id,step_number,title,instruction,official_url,required_documents,warning')
          .in('guide_id', guideIds).order('step_number', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase.from('institution_aliases')
      .select('alias_name,alias_type,preferred_display')
      .eq('institution_id', institutionId).eq('verification_status', 'verified'),
  ]);
  for (const result of [benchmarks, requirements, steps, aliases]) {
    if (result.error) throw result.error;
  }

  return {
    institution: institution.data,
    aliases: aliases.data ?? [],
    profile: profile.data ?? null,
    leadership: leadership.data ?? [],
    campuses: campuses.data ?? [],
    academicUnits: units.data ?? [],
    offerings: offerings.data ?? [],
    admissionRoutes: routes.data ?? [],
    programmeRequirements: requirements.data ?? [],
    benchmarks: (benchmarks.data ?? []).map((row: any) => ({ ...row, description: describeBenchmark(row) })),
    portalGuides: (guides.data ?? []).map((guide: any) => ({
      ...guide,
      steps: (steps.data ?? []).filter((step: any) => step.guide_id === guide.id),
    })),
    nationalPolicies: policies.data ?? [],
    generatedAt: new Date().toISOString(),
    verifiedOnly: true,
    caveats: [
      'Only facts reviewed and published by EduReach are shown. An empty section means "not published yet", never "does not exist".',
      'National minimums are policy floors, not departmental cut-offs. Each threshold is shown with the scale its institution published.',
      'EduReach never asks for your portal password, PIN, card details or OTP, and never collects payment for an institution.',
    ],
  };
}

/**
 * One cache for the public payload. Keys are institution ids and contain no
 * caller identity, which is why the route is safe to share between visitors.
 */
export const intelligenceCache = createPublicCache<InstitutionIntelligencePayload>({
  ttlMs: 60_000,
  staleMs: 600_000,
  shouldCache: (payload) => Boolean(payload.profile),
  onError: (error, key) => console.warn('[institution-cache] refresh failed', key, (error as Error)?.message),
});

export function invalidateInstitutionCache(institutionId: string): void {
  intelligenceCache.invalidate(`institution:${institutionId}:intelligence`);
}

function adminGateFailure(res: Response, error: string) {
  return res.status(409).json({ error, gate: true });
}

function sendValidation(res: Response, result: { error?: string; gate?: boolean }) {
  if (result.gate) return adminGateFailure(res, result.error ?? 'This record cannot be published yet.');
  return res.status(400).json({ error: result.error ?? 'Those values could not be saved.' });
}

export function registerInstitutionIntelligenceRoutes(app: Express, deps: InstitutionIntelligenceDeps) {
  const { requireUser, requireCapability, getSupabase, recordAudit } = deps;

  // --------------------------------------------------------------- public read
  app.get('/api/institutions/:institutionId/intelligence', async (req: Request, res: Response) => {
    const institutionId = String(req.params.institutionId);
    if (!UUID.test(institutionId)) return res.status(400).json({ error: 'Invalid institution id.' });
    try {
      const supabase = getSupabase();
      const read = await intelligenceCache.get(
        `institution:${institutionId}:intelligence`,
        () => readPublicIntelligence(supabase, institutionId),
      );
      // Public only because the payload above is filtered to verified+published
      // rows and contains no caller-specific data. Admin and student routes
      // never set this header.
      res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
      res.setHeader('X-EduReach-Cache', read.state);
      res.json(read.value);
    } catch (error) {
      if ((error as { code?: string })?.code === 'INSTITUTION_NOT_FOUND') {
        res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
        return res.status(404).json({ error: 'Institution not found.' });
      }
      console.error('Institution intelligence read error:', error);
      // A temporary database problem must not be cached as an answer.
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      res.status(503).json({ error: 'Institution intelligence is temporarily unavailable.' });
    }
  });

  // ------------------------------------------------------- admin review queue
  app.get('/api/admin/institution-intelligence/review', requireCapability('institution.read'), async (_req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const [evidence, offerings, benchmarks, guides, profiles, overview, sources] = await Promise.all([
        supabase.from('institution_fact_evidence')
          .select('id,institution_id,entity_type,entity_id,field_key,claimed_value,source_url,applicable_session,verification_status,checked_at,review_note,created_at')
          .in('verification_status', ['discovered', 'in_review']).order('created_at', { ascending: true }).limit(200),
        supabase.from('institution_programme_offerings')
          .select('id,institution_id,programme_name,admission_session,publication_status,verification_status')
          .in('publication_status', ['in_review']).limit(200),
        supabase.from('institution_admission_benchmarks')
          .select('id,institution_id,benchmark_type,benchmark_label,benchmark_value,score_scale_max,admission_session,verification_status')
          .eq('verification_status', 'in_review').limit(200),
        supabase.from('institution_portal_guides')
          .select('id,institution_id,guide_type,title,admission_session,verification_status')
          .eq('verification_status', 'in_review').limit(200),
        supabase.from('institution_intelligence_completeness').select('*').limit(500),
        supabase.from('institution_review_overview').select('*').order('school_name', { ascending: true }).limit(500),
        supabase.from('edureach_sources').select('id', { count: 'exact', head: true }),
      ]);
      for (const result of [evidence, offerings, benchmarks, guides, profiles, overview]) {
        if (result.error) throw result.error;
      }
      const rows = (overview.data ?? []) as ReviewOverviewRow[];
      // A source-count failure must not hide the queue; it is reported as null.
      const sourceRecords = sources.error ? null : (sources.count ?? 0);
      res.json({
        awaitingReview: evidence.data ?? [],
        offeringsInReview: offerings.data ?? [],
        benchmarksInReview: benchmarks.data ?? [],
        guidesInReview: guides.data ?? [],
        completeness: profiles.data ?? [],
        summary: summarizeReview(rows, sourceRecords ?? rows.reduce((total, row) => total + row.source_records, 0)),
        institutions: rows,
        filterOptions: filterOptions(rows),
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Institution review queue error:', error);
      const missingView = /institution_review_overview|schema cache|does not exist/i.test(String((error as Error)?.message ?? ''));
      res.status(503).json({
        error: missingView
          ? 'The institution review view is not installed in this database yet. Apply the institution review migration, then reload.'
          : 'Unable to load the institution review queue.',
      });
    }
  });

  /**
   * The filtered institution list. The same rows power the queue above; this
   * endpoint exists so a filter can be served without re-fetching evidence.
   */
  app.get('/api/admin/institution-intelligence/institutions', requireCapability('institution.read'), async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const { data, error } = await supabase
        .from('institution_review_overview')
        .select('*')
        .order('school_name', { ascending: true })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as ReviewOverviewRow[];
      const filters = {
        search: typeof req.query.search === 'string' ? req.query.search : '',
        state: typeof req.query.state === 'string' ? req.query.state : '',
        institutionType: typeof req.query.type === 'string' ? req.query.type : '',
        verification: typeof req.query.verification === 'string' ? req.query.verification : '',
        publication: typeof req.query.publication === 'string' ? req.query.publication : '',
        session: typeof req.query.session === 'string' ? req.query.session : '',
        missing: typeof req.query.missing === 'string' ? req.query.missing : '',
        source: typeof req.query.source === 'string' ? req.query.source : '',
      };
      res.json({
        institutions: filterReviewRows(rows, filters).map((row) => ({ ...row, checks: reviewChecklistForRow(row) })),
        options: filterOptions(rows),
        total: rows.length,
      });
    } catch (error) {
      console.error('Institution list error:', error);
      res.status(503).json({ error: 'Unable to load the institution list.' });
    }
  });

  // --------------------------------------------------------- admin institution
  app.get('/api/admin/institution-intelligence/institutions/:institutionId', requireCapability('institution.read'), async (req: Request, res: Response) => {
    const institutionId = String(req.params.institutionId);
    if (!UUID.test(institutionId)) return res.status(400).json({ error: 'Invalid institution id.' });
    try {
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const institution = await supabase.from('institutions')
        .select('id,school_name,acronym,state,institution_type,website_url,admission_portal_url,student_portal_url,post_utme_available,is_verified')
        .eq('id', institutionId).maybeSingle();
      if (institution.error) throw institution.error;
      if (!institution.data) return res.status(404).json({ error: 'Institution not found.' });

      const [profile, units, offerings, routes, guides, evidence, sources] = await Promise.all([
        supabase.from('institution_profiles').select(PROFILE_COLUMNS).eq('institution_id', institutionId).maybeSingle(),
        supabase.from('institution_academic_units')
          .select('id,parent_unit_id,unit_type,unit_name,slug,description,website_url,is_active,verification_status,source_id,source_url,review_note,reviewed_by,last_checked_at,created_at,updated_at')
          .eq('institution_id', institutionId).order('unit_type').order('unit_name'),
        supabase.from('institution_programme_offerings')
          .select('id,academic_unit_id,programme_code,programme_name,degree_title,award_level,duration_years,admission_session,is_active,publication_status,verification_status,source_id,source_url,review_note,reviewed_by,last_checked_at,updated_at')
          .eq('institution_id', institutionId).order('programme_name'),
        supabase.from('institution_admission_routes')
          .select('id,admission_session,entry_mode,assessment_methods,first_choice_required,change_of_institution_allowed,application_url,opens_on,closes_on,eligibility_notes,publication_status,verification_status,source_url,review_note,reviewed_by,last_checked_at')
          .eq('institution_id', institutionId).order('admission_session', { ascending: false }),
        supabase.from('institution_portal_guides')
          .select('id,guide_type,title,admission_session,portal_url,summary,safety_note,publication_status,verification_status,source_url,review_note,reviewed_by,last_checked_at')
          .eq('institution_id', institutionId).order('guide_type'),
        supabase.from('institution_fact_evidence')
          .select('id,entity_type,entity_id,field_key,claimed_value,source_id,source_url,source_published_at,applicable_session,verification_status,checked_at,checked_by,review_note,created_at')
          .eq('institution_id', institutionId).order('checked_at', { ascending: false, nullsFirst: false }).limit(500),
        supabase.from('edureach_sources').select('id,name,url,authority,source_type,created_at').order('name'),
      ]);
      for (const result of [profile, units, offerings, routes, guides, evidence, sources]) {
        if (result.error) throw result.error;
      }

      const offeringIds = (offerings.data ?? []).map((row: any) => row.id);
      const requirements = offeringIds.length
        ? await supabase.from('institution_programme_requirements')
            .select('id,programme_offering_id,admission_session,entry_mode,utme_subjects,o_level_requirements,a_level_requirements,other_requirements,minimum_utme_score,minimum_utme_scale,first_choice_required,notes,publication_status,verification_status,source_url,review_note,reviewed_by,last_checked_at')
            .in('programme_offering_id', offeringIds)
            .order('admission_session', { ascending: false })
        : { data: [], error: null };
      if (requirements.error) throw requirements.error;

      const reviewerIds = [...new Set([
        ...(units.data ?? []).map((row: any) => row.reviewed_by),
        ...(offerings.data ?? []).map((row: any) => row.reviewed_by),
        ...(routes.data ?? []).map((row: any) => row.reviewed_by),
        ...(guides.data ?? []).map((row: any) => row.reviewed_by),
        ...(evidence.data ?? []).map((row: any) => row.checked_by),
        profile.data?.reviewed_by,
      ].filter(Boolean))];
      const reviewers = reviewerIds.length
        ? await supabase.from('profiles').select('id,full_name').in('id', reviewerIds)
        : { data: [], error: null };

      const row: ReviewOverviewRow | null = (await supabase
        .from('institution_review_overview').select('*').eq('institution_id', institutionId).maybeSingle()).data;
      const counts = {
        units: (units.data ?? []).length,
        unitsUnverified: (units.data ?? []).filter((unit: any) => unit.verification_status !== 'verified').length,
        offerings: (offerings.data ?? []).length,
        offeringsUnverified: (offerings.data ?? []).filter((row2: any) => row2.verification_status !== 'verified').length,
        routes: (routes.data ?? []).length,
        routesWithDates: (routes.data ?? []).filter((route: any) => route.opens_on || route.closes_on).length,
        requirements: (requirements.data ?? []).length,
        requirementsWithSubjects: (requirements.data ?? []).filter((req2: any) => (req2.utme_subjects ?? []).length > 0).length,
      };

      res.json({
        institution: institution.data,
        profile: profile.data ?? null,
        units: units.data ?? [],
        offerings: offerings.data ?? [],
        requirements: requirements.data ?? [],
        admissionRoutes: routes.data ?? [],
        portalGuides: guides.data ?? [],
        evidence: evidence.data ?? [],
        sources: sources.data ?? [],
        reviewers: Object.fromEntries((reviewers.data ?? []).map((person: any) => [person.id, person.full_name || 'Reviewer'])),
        sessions: row?.admission_sessions ?? [],
        checklist: row
          ? reviewChecklistForRow(row)
          : reviewChecklist({
              profile: profile.data ? { official_name: profile.data.official_name, verification_status: profile.data.verification_status, publication_status: profile.data.publication_status, official_website_url: profile.data.official_website_url } : null,
              institution: institution.data,
              counts,
              profileImages: profile.data ?? {},
              portalUrls: {
                admission: profile.data?.admission_portal_url,
                student: profile.data?.student_portal_url,
                postgraduate: profile.data?.postgraduate_portal_url,
              },
            }),
        gate: {
          rule: 'publication_status = published requires verification_status = verified',
          profile: publicationGate(profile.data?.verification_status, profile.data?.publication_status),
        },
      });
    } catch (error) {
      console.error('Institution detail error:', error);
      res.status(503).json({ error: 'Unable to load this institution for review.' });
    }
  });

  app.patch('/api/admin/institution-intelligence/institutions/:institutionId/profile', requireCapability('institution.update'), async (req: Request, res: Response) => {
    const institutionId = String(req.params.institutionId);
    if (!UUID.test(institutionId)) return res.status(400).json({ error: 'Invalid institution id.' });
    try {
      const adminUser = (req as any).adminUser as { id: string };
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);

      const current = await supabase.from('institution_profiles')
        .select('institution_id,verification_status,publication_status,official_name')
        .eq('institution_id', institutionId).maybeSingle();
      if (current.error) throw current.error;

      const section = String(req.body?.section ?? '');
      const values = req.body?.values;
      const validated = validateProfileSection(section, values, current.data ?? {});
      if (!validated.ok || !validated.value) return sendValidation(res, validated);

      const { profile, directory, verification, publication } = validated.value;
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        ...profile,
        reviewed_by: adminUser.id,
        last_checked_at: now,
      };
      if (profile.verification_status) {
        patch.profile_verified_at = verification === 'verified' ? now : null;
      }
      if (!current.data) patch.institution_id = institutionId;

      const saved = await supabase.from('institution_profiles')
        .upsert(patch, { onConflict: 'institution_id' })
        .select(PROFILE_COLUMNS).single();
      if (saved.error) throw saved.error;

      if (Object.keys(directory).length) {
        const updated = await supabase.from('institutions').update(directory).eq('id', institutionId).select('id').maybeSingle();
        if (updated.error) throw updated.error;
      }

      invalidateInstitutionCache(institutionId);
      await recordAudit(supabase, {
        actorId: adminUser.id,
        action: 'update',
        resourceType: 'institution_profile',
        resourceId: institutionId,
        metadata: { section, fields: Object.keys(profile), verification, publication, directory_fields: Object.keys(directory) },
      });
      res.json({
        profile: saved.data,
        verification_status: verification,
        publication_status: publication,
        savedAt: now,
        checklist: null,
      });
    } catch (error) {
      console.error('Institution profile write error:', error);
      const gate = /cannot be published|publication gate/i.test(String((error as Error)?.message ?? ''));
      if (gate) return adminGateFailure(res, 'This record cannot be published while it is unverified.');
      res.status(500).json({ error: 'Unable to save that profile section.' });
    }
  });

  // --------------------------------------------------------- academic units
  app.post('/api/admin/institution-intelligence/institutions/:institutionId/units', requireCapability('institution.update'), async (req: Request, res: Response) => {
    const institutionId = String(req.params.institutionId);
    if (!UUID.test(institutionId)) return res.status(400).json({ error: 'Invalid institution id.' });
    try {
      const adminUser = (req as any).adminUser as { id: string };
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const siblingsResult = await supabase.from('institution_academic_units')
        .select('id,unit_type,slug,parent_unit_id').eq('institution_id', institutionId);
      if (siblingsResult.error) throw siblingsResult.error;
      const validated = validateUnitPatch(req.body, {}, siblingsResult.data ?? []);
      if (!validated.ok || !validated.value) return sendValidation(res, validated);
      if (!validated.value.unit_type || !validated.value.unit_name || !validated.value.slug) {
        return res.status(400).json({ error: 'A unit needs a type and a name.' });
      }
      const parent = validated.value.parent_unit_id as string | null | undefined;
      if (parent && !(siblingsResult.data ?? []).some((unit: any) => unit.id === parent)) {
        return res.status(400).json({ error: 'That parent unit does not belong to this institution.' });
      }
      const now = new Date().toISOString();
      const inserted = await supabase.from('institution_academic_units').insert({
        ...validated.value,
        institution_id: institutionId,
        reviewed_by: adminUser.id,
        last_checked_at: now,
        verified_at: validated.value.verification_status === 'verified' ? now : null,
      }).select('*').single();
      if (inserted.error) throw inserted.error;
      await recordAudit(supabase, { actorId: adminUser.id, action: 'create', resourceType: 'institution_academic_unit', resourceId: inserted.data.id, metadata: { institution_id: institutionId, unit_type: inserted.data.unit_type } });
      res.status(201).json({ unit: inserted.data });
    } catch (error) {
      console.error('Academic unit create error:', error);
      res.status(500).json({ error: 'Unable to add that academic unit.' });
    }
  });

  app.patch('/api/admin/institution-intelligence/units/:unitId', requireCapability('institution.update'), async (req: Request, res: Response) => {
    const unitId = String(req.params.unitId);
    if (!UUID.test(unitId)) return res.status(400).json({ error: 'Invalid unit id.' });
    try {
      const adminUser = (req as any).adminUser as { id: string };
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const current = await supabase.from('institution_academic_units')
        .select('id,institution_id,unit_type,unit_name,slug,parent_unit_id,verification_status').eq('id', unitId).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return res.status(404).json({ error: 'Academic unit not found.' });

      const siblingsResult = await supabase.from('institution_academic_units')
        .select('id,unit_type,slug,parent_unit_id').eq('institution_id', current.data.institution_id);
      if (siblingsResult.error) throw siblingsResult.error;
      const validated = validateUnitPatch(req.body, current.data, siblingsResult.data ?? []);
      if (!validated.ok || !validated.value) return sendValidation(res, validated);
      const parent = validated.value.parent_unit_id as string | null | undefined;
      if (parent && !(siblingsResult.data ?? []).some((unit: any) => unit.id === parent)) {
        return res.status(400).json({ error: 'That parent unit does not belong to this institution.' });
      }

      const now = new Date().toISOString();
      const updated = await supabase.from('institution_academic_units').update({
        ...validated.value,
        reviewed_by: adminUser.id,
        last_checked_at: now,
        ...(validated.value.verification_status ? { verified_at: validated.value.verification_status === 'verified' ? now : null } : {}),
      }).eq('id', unitId).select('*').single();
      if (updated.error) throw updated.error;
      invalidateInstitutionCache(current.data.institution_id);
      await recordAudit(supabase, { actorId: adminUser.id, action: 'update', resourceType: 'institution_academic_unit', resourceId: unitId, metadata: { fields: Object.keys(validated.value) } });
      res.json({ unit: updated.data });
    } catch (error) {
      console.error('Academic unit write error:', error);
      res.status(500).json({ error: 'Unable to save that academic unit.' });
    }
  });

  // ------------------------------------------------------------- programmes
  app.post('/api/admin/institution-intelligence/institutions/:institutionId/programmes', requireCapability('institution.update'), async (req: Request, res: Response) => {
    const institutionId = String(req.params.institutionId);
    if (!UUID.test(institutionId)) return res.status(400).json({ error: 'Invalid institution id.' });
    try {
      const adminUser = (req as any).adminUser as { id: string };
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const validated = validateProgrammePatch(req.body, { institution_id: institutionId });
      if (!validated.ok || !validated.value) return sendValidation(res, validated);
      if (!validated.value.values.programme_name) return res.status(400).json({ error: 'A programme needs a name.' });
      const now = new Date().toISOString();
      const inserted = await supabase.from('institution_programme_offerings').insert({
        ...validated.value.values,
        institution_id: institutionId,
        reviewed_by: adminUser.id,
        last_checked_at: now,
        verified_at: validated.value.verification === 'verified' ? now : null,
      }).select('*').single();
      if (inserted.error) throw inserted.error;
      invalidateInstitutionCache(institutionId);
      await recordAudit(supabase, { actorId: adminUser.id, action: 'create', resourceType: 'institution_programme_offering', resourceId: inserted.data.id, metadata: { institution_id: institutionId } });
      res.status(201).json({ offering: inserted.data });
    } catch (error) {
      console.error('Programme create error:', error);
      res.status(500).json({ error: 'Unable to add that programme.' });
    }
  });

  app.patch('/api/admin/institution-intelligence/programmes/:offeringId', requireCapability('institution.update'), async (req: Request, res: Response) => {
    const offeringId = String(req.params.offeringId);
    if (!UUID.test(offeringId)) return res.status(400).json({ error: 'Invalid programme id.' });
    try {
      const adminUser = (req as any).adminUser as { id: string };
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const current = await supabase.from('institution_programme_offerings')
        .select('id,institution_id,academic_unit_id,verification_status,publication_status').eq('id', offeringId).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return res.status(404).json({ error: 'Programme not found.' });

      const validated = validateProgrammePatch(req.body, current.data);
      if (!validated.ok || !validated.value) return sendValidation(res, validated);

      const unitId = validated.value.values.academic_unit_id as string | null | undefined;
      if (unitId) {
        const unit = await supabase.from('institution_academic_units')
          .select('id').eq('id', unitId).eq('institution_id', current.data.institution_id).maybeSingle();
        if (unit.error) throw unit.error;
        if (!unit.data) return res.status(400).json({ error: 'That academic unit does not belong to this institution.' });
      }

      const now = new Date().toISOString();
      const updated = await supabase.from('institution_programme_offerings').update({
        ...validated.value.values,
        reviewed_by: adminUser.id,
        last_checked_at: now,
        ...(validated.value.values.verification_status ? { verified_at: validated.value.verification === 'verified' ? now : null } : {}),
      }).eq('id', offeringId).select('*').single();
      if (updated.error) throw updated.error;
      invalidateInstitutionCache(current.data.institution_id);
      await recordAudit(supabase, {
        actorId: adminUser.id,
        action: 'update',
        resourceType: 'institution_programme_offering',
        resourceId: offeringId,
        metadata: { fields: Object.keys(validated.value.values), verification: validated.value.verification, publication: validated.value.publication },
      });
      res.json({ offering: updated.data });
    } catch (error) {
      console.error('Programme write error:', error);
      const gate = /cannot be published|publication gate/i.test(String((error as Error)?.message ?? ''));
      if (gate) return adminGateFailure(res, 'This programme cannot be published while it is unverified.');
      res.status(500).json({ error: 'Unable to save that programme.' });
    }
  });

  // -------------------------------------------------------------- admission
  app.patch('/api/admin/institution-intelligence/routes/:routeId', requireCapability('institution.update'), async (req: Request, res: Response) => {
    const routeId = String(req.params.routeId);
    if (!UUID.test(routeId)) return res.status(400).json({ error: 'Invalid route id.' });
    try {
      const adminUser = (req as any).adminUser as { id: string };
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const current = await supabase.from('institution_admission_routes')
        .select('id,institution_id,opens_on,closes_on,verification_status,publication_status').eq('id', routeId).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return res.status(404).json({ error: 'Admission route not found.' });
      const validated = validateRoutePatch(req.body, current.data);
      if (!validated.ok || !validated.value) return sendValidation(res, validated);
      const now = new Date().toISOString();
      const updated = await supabase.from('institution_admission_routes').update({
        ...validated.value.values,
        reviewed_by: adminUser.id,
        last_checked_at: now,
        ...(validated.value.values.verification_status ? { verified_at: validated.value.verification === 'verified' ? now : null } : {}),
      }).eq('id', routeId).select('*').single();
      if (updated.error) throw updated.error;
      invalidateInstitutionCache(current.data.institution_id);
      await recordAudit(supabase, { actorId: adminUser.id, action: 'update', resourceType: 'institution_admission_route', resourceId: routeId, metadata: { fields: Object.keys(validated.value.values) } });
      res.json({ route: updated.data });
    } catch (error) {
      console.error('Admission route write error:', error);
      const gate = /cannot be published|publication gate/i.test(String((error as Error)?.message ?? ''));
      if (gate) return adminGateFailure(res, 'This admission route cannot be published while it is unverified.');
      res.status(500).json({ error: 'Unable to save that admission route.' });
    }
  });

  app.patch('/api/admin/institution-intelligence/requirements/:requirementId', requireCapability('institution.update'), async (req: Request, res: Response) => {
    const requirementId = String(req.params.requirementId);
    if (!UUID.test(requirementId)) return res.status(400).json({ error: 'Invalid requirement id.' });
    try {
      const adminUser = (req as any).adminUser as { id: string };
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const current = await supabase.from('institution_programme_requirements')
        .select('id,programme_offering_id,admission_session,entry_mode,utme_subjects,o_level_requirements,a_level_requirements,minimum_utme_score,minimum_utme_scale,verification_status,publication_status')
        .eq('id', requirementId).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return res.status(404).json({ error: 'Requirement not found.' });
      const validated = validateRequirementPatch(req.body, current.data);
      if (!validated.ok || !validated.value) return sendValidation(res, validated);
      const offering = await supabase.from('institution_programme_offerings')
        .select('institution_id').eq('id', current.data.programme_offering_id).maybeSingle();
      if (offering.error) throw offering.error;
      const now = new Date().toISOString();
      const updated = await supabase.from('institution_programme_requirements').update({
        ...validated.value.values,
        reviewed_by: adminUser.id,
        last_checked_at: now,
        ...(validated.value.values.verification_status ? { verified_at: validated.value.verification === 'verified' ? now : null } : {}),
      }).eq('id', requirementId).select('*').single();
      if (updated.error) throw updated.error;
      if (offering.data?.institution_id) invalidateInstitutionCache(offering.data.institution_id);
      await recordAudit(supabase, { actorId: adminUser.id, action: 'update', resourceType: 'institution_programme_requirement', resourceId: requirementId, metadata: { fields: Object.keys(validated.value.values) } });
      res.json({ requirement: updated.data });
    } catch (error) {
      console.error('Requirement write error:', error);
      const gate = /cannot be published|publication gate/i.test(String((error as Error)?.message ?? ''));
      if (gate) return adminGateFailure(res, 'These requirements cannot be published while they are unverified.');
      res.status(500).json({ error: 'Unable to save those requirements.' });
    }
  });

  // ------------------------------------------------------------ evidence/source
  app.patch('/api/admin/institution-intelligence/evidence/:evidenceId', requireCapability('institution.update'), async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser as { id: string };
      const supabase = getSupabase();
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const current = await supabase.from('institution_fact_evidence')
        .select('id,institution_id,entity_type,field_key,source_url,verification_status').eq('id', req.params.evidenceId).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return res.status(404).json({ error: 'Evidence row not found.' });

      const validated = validateEvidencePatch(req.body, current.data);
      if (!validated.ok || !validated.value) return res.status(400).json({ error: validated.error });

      const { status, note, source_url } = validated.value;
      const patch: Record<string, unknown> = {};
      if (status) {
        patch.verification_status = status;
        patch.checked_at = new Date().toISOString();
        patch.checked_by = adminUser.id;
      }
      if (note !== undefined) patch.review_note = note;
      if (source_url !== undefined) patch.source_url = source_url;

      const updated = await supabase.from('institution_fact_evidence').update(patch)
        .eq('id', req.params.evidenceId)
        .select('id,institution_id,entity_type,field_key,source_url,verification_status,checked_at,review_note')
        .maybeSingle();
      if (updated.error) throw updated.error;
      invalidateInstitutionCache(current.data.institution_id);
      await recordAudit(supabase, {
        actorId: adminUser.id,
        action: 'review',
        resourceType: 'institution_fact_evidence',
        resourceId: updated.data?.id ?? String(req.params.evidenceId),
        metadata: { status: status ?? null, field_key: current.data.field_key, source_replaced: source_url !== undefined },
      });
      res.json({ item: updated.data });
    } catch (error) {
      console.error('Institution evidence review error:', error);
      res.status(500).json({ error: 'Unable to record that review.' });
    }
  });

  // --------------------------------------------------------------- diagnostics
  app.get('/api/admin/institution-intelligence/cache', requireCapability('institution.read'), (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
    res.json({
      cache: intelligenceCache.stats(),
      policy: PUBLIC_CACHE_CONTROL,
      note: 'Counts are process-local. The CDN keeps its own hit rate; this shows the server-side cache that protects the database.',
    });
  });

  // ------------------------------------------------------------ student goal
  app.get('/api/student/admission-goal', async (req: Request, res: Response) => {
    try {
      const { supabase, user } = await requireUser(req, 'dashboard.access');
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const goal = await supabase.from('student_admission_goals')
        .select('id,institution_id,programme_offering_id,target_exam,entry_mode,admission_session,student_target_utme_score,student_target_aggregate,target_score_note,status,updated_at')
        .eq('student_id', user.id).maybeSingle();
      if (goal.error) throw goal.error;
      if (!goal.data) return res.json({ goal: null, requirement: null, attempts: [], progress: computeGoalProgress([], null) });

      const [offering, requirement, links] = await Promise.all([
        supabase.from('institution_programme_offerings')
          .select('id,institution_id,programme_name,degree_title,admission_session,publication_status,verification_status')
          .eq('id', goal.data.programme_offering_id).maybeSingle(),
        supabase.from('institution_programme_requirements')
          .select('id,utme_subjects,o_level_requirements,a_level_requirements,minimum_utme_score,minimum_utme_scale,first_choice_required,notes,publication_status,verification_status')
          .eq('programme_offering_id', goal.data.programme_offering_id)
          .eq('admission_session', goal.data.admission_session)
          .eq('entry_mode', goal.data.entry_mode)
          .eq('verification_status', 'verified').maybeSingle(),
        supabase.from('student_admission_goal_attempts')
          .select('attempt_id,match_status,practice_score,practice_score_scale,linked_at')
          .eq('goal_id', goal.data.id).order('linked_at', { ascending: false }),
      ]);
      for (const result of [offering, requirement, links]) if (result.error) throw result.error;

      const progress = computeGoalProgress(
        (links.data ?? []).map((row: any) => ({ matchStatus: row.match_status as MatchStatus, scorePercent: Number(row.practice_score) })),
        goal.data.student_target_aggregate === null ? null : Number(goal.data.student_target_aggregate),
      );

      res.json({
        goal: goal.data,
        institution: offering.data ? { id: offering.data.institution_id } : null,
        offering: offering.data ?? null,
        requirement: requirement.data ?? null,
        attempts: links.data ?? [],
        progress,
      });
    } catch (error: any) {
      const message = String(error?.message ?? 'Unable to load your admission goal.');
      const status = /Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503;
      res.status(status).json({ error: message });
    }
  });

  app.put('/api/student/admission-goal', async (req: Request, res: Response) => {
    try {
      const { supabase, user } = await requireUser(req, 'dashboard.access');
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const institutionId = String(req.body?.institutionId ?? '');
      const offeringId = String(req.body?.programmeOfferingId ?? '');
      const entryMode = String(req.body?.entryMode ?? 'UTME');
      const admissionSession = String(req.body?.admissionSession ?? '');
      const targetExam = String(req.body?.targetExam ?? 'JAMB_UTME');
      const targetAggregate = req.body?.targetPercent === undefined || req.body?.targetPercent === null
        ? null
        : Number(req.body.targetPercent);

      if (!isUuid(institutionId) || !isUuid(offeringId)) {
        return res.status(400).json({ error: 'Choose an institution and a programme.' });
      }
      if (!isAdmissionSession(admissionSession)) return res.status(400).json({ error: 'Session must look like 2026/2027.' });
      if (!['JAMB_UTME', 'WAEC', 'NECO', 'POST_UTME', 'OTHER'].includes(targetExam)) {
        return res.status(400).json({ error: 'Unsupported target exam.' });
      }
      if (targetAggregate !== null && (!Number.isFinite(targetAggregate) || targetAggregate < 0 || targetAggregate > 100)) {
        return res.status(400).json({ error: 'A practice target is a percentage between 0 and 100.' });
      }

      // The offering must be published and verified, and belong to the chosen
      // institution. A student cannot point a goal at unreviewed research.
      const offering = await supabase.from('institution_programme_offerings')
        .select('id,institution_id,admission_session,publication_status,verification_status')
        .eq('id', offeringId).eq('institution_id', institutionId).maybeSingle();
      if (offering.error) throw offering.error;
      if (!offering.data
        || offering.data.publication_status !== 'published'
        || offering.data.verification_status !== 'verified') {
        return res.status(409).json({ error: 'That programme is not published for this institution yet.' });
      }

      const { data, error } = await supabase.from('student_admission_goals').upsert({
        student_id: user.id,
        institution_id: institutionId,
        programme_offering_id: offeringId,
        target_exam: targetExam,
        entry_mode: entryMode,
        admission_session: admissionSession,
        student_target_aggregate: targetAggregate,
        target_score_note: typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null,
        status: 'active',
      }, { onConflict: 'student_id' }).select('id,institution_id,programme_offering_id,target_exam,entry_mode,admission_session,student_target_aggregate,status').single();
      if (error) throw error;
      res.json({ goal: data });
    } catch (error: any) {
      const message = String(error?.message ?? 'Unable to save your admission goal.');
      const status = /Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/student/admission-goal/attempts/:attemptId', async (req: Request, res: Response) => {
    try {
      const { supabase, user } = await requireUser(req, 'dashboard.access');
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      const attemptId = String(req.params.attemptId);
      if (!UUID.test(attemptId)) return res.status(400).json({ error: 'Invalid attempt id.' });

      const goal = await supabase.from('student_admission_goals')
        .select('id,programme_offering_id,entry_mode,admission_session,student_target_aggregate')
        .eq('student_id', user.id).maybeSingle();
      if (goal.error) throw goal.error;
      if (!goal.data) return res.status(409).json({ error: 'Set an admission goal before linking a practice attempt.' });

      // Ownership is enforced by the query, not by trusting the body.
      const attempt = await supabase.from('cbt_attempts')
        .select('id,user_id,status,score,total_questions,correct_answers,submitted_at')
        .eq('id', attemptId).eq('user_id', user.id).maybeSingle();
      if (attempt.error) throw attempt.error;
      if (!attempt.data) return res.status(404).json({ error: 'Attempt not found.' });
      if (attempt.data.status !== 'submitted') return res.status(409).json({ error: 'Only a submitted attempt can be linked.' });

      const exam = await supabase.from('cbt_exams')
        .select('id,title,exam_body,subject')
        .eq('id', (await supabase.from('cbt_attempts').select('exam_id').eq('id', attemptId).maybeSingle()).data?.exam_id)
        .maybeSingle();
      if (exam.error) throw exam.error;

      const requirement = await supabase.from('institution_programme_requirements')
        .select('utme_subjects,minimum_utme_scale')
        .eq('programme_offering_id', goal.data.programme_offering_id)
        .eq('admission_session', goal.data.admission_session)
        .eq('entry_mode', goal.data.entry_mode)
        .eq('verification_status', 'verified').maybeSingle();
      if (requirement.error) throw requirement.error;

      const percent = attempt.data.total_questions
        ? Math.round((Number(attempt.data.correct_answers) / Number(attempt.data.total_questions)) * 1000) / 10
        : null;

      const match = matchAttemptToRequirement(
        {
          attemptId,
          examSubject: exam.data?.subject ?? null,
          examBody: exam.data?.exam_body ?? null,
          examTitle: exam.data?.title ?? null,
          scorePercent: percent,
        },
        requirement.data ? { utmeSubjects: requirement.data.utme_subjects ?? [] } : null,
      );

      const link = await supabase.from('student_admission_goal_attempts').upsert({
        goal_id: goal.data.id,
        student_id: user.id,
        attempt_id: attemptId,
        match_status: match.status,
        practice_score: percent,
        practice_score_scale: 100,
      }, { onConflict: 'goal_id,attempt_id' }).select('attempt_id,match_status,practice_score,practice_score_scale').single();
      if (link.error) throw link.error;

      const links = await supabase.from('student_admission_goal_attempts')
        .select('attempt_id,match_status,practice_score').eq('goal_id', goal.data.id);
      if (links.error) throw links.error;

      res.json({
        link: link.data,
        match: { status: match.status, reason: match.reason, matchedSubjects: match.matchedSubjects, missingSubjects: match.missingSubjects },
        progress: computeGoalProgress(
          (links.data ?? []).map((row: any) => ({ matchStatus: row.match_status as MatchStatus, scorePercent: Number(row.practice_score) })),
          goal.data.student_target_aggregate === null ? null : Number(goal.data.student_target_aggregate),
        ),
      });
    } catch (error: any) {
      const message = String(error?.message ?? 'Unable to link that attempt.');
      const status = /Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 500;
      res.status(status).json({ error: message });
    }
  });
}
