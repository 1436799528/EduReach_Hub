/**
 * Institution intelligence API.
 *
 * Three audiences, three different rules:
 *
 *   * a visitor reads only rows that are both verified and published — this
 *     server uses the service role, so RLS does not filter for it and every
 *     read below names its own status filters;
 *   * staff see the review queue and can approve, dispute, mark outdated or
 *     replace a fact, which is audited with the actor;
 *   * a student owns exactly one admission goal, always keyed by the session
 *     identity — never by an id in the request body.
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

export interface InstitutionIntelligenceDeps {
  // Injected exactly as server.ts defines them; their capability unions are
  // wider than this module needs, so they are typed structurally here.
  requireUser: (req: Request, capability?: any) => Promise<{ supabase: any; rpcSupabase: any; user: { id: string } }>;
  requireCapability: (...capabilities: any[]) => any;
  getSupabase: () => any;
  recordAudit: (supabase: any, entry: any) => Promise<any>;
}

const SESSION = /^(20\d{2})\/(20\d{2})$/;
const STATUSES = ['verified', 'disputed', 'outdated', 'unpublished_by_institution'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSession(value: unknown): boolean {
  const match = SESSION.exec(String(value ?? ''));
  return Boolean(match) && Number(match![2]) === Number(match![1]) + 1;
}

export function registerInstitutionIntelligenceRoutes(app: Express, deps: InstitutionIntelligenceDeps) {
  const { requireUser, requireCapability, getSupabase, recordAudit } = deps;

  // --------------------------------------------------------------- public read
  app.get('/api/institutions/:institutionId/intelligence', async (req: Request, res: Response) => {
    const institutionId = String(req.params.institutionId);
    if (!UUID.test(institutionId)) return res.status(400).json({ error: 'Invalid institution id.' });
    try {
      const supabase = getSupabase();
      const institution = await supabase
        .from('institutions')
        .select('id,school_name,acronym,state,institution_type,website_url,admission_portal_url,student_portal_url')
        .eq('id', institutionId)
        .maybeSingle();
      if (institution.error) throw institution.error;
      if (!institution.data) return res.status(404).json({ error: 'Institution not found.' });

      const [profile, leadership, campuses, units, offerings, routes, guides, policies] = await Promise.all([
        supabase.from('institution_profiles')
          .select('institution_id,official_name,ownership,institution_category,year_established,history_summary,overview,mission,vision,mandate,postal_address,city,logo_url,hero_image_url,official_website_url,admission_portal_url,student_portal_url,postgraduate_portal_url,profile_status,verification_status')
          .eq('institution_id', institutionId).eq('profile_status', 'published').eq('verification_status', 'verified').maybeSingle(),
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

      res.json({
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
        caveats: [
          'Only facts reviewed and published by EduReach are shown. An empty section means "not published yet", never "does not exist".',
          'National minimums are policy floors, not departmental cut-offs. Each threshold is shown with the scale its institution published.',
          'EduReach never asks for your portal password, PIN, card details or OTP, and never collects payment for an institution.',
        ],
      });
    } catch (error) {
      console.error('Institution intelligence read error:', error);
      res.status(503).json({ error: 'Institution intelligence is temporarily unavailable.' });
    }
  });

  // ------------------------------------------------------------- admin review
  app.get('/api/admin/institution-intelligence/review', requireCapability('institution.read'), async (_req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      const [evidence, offerings, benchmarks, guides, profiles] = await Promise.all([
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
      ]);
      for (const result of [evidence, offerings, benchmarks, guides, profiles]) {
        if (result.error) throw result.error;
      }
      res.json({
        awaitingReview: evidence.data ?? [],
        offeringsInReview: offerings.data ?? [],
        benchmarksInReview: benchmarks.data ?? [],
        guidesInReview: guides.data ?? [],
        completeness: profiles.data ?? [],
      });
    } catch (error) {
      console.error('Institution review queue error:', error);
      res.status(503).json({ error: 'Unable to load the institution review queue.' });
    }
  });

  app.patch('/api/admin/institution-intelligence/evidence/:evidenceId', requireCapability('institution.update'), async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser as { id: string };
      const status = String(req.body?.status ?? '');
      if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
        return res.status(400).json({ error: 'Choose verified, disputed, outdated or unpublished_by_institution.' });
      }
      const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 2000) : null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('institution_fact_evidence')
        .update({ verification_status: status, checked_at: new Date().toISOString(), checked_by: adminUser.id, review_note: note })
        .eq('id', req.params.evidenceId)
        .select('id,institution_id,entity_type,field_key,verification_status,checked_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Evidence row not found.' });
      await recordAudit(supabase, {
        actorId: adminUser.id,
        action: 'review',
        resourceType: 'institution_fact_evidence',
        resourceId: data.id,
        metadata: { status, field_key: data.field_key },
      });
      res.json({ item: data });
    } catch (error) {
      console.error('Institution evidence review error:', error);
      res.status(500).json({ error: 'Unable to record that review.' });
    }
  });

  // ------------------------------------------------------------ student goal
  app.get('/api/student/admission-goal', async (req: Request, res: Response) => {
    try {
      const { supabase, user } = await requireUser(req, 'dashboard.access');
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
        institution: offering.data
          ? { id: offering.data.institution_id }
          : null,
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
      const institutionId = String(req.body?.institutionId ?? '');
      const offeringId = String(req.body?.programmeOfferingId ?? '');
      const entryMode = String(req.body?.entryMode ?? 'UTME');
      const admissionSession = String(req.body?.admissionSession ?? '');
      const targetExam = String(req.body?.targetExam ?? 'JAMB_UTME');
      const targetAggregate = req.body?.targetPercent === undefined || req.body?.targetPercent === null
        ? null
        : Number(req.body.targetPercent);

      if (!UUID.test(institutionId) || !UUID.test(offeringId)) {
        return res.status(400).json({ error: 'Choose an institution and a programme.' });
      }
      if (!isSession(admissionSession)) return res.status(400).json({ error: 'Session must look like 2026/2027.' });
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
