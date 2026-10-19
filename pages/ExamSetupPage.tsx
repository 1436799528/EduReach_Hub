import { ArrowRight, BookOpen, Calculator, Clock3, Info, Lock, Plus, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { ErrorState, InlineNotice } from '../src/components/AsyncState';
import {
  jambSubjectCatalog,
  secondarySubjectCatalog,
  type ExamSetupKey,
} from '../src/data/examPreparation';
import { fetchCbtBank, fetchCbtExams, fetchCbtExamsWithAvailability, fetchPastQuestionResources, fetchPostUtmeInstitutions, startConfiguredCbt, trackEvent, type CbtBankPayload, type PastQuestionResource, type PostUtmeInstitution } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { userFacingError } from '../lib/errors';
import { navigateInApp } from '../src/lib/navigation';
import {
  DEFAULT_CBT_LIMITS,
  compulsorySubjectKeys,
  describeSession,
  durationForQuestionCount,
  isEnglishSubject,
  mockCombinationError,
  mockDurationMinutes,
  mockPaperError,
  mockPaperFor,
  normalizeSubject,
  paperStandardFor,
  previewPlan,
  questionCountOptions,
  resolveSetupExam,
  subjectLimitFor,
  validateSession,
  type CatalogExam,
  type CbtMode,
} from '../src/lib/cbt-config';

type SetupCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  duration: string;
  logo: string;
};

// `duration` is only the unconfigured-local-preview label. When a backend is
// configured the setup page shows the exam's real configured default duration
// from the CBT catalogue - never a hard-coded time.
const setupCopy: Record<ExamSetupKey, SetupCopy> = {
  jamb: {
    eyebrow: 'Practice or mock',
    title: 'Set up your JAMB practice or mock',
    intro: 'Choose four subjects, including Use of English, and how many questions you want. Time follows the exam pace.',
    duration: 'Practice session',
    logo: '/icons/brands/jamb.png',
  },
  waec: {
    eyebrow: 'Practice or mock',
    title: 'Set up your WAEC practice or mock',
    intro: 'Choose a subject bank for objective practice. Paper structure varies by subject.',
    duration: 'Practice session',
    logo: '/icons/brands/waec.png',
  },
  neco: {
    eyebrow: 'Practice or mock',
    title: 'Set up your NECO practice or mock',
    intro: 'Choose a subject bank for practice. Paper structure varies by subject.',
    duration: 'Practice session',
    logo: '/icons/brands/neco.png',
  },
  'post-utme': {
    eyebrow: 'Practice or mock',
    title: 'Set up your Post-UTME practice or mock',
    intro: 'Practise your school’s screening subjects, or run a timed mock from its published subject list.',
    duration: 'Practice session',
    logo: '/icons/brands/jamb.png',
  },
};

const guideItems = [
  { title: 'You choose the paper', body: 'Pick the subjects and the number of questions. Time follows the exam pace.' },
  { title: 'The timer is real', body: 'The countdown keeps running when you refresh or leave the page.' },
  { title: 'Your work is saved', body: 'Answers are saved as you go, so a lost connection does not lose the session.' },
];

export default function ExamSetupPage({ exam }: { exam: ExamSetupKey }) {
  const copy = setupCopy[exam];
  const { user } = useAuth();

  const [catalog, setCatalog] = useState<CatalogExam[]>([]);
  const [postUtmeInstitutions, setPostUtmeInstitutions] = useState<PostUtmeInstitution[]>([]);
  const [postUtmeInstitutionId, setPostUtmeInstitutionId] = useState(() => new URLSearchParams(window.location.search).get('school') || '');
  const [postUtmePapers, setPostUtmePapers] = useState<PastQuestionResource[]>([]);
  const [postUtmePapersLoading, setPostUtmePapersLoading] = useState(false);
  const [targetExam, setTargetExam] = useState<CatalogExam | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<unknown>(null);
  const [bank, setBank] = useState<CbtBankPayload | null>(null);
  const [bankError, setBankError] = useState<unknown>(null);
  const [mode, setMode] = useState<CbtMode>(() => (new URLSearchParams(window.location.search).get('mode') === 'mock' ? 'mock' : 'practice'));

  // Practice configuration - the student's own session.
  const [practiceSubjects, setPracticeSubjects] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [practiceTrack, setPracticeTrack] = useState<'General' | 'Science' | 'Commercial' | 'Arts & Humanities'>('General');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const limits = bank?.limits || DEFAULT_CBT_LIMITS;
  const availability = bank?.subjects || [];
  // The bank's own exam body is authoritative; the route segment is the
  // fallback while the catalogue is still loading.
  const examBody = bank?.exam.examBody ?? exam;

  const loadBank = useCallback(async (examId: string) => {
    setBankError(null);
    setBank(null);
    try {
      const payload = await fetchCbtBank(examId);
      setBank(payload);
      return payload;
    } catch (error) {
      setBankError(error);
      return null;
    }
  }, []);

  const resolveCatalogAndBank = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get('exam');
      // Availability-aware catalogue (GET /api/cbt/exams): resolution needs
      // per-bank question/subject counts to deterministically pick a
      // startable bank instead of trusting row order. Local preview keeps
      // the direct-query fallback catalogue.
      const exams = (isSupabaseConfigured
        ? await fetchCbtExamsWithAvailability()
        : await fetchCbtExams());
      setCatalog(exams);
      let eligibleExams = exams;
      if (exam === 'post-utme') {
        const schools = await fetchPostUtmeInstitutions();
        setPostUtmeInstitutions(schools);
        const selectedId = postUtmeInstitutionId && schools.some((school) => school.id === postUtmeInstitutionId)
          ? postUtmeInstitutionId
          : (params.get('school') && schools.some((school) => school.id === params.get('school')) ? params.get('school')! : schools[0]?.id || '');
        if (selectedId !== postUtmeInstitutionId) setPostUtmeInstitutionId(selectedId);
        const selectedSchool = schools.find((school) => school.id === selectedId);
        if (!selectedSchool) {
          setTargetExam(null); setBank(null); setPostUtmePapers([]);
          return;
        }
        if (selectedSchool.post_utme_method === 'handwritten') {
          setTargetExam(null); setBank(null); setPostUtmePapersLoading(true);
          try {
            const library = await fetchPastQuestionResources({ exam: 'POST-UTME', institution: selectedSchool.id });
            setPostUtmePapers(library.items);
          } finally { setPostUtmePapersLoading(false); }
          return;
        }
        setPostUtmePapers([]);
        eligibleExams = exams.filter((item) => String(item.exam_body).toUpperCase() === 'POST-UTME' && item.institution_id === selectedSchool.id);
      }
      const resolved = resolveSetupExam(eligibleExams, exam, requestedId);
      setTargetExam(resolved);
      if (resolved) await loadBank(resolved.id);
    } catch (error) {
      setCatalogError(error);
    } finally {
      setCatalogLoading(false);
    }
  }, [exam, loadBank, postUtmeInstitutionId]);

  useEffect(() => { void resolveCatalogAndBank(); }, [resolveCatalogAndBank]);

  useEffect(() => {
    // AN-1: which exam bodies reach the setup wizard - the step before any
    // attempt starts, which is where a funnel loses people.
    trackEvent('cbt_setup_view', { metadata: { mode: exam } });
  }, [exam]);

  // The subject list is the bank's real content, so a student can never
  // configure a paper the bank cannot serve. When the bank loads, preselect a
  // sensible default rather than an empty form, and honour a `subjects` wish
  // passed by a deep link (for example from past questions) when the bank has
  // those subjects.
  //
  // A selection belongs to the bank it was made in. Switching bank (the
  // Post-UTME school selector does this) must not carry subjects across: the new
  // bank may not hold them, and the wizard would then argue with itself.
  const selectionBank = useRef<string | null>(null);
  useEffect(() => {
    if (!availability.length) return;
    const bankId = bank?.exam.id || '';
    const changedBank = selectionBank.current !== bankId;
    selectionBank.current = bankId;
    setPracticeSubjects((current) => {
      if (current.length && !changedBank) return current;
      const requested = (new URLSearchParams(window.location.search).get('subjects') || '')
        .split(/[|,;]/)
        .map((value) => value.trim())
        .filter(Boolean);
      const matched = requested.filter((subject) => availability.some(
        (entry) => normalizeSubject(entry.subject) === normalizeSubject(subject),
      )).map((subject) => availability.find((entry) => normalizeSubject(entry.subject) === normalizeSubject(subject))?.subject || subject);
      // The bank's own rule wins over the route segment: a deep link that
      // resolves a JAMB bank on another setup path must still pin its
      // compulsory subject.
      const compulsory = bank?.rules?.compulsorySubjects?.length
        ? bank.rules.compulsorySubjects.map(normalizeSubject)
        : compulsorySubjectKeys(examBody);
      const defaultSubjects = matched.length ? matched : (compulsory.length ? [] : availability.slice(0, Math.min(2, availability.length)).map((entry) => entry.subject));
      // Only bodies with a compulsory subject (JAMB: Use of English) have it
      // pinned into the default selection; other bodies start from the
      // student's own choice, never from JAMB's rules.
      const compulsoryEntries = availability.filter((entry) => compulsory.includes(normalizeSubject(entry.subject)));
      const withCompulsory = [
        ...compulsoryEntries.map((entry) => entry.subject),
        ...defaultSubjects.filter((subject) => !compulsoryEntries.some((entry) => normalizeSubject(entry.subject) === normalizeSubject(subject))),
      ];
      return withCompulsory.slice(0, subjectLimitFor(examBody, limits));
    });
    setQuestionCount((current) => (changedBank ? null : current) ?? Math.min(20, bank?.totalQuestions || 20));
  }, [availability, bank, exam, limits]);

  // ---- Derived practice configuration ---------------------------------
  const selectedAvailability = useMemo(
    () => availability.filter((entry) => practiceSubjects.some((subject) => normalizeSubject(subject) === normalizeSubject(entry.subject))),
    [availability, practiceSubjects],
  );
  const selectedBankTotal = selectedAvailability.reduce((sum, entry) => sum + entry.questionCount, 0);
  const countChoices = useMemo(() => questionCountOptions(selectedBankTotal || bank?.totalQuestions || 0, limits), [selectedBankTotal, bank, limits]);
  const effectiveCount = questionCount && countChoices.includes(questionCount) ? questionCount : countChoices[countChoices.length - 1] ?? limits.minQuestions;
  // The question count determines the time allocation; no separate timer choice
  // is shown. The pace comes from the bank's own paper standard (JAMB 180
  // questions in 120 minutes), which is the same row the server reads, so the
  // number on screen is the number the attempt will enforce.
  const practiceStandard = useMemo(() => {
    if (bank) {
      const questions = Number(bank.mock?.questionCount) || 0;
      return questions > 0
        ? { questions, minutes: mockDurationMinutes(bank.exam.defaultDurationMinutes) }
        : null;
    }
    return paperStandardFor(examBody);
  }, [bank, examBody]);
  const effectiveDuration = Math.max(limits.minMinutes, Math.min(
    limits.maxMinutes,
    durationForQuestionCount(effectiveCount, {
      standard: practiceStandard,
      defaultMinutes: bank?.exam.defaultDurationMinutes,
      limits,
    }),
  ));
  // Server rules win; the exam-key rule is the offline/older-API fallback.
  // For WAEC/NECO/Post-UTME this is null - English is selectable, never forced.
  const compulsoryEnglish = bank?.rules?.compulsorySubjects?.[0]
    ?? (compulsorySubjectKeys(exam).length ? availability.find((entry) => isEnglishSubject(entry.subject))?.subject || null : null);
  const compulsoryKeys = useMemo(
    () => (bank?.rules?.compulsorySubjects?.length
      ? bank.rules.compulsorySubjects.map(normalizeSubject)
      : compulsorySubjectKeys(exam)),
    [bank, exam],
  );
  const isCompulsorySubject = useCallback(
    (subject: string) => compulsoryKeys.includes(normalizeSubject(subject)),
    [compulsoryKeys],
  );
  // A missing compulsory subject blocks the start only when this examination
  // actually has one. Gating on `!compulsoryEnglish` alone disabled the Start
  // button for WAEC, NECO and Post-UTME, where no subject is compulsory.
  const compulsoryMissing = Boolean(bank?.rules?.compulsoryMissing)
    || (compulsoryKeys.length > 0 && !compulsoryEnglish);
  const trackSubjectNames = useMemo(() => {
    if (practiceTrack === 'General') return null;
    const secondary = secondarySubjectCatalog[practiceTrack];
    const jamb = practiceTrack === 'Science'
      ? [...jambSubjectCatalog.Science, ...jambSubjectCatalog.Engineering, ...jambSubjectCatalog['Medicine & Health'], ...jambSubjectCatalog.Education]
      : practiceTrack === 'Commercial'
        ? [...jambSubjectCatalog.Commercial, ...jambSubjectCatalog['Social Science']]
        : [...jambSubjectCatalog['Arts & Humanities'], ...jambSubjectCatalog['Social Science']];
    return new Set([...secondary, ...jamb].map(normalizeSubject));
  }, [practiceTrack]);
  // A subject the static catalogues do not know (Post-UTME "General
  // Knowledge", for example) must not disappear because of a group filter:
  // the filter is a convenience, not a way to hide a bank the student can use.
  const knownSubjectKeys = useMemo(() => new Set([
    ...Object.values(secondarySubjectCatalog).flat(),
    ...Object.values(jambSubjectCatalog).flat(),
  ].map(normalizeSubject)), []);
  // The group filter narrows the available list only; it never changes an
  // existing selection. Compulsory subjects stay visible in every group so a
  // required subject can always be re-added.
  const visiblePracticeAvailability = availability.filter((entry) => {
    const key = normalizeSubject(entry.subject);
    return !trackSubjectNames
      || trackSubjectNames.has(key)
      || isCompulsorySubject(entry.subject)
      || !knownSubjectKeys.has(key);
  });
  const addableSubjects = visiblePracticeAvailability.filter(
    (entry) => !practiceSubjects.some((subject) => normalizeSubject(subject) === normalizeSubject(entry.subject)),
  );
  const practicePlan = useMemo(() => previewPlan(selectedAvailability, effectiveCount), [selectedAvailability, effectiveCount]);

  // ---- Derived mock combination ---------------------------------------
  // Both modes use the same available subject picker. A mock simply lets the system
  // determine the question count and standard duration from the selected subjects.
  const governedCombination = useMemo(() => mode === 'mock' ? practiceSubjects : [], [mode, practiceSubjects]);

  const coverage = useMemo(() => governedCombination.map((subject) => {
    const entry = availability.find((item) => normalizeSubject(item.subject) === normalizeSubject(subject));
    return { subject, questionCount: entry?.questionCount ?? 0 };
  }), [governedCombination, availability]);
  const uncovered = coverage.filter((entry) => entry.questionCount === 0);
  const mockBankTotal = coverage.reduce((sum, entry) => sum + entry.questionCount, 0);
  // The paper a mock must reproduce comes from the bank (JAMB: 180 questions,
  // 60 English + 40 from each other subject). A bank with no fixed paper uses
  // its own questions up to the session cap.
  const mockPaper = useMemo(
    () => mockPaperFor(examBody, bank ? bank.mock ?? { questionCount: null, subjectQuota: null } : undefined),
    [examBody, bank],
  );
  const mockCount = mockPaper ? mockPaper.questions : Math.min(mockBankTotal, limits.maxQuestions);
  // Two separate reasons a mock cannot start: the governed combination, and a
  // bank too shallow to fill the paper. The database refuses both; the wizard
  // says which one applies before the button is pressed.
  const mockRuleError = mockCombinationError(governedCombination, examBody);
  const mockCoverageError = mockPaperError(governedCombination, coverage, mockPaper);
  const mockBlockReason = mockRuleError || mockCoverageError;

  function addPracticeSubject(subject: string) {
    setFormError('');
    setPracticeSubjects((current) => {
      if (current.some((item) => normalizeSubject(item) === normalizeSubject(subject))) return current;
      const subjectLimit = subjectLimitFor(examBody, limits);
      if (current.length >= subjectLimit) {
        setFormError(`A session can include at most ${subjectLimit} subjects${exam === 'jamb' ? ' for JAMB UTME' : ''}. Remove one before adding another.`);
        return current;
      }
      return [...current, subject];
    });
  }

  function removePracticeSubject(subject: string) {
    setFormError('');
    // A compulsory subject (JAMB's Use of English) is never removable; every
    // other subject - including English in WAEC/NECO/Post-UTME - is.
    if (isCompulsorySubject(subject)) return;
    setPracticeSubjects((current) => current.filter((item) => normalizeSubject(item) !== normalizeSubject(subject)));
  }

  async function startSession() {
    if (!targetExam) return;
    const subjects = mode === 'practice' ? practiceSubjects : governedCombination.filter(Boolean);
    const combinationError = mode === 'mock' ? mockCombinationError(subjects, examBody) : null;
    if (combinationError) {
      setFormError(combinationError);
      return;
    }
    if (mode === 'mock') {
      const paperError = mockPaperError(subjects, coverage, mockPaper);
      if (paperError) {
        setFormError(paperError);
        return;
      }
    }
    if (compulsoryMissing) {
      setFormError('Use of English is compulsory for JAMB UTME, but this question bank has no English questions available. Choose another bank.');
      return;
    }
    const config = {
      mode,
      subjects,
      questionCount: mode === 'practice' ? effectiveCount : mockCount,
      durationMinutes: mode === 'practice' ? effectiveDuration : mockDurationMinutes(bank?.exam.defaultDurationMinutes),
    };

    // The same subject cap the picker applies, so the client-side validation
    // cannot disagree with the server's JAMB rule (four, not the generic six).
    const localError = validateSession(
      config,
      availability,
      { ...limits, maxSubjects: subjectLimitFor(examBody, limits) },
      compulsoryKeys,
    );
    if (localError) {
      setFormError(localError);
      return;
    }
    if (mode === 'mock' && uncovered.length) {
      setFormError(`This bank has no questions for: ${uncovered.map((entry) => entry.subject).join(', ')}. Remove those subjects or choose a different bank.`);
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const started = await startConfiguredCbt({
        examId: targetExam.id,
        mode,
        subjects,
        questionCount: config.questionCount,
        durationMinutes: mode === 'practice' ? config.durationMinutes : null,
        programme: exam === 'post-utme' ? selectedPostUtmeInstitution?.school_name ?? null : null,
      });
      trackEvent('cbt_start', { metadata: { examId: targetExam.id, examTitle: targetExam.title, mode } });
      const params = new URLSearchParams();
      if (started.resumed) params.set('resumed', '1');
      const query = params.toString();
      navigateInApp(`/cbt/session/${encodeURIComponent(started.id)}${query ? `?${query}` : ''}`);
    } catch (error) {
      setFormError(userFacingError(error, 'This session could not be started. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  const activePlan = mode === 'practice'
    ? practicePlan
    : previewPlan(coverage, mockCount, mockPaper?.subjectQuota);
  const summaryLines = describeSession(
    {
      mode,
      subjects: mode === 'practice' ? practiceSubjects : governedCombination,
      questionCount: mode === 'practice' ? effectiveCount : mockCount,
      durationMinutes: mode === 'practice' ? effectiveDuration : mockDurationMinutes(bank?.exam.defaultDurationMinutes),
    },
    activePlan,
  );

  const defaultMinutes = bank?.exam.defaultDurationMinutes ?? null;
  const selectedPostUtmeInstitution = postUtmeInstitutions.find((school) => school.id === postUtmeInstitutionId) || null;
  const catalogEmpty = catalogLoading === false && !targetExam && !catalogError && !(exam === 'post-utme' && selectedPostUtmeInstitution?.post_utme_method === 'handwritten');

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '22px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '860px' }}>
          <section className="er-setup-hero">
            <div className="er-setup-hero-mark"><img src={copy.logo} alt={`${exam.toUpperCase()} logo`} width={48} height={48} decoding="async" /></div>
            <div>
              <span className="hub-eyebrow">{copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.intro}</p>
              <span className="er-setup-duration"><Clock3 size={14} /> {defaultMinutes ? `${targetExam?.title || 'This bank'} · standard time ${defaultMinutes} minutes` : copy.duration}</span>
            </div>
          </section>

          {exam === 'post-utme' && (
            <section className="er-setup-panel" aria-labelledby="post-utme-school-title">
              <div className="er-setup-section-heading">
                <div><span className="hub-eyebrow">Institution-specific screening</span><h2 id="post-utme-school-title">Choose your school</h2></div>
                <BookOpen size={22} aria-hidden="true" />
              </div>
              <p>Post-UTME is not the same across institutions. EduReach lists only schools whose participation and screening method have been verified from an official school source.</p>
              <label className="admin-field" style={{ maxWidth: 560 }}>
                <span>Participating institution</span>
                <select className="admin-select" value={postUtmeInstitutionId} onChange={(event) => {
                  const id = event.target.value;
                  setPostUtmeInstitutionId(id);
                  const params = new URLSearchParams(window.location.search);
                  if (id) params.set('school', id); else params.delete('school');
                  window.history.replaceState({}, '', `/cbt/setup/post-utme${params.toString() ? `?${params.toString()}` : ''}`);
                  setFormError('');
                }}>
                  <option value="">Select a verified school…</option>
                  {postUtmeInstitutions.map((school) => <option key={school.id} value={school.id}>{school.school_name}{school.acronym ? ` (${school.acronym})` : ''}{school.state ? ` · ${school.state}` : ''}</option>)}
                </select>
              </label>
              {!catalogLoading && postUtmeInstitutions.length === 0 && (
                <InlineNotice tone="warning" title="No verified Post-UTME schools listed yet">
                  EduReach will not assume that a school conducts screening or guess its method. The admin team must verify participation and the official school announcement first.
                </InlineNotice>
              )}
              {selectedPostUtmeInstitution && (
                <InlineNotice tone="info" title={selectedPostUtmeInstitution.post_utme_method === 'cbt' ? 'This school uses CBT' : 'This school uses handwritten / paper-based screening'}>
                  Official school source: <a href={selectedPostUtmeInstitution.post_utme_source_url} target="_blank" rel="noreferrer">view announcement</a>.
                  {selectedPostUtmeInstitution.post_utme_method === 'cbt'
                    ? ' EduReach will show a CBT setup only when a question bank is configured specifically for this institution.'
                    : ' EduReach keeps a separate paper/PDF area for this school; it will not launch a CBT session for a handwritten examination.'}
                </InlineNotice>
              )}
            </section>
          )}

          {exam === 'post-utme' && selectedPostUtmeInstitution?.post_utme_method === 'handwritten' && (
            <section className="er-setup-panel" aria-labelledby="post-utme-paper-title">
              <div className="er-setup-section-heading"><div><span className="hub-eyebrow">Paper-based preparation</span><h2 id="post-utme-paper-title">Handwritten Post-UTME papers</h2></div><BookOpen size={22} /></div>
              {postUtmePapersLoading ? <p>Loading verified papers…</p> : postUtmePapers.length ? (
                <div className="er-setup-guide-grid">
                  {postUtmePapers.map((paper) => <article className="er-setup-guide-item" key={paper.id}>
                    <span><BookOpen size={16} /></span><div><strong>{paper.title}</strong><p>{[paper.subject, paper.course, paper.year].filter(Boolean).join(' · ') || 'School-specific paper'}</p>
                    {paper.description && <p>{paper.description}</p>}
                    {paper.href ? <a href={paper.href} target="_blank" rel="noreferrer">{paper.access === 'download' ? 'Open / download PDF' : 'View paper'} <ArrowRight size={13} /></a> : <small>File not available right now.</small>}
                  </div></article>)}
                </div>
              ) : <InlineNotice tone="info" title="No papers uploaded for this school yet">This school is verified as handwritten, but EduReach has no reviewed PDF papers for it yet. Check back after the admin team uploads and routes the documents.</InlineNotice>}
            </section>
          )}

          {(exam !== 'post-utme' || selectedPostUtmeInstitution?.post_utme_method === 'cbt') && (
            <section className="er-setup-guide" aria-labelledby="cbt-guide-title">
              <div className="er-setup-section-heading">
                <div>
                  <span className="hub-eyebrow">Before you begin</span>
                  <h2 id="cbt-guide-title">How this CBT session works</h2>
                </div>
                <Calculator size={22} aria-hidden="true" />
              </div>
              <div className="er-setup-guide-grid">
                {guideItems.map((item, index) => (
                  <div className="er-setup-guide-item" key={item.title}>
                    <span>{index + 1}</span>
                    <div><strong>{item.title}</strong><p>{item.body}</p></div>
                  </div>
                ))}
              </div>
              <p className="er-setup-note"><ShieldCheck size={15} /> This is a practice environment. Confirm the current official examination instructions for your examination year.</p>
            </section>
          )}

          {catalogError !== null && !targetExam && (
            <ErrorState error={catalogError} onRetry={() => void resolveCatalogAndBank()} />
          )}

          {catalogEmpty && (
            <InlineNotice tone="warning" title="No question bank is published for this examination yet">
              Nothing has been added for {exam.toUpperCase()} yet, so there is no paper to sit. <a href="/cbt">Browse available CBT question banks</a> or check back soon.
            </InlineNotice>
          )}

          {bankError !== null && targetExam && (
            <ErrorState
              error={bankError}
              onRetry={() => void loadBank(targetExam.id)}
              action={<a className="hub-outline-btn" href="/cbt"><RotateCcw size={14} /> Choose another bank</a>}
            />
          )}

          {targetExam && bank && exam === 'waec' && (
            <InlineNotice tone="warning" title="WAEC practice format: objective questions only">
              This EduReach bank currently supports four-option multiple-choice questions. WASSCE paper types and timings vary by subject, and some papers require written, practical or oral responses. Do not treat this session as a full WASSCE simulation or as official past questions unless the individual items have verified sources.
              {bank.exam.officialGuidanceUrl ? <> Official guidance: <a href={bank.exam.officialGuidanceUrl} target="_blank" rel="noreferrer">view source</a>.</> : null}
              {bank.exam.formatNotes ? <> Editorial note: {bank.exam.formatNotes}</> : null}
            </InlineNotice>
          )}

          {targetExam && bank && exam !== 'waec' && bank.exam.formatStatus !== 'verified' && (
            <InlineNotice tone="warning" title="Exam format has not been verified for this bank">
              This bank is available for practice, but its paper structure has not been fully verified against official guidance. Treat the questions as practice material, not certified official past questions.
              {bank.exam.officialGuidanceUrl ? <> Official guidance: <a href={bank.exam.officialGuidanceUrl} target="_blank" rel="noreferrer">view source</a>.</> : null}
              {bank.exam.formatNotes ? <> Editorial note: {bank.exam.formatNotes}</> : null}
            </InlineNotice>
          )}

          {targetExam && bank && (
            <>
              {/* Mode choice: the student decides what kind of session this is. */}
              <section className="er-setup-panel" aria-labelledby="mode-title">
                <div className="er-setup-section-heading">
                  <div>
                    <span className="hub-eyebrow">Session type</span>
                    <h2 id="mode-title">Practice or mock?</h2>
                  </div>
                  <CardIdentityMark value={exam} type="service" size="sm" />
                </div>
                <div className="er-mode-choice" role="radiogroup" aria-label="Choose session type">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'practice'}
                    className={mode === 'practice' ? 'er-mode-option is-selected' : 'er-mode-option'}
                    onClick={() => { setMode('practice'); setFormError(''); }}
                  >
                    <strong>Practice</strong>
                    <span>You choose a subject group and subjects. Question count determines the allocated time; your practice result can be kept or deleted.</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'mock'}
                    className={mode === 'mock' ? 'er-mode-option is-selected' : 'er-mode-option'}
                    onClick={() => { setMode('mock'); setFormError(''); }}
                  >
                    <strong>Mock examination</strong>
                    <span>A JAMB mock is the full UTME paper, including the compulsory Use of English. Other bodies use the bank's own paper at its configured time.</span>
                  </button>
                </div>
              </section>

              <section className="er-setup-panel" aria-labelledby="setup-selection-title">
                <div className="er-setup-section-heading">
                  <div>
                    <span className="hub-eyebrow">{mode === 'practice' ? 'Your paper' : 'Your programme'}</span>
                    <h2 id="setup-selection-title">
                      {mode === 'practice' ? 'Choose subjects and questions' : 'Choose subjects for your mock'}
                    </h2>
                  </div>
                  <Calculator size={22} aria-hidden="true" />
                </div>

                {(mode === 'practice' || mode === 'mock') && (
                  <div className="er-setup-form-grid">
                    <div className="er-setup-full-width">
                      <span className="er-setup-label">Subject group</span>
                      <div className="er-setup-duration-options" role="radiogroup" aria-label="Filter subjects by group">
                        {(['General', 'Science', 'Commercial', 'Arts & Humanities'] as const).map((track) => (
                          <button key={track} type="button" role="radio" aria-checked={practiceTrack === track} className={`er-setup-duration-option${practiceTrack === track ? ' is-selected' : ''}`} onClick={() => { setPracticeTrack(track); setFormError(''); }}>
                            {track === 'Arts & Humanities' ? 'Arts' : track}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="er-setup-full-width">
                      <div className="er-setup-label">
                        Subjects ({practiceSubjects.length} of {subjectLimitFor(examBody, limits)} selected){compulsoryEnglish ? ` · ${compulsoryEnglish} compulsory` : ''}
                      </div>
                      <div className="er-setup-subject-grid" aria-label="Available subjects">
                        {addableSubjects.length ? addableSubjects.map((entry) => {
                          const lockedAtLimit = practiceSubjects.length >= subjectLimitFor(examBody, limits);
                          return (
                            <button
                              key={entry.subject}
                              type="button"
                              className="er-setup-duration-option"
                              disabled={lockedAtLimit}
                              onClick={() => addPracticeSubject(entry.subject)}
                              aria-label={`Add ${entry.subject}`}
                              title={lockedAtLimit ? 'Required subject combination is complete' : `Add ${entry.subject}`}
                            >
                              <Plus size={15} aria-hidden="true" />
                              <span>{entry.subject}</span>
                              <small>{entry.questionCount} available</small>
                            </button>
                          );
                        }) : (
                          <p className="er-setup-field-note">{practiceSubjects.length >= subjectLimitFor(examBody, limits) ? 'Subject combination complete. Remove a subject only if you need to change it.' : practiceTrack === 'General' ? 'No more subjects available in this bank.' : 'No more subjects from this group in the bank. Switch to General to see every subject it holds.'}</p>
                        )}
                      </div>
                      {practiceSubjects.length > 0 ? (
                        <ul className="er-selected-subjects" aria-label="Selected subjects">
                          {practiceSubjects.map((subject) => {
                            const entry = availability.find((item) => normalizeSubject(item.subject) === normalizeSubject(subject));
                            const planned = activePlan.find((item) => normalizeSubject(item.subject) === normalizeSubject(subject));
                            const compulsory = isCompulsorySubject(subject);
                            return (
                              <li key={subject}>
                                <span className="er-selected-subject-name">{subject}{compulsory ? ' · compulsory' : ''}</span>
                                <span className="er-selected-subject-count">
                                  {entry ? `${entry.questionCount} in bank` : 'not in this bank'}
                                  {planned && planned.questions > 0 ? ` · ${planned.questions} in your paper (Q${planned.first}–Q${planned.last})` : ''}
                                </span>
                                {compulsory ? (
                                  <span className="er-selected-locked"><Lock size={13} aria-hidden="true" /> Required</span>
                                ) : (
                                  <button type="button" className="er-selected-remove" onClick={() => removePracticeSubject(subject)} aria-label={`Remove ${subject}`}>
                                    <X size={14} aria-hidden="true" /> Remove
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="er-setup-field-note" role="status">No subjects selected yet. Add at least one from the list above.</p>
                      )}
                      {availability.length === 0 && (
                        <InlineNotice tone="warning" title="This question bank has no subjects with questions yet">
                          There is nothing to practise in this bank right now. <a href="/cbt">Choose another question bank</a>.
                        </InlineNotice>
                      )}
                      <p className="er-setup-field-note" id="cbt-subject-help">
                        <Info size={14} /> Only subjects with questions are listed. For JAMB, Use of English is compulsory and the combination is capped at four subjects.
                        {compulsoryEnglish ? ` ${compulsoryEnglish} is compulsory for this examination and cannot be removed.` : ''}
                      </p>
                    </div>

                    {mode === 'practice' && <>
                    <div className="er-setup-full-width">
                      <span className="er-setup-label">Number of questions</span>
                      <div className="er-setup-duration-options" role="radiogroup" aria-label="Choose how many questions">
                        {countChoices.map((count) => (
                          <button
                            key={count}
                            type="button"
                            role="radio"
                            aria-checked={effectiveCount === count}
                            className={`er-setup-duration-option${effectiveCount === count ? ' is-selected' : ''}`}
                            onClick={() => setQuestionCount(count)}
                          >
                            {count} question{count === 1 ? '' : 's'}{count === selectedBankTotal ? ' · all available' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="er-setup-full-width">
                      <span className="er-setup-label">Allocated time</span>
                      <div className="er-setup-duration-options" aria-live="polite">
                        <span className="er-setup-duration-option is-selected"><Clock3 size={14} /> {effectiveDuration} minutes for {effectiveCount} questions</span>
                      </div>
                      <p className="er-setup-field-note">
                        <Clock3 size={14} /> Time is calculated automatically from the question count and the exam's standard duration. The countdown cannot be extended once the test starts.
                      </p>
                    </div>
                    </>}
                  </div>
                )}

                {/* What is about to happen, in one place. */}
                <div className="er-summary" aria-live="polite">
                  <h3>Before you start</h3>
                  <ul>
                    {summaryLines.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                  <p className="er-setup-field-note">
                    <ShieldCheck size={14} /> {mode === 'mock'
                      ? (mockPaper
                        ? `The mock reproduces the examination paper: ${mockPaper.questions} questions in ${mockDurationMinutes(bank?.exam.defaultDurationMinutes)} minutes, timed from the moment you press Start mock.`
                        : 'The paper is filled from your chosen subjects, up to the session limit, and runs for the examination\'s configured time. The timer starts the moment you press Start mock.')
                      : 'You can leave and come back: your answers are saved and the remaining time is preserved.'}
                  </p>
                </div>

                {!user && (
                  <InlineNotice tone="info" title="You need an account to sit a paper">
                    Practice and mock sessions are saved to your account, so answers, time and results survive a lost connection. <a href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Sign in</a> or register, then come back. Your setup stays as you left it.
                  </InlineNotice>
                )}

                <p className="er-setup-field-note">
                  <ShieldCheck size={14} /> These are practice questions, not certified official past papers.
                </p>
                {compulsoryMissing && <InlineNotice tone="warning" title="Use of English is required for JAMB">This question bank has no English questions available yet, and a JAMB paper cannot start without them. Choose another bank to start a session.</InlineNotice>}
                {mode === 'mock' && practiceSubjects.length > 0 && mockRuleError && (
                  <InlineNotice tone="info" title="Your mock needs four subjects">{mockRuleError}</InlineNotice>
                )}
                {mode === 'mock' && practiceSubjects.length > 0 && !mockRuleError && mockCoverageError && (
                  <InlineNotice tone="warning" title="This bank cannot fill a full mock">{mockCoverageError}</InlineNotice>
                )}
                {formError && <div className="hub-form-error" role="alert">{formError}</div>}

                <div className="er-setup-actions">
                  <button
                    type="button"
                    className="hub-primary-btn"
                    onClick={() => void startSession()}
                    disabled={submitting || catalogLoading || compulsoryMissing || (mode === 'mock' && (uncovered.length > 0 || Boolean(mockBlockReason)))}
                  >
                    {submitting ? 'Starting…' : mode === 'mock' ? 'Start mock examination' : 'Start practice'} <ArrowRight size={15} />
                  </button>
                  <a className="hub-outline-btn" href="/past-questions"><BookOpen size={15} /> Browse past questions</a>
                </div>
              </section>
            </>
          )}

          {isSupabaseConfigured && catalog.length === 0 && !catalogLoading && !catalogError && (
            <InlineNotice tone="warning" title="No question bank is published yet">
              No active CBT question bank is available. <a href="/cbt">Browse the CBT Centre</a> or check back soon.
            </InlineNotice>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
