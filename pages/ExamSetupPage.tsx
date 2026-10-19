import { ArrowRight, BookOpen, Calculator, CheckCircle2, Clock3, Info, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { ErrorState, InlineNotice } from '../src/components/AsyncState';
import {
  jambCourses,
  jambDepartments,
  jambSubjectCatalog,
  postUtmeSchools,
  secondarySchoolSubjects,
  secondarySubjectCatalog,
  secondarySubjectTracks,
  type ExamSetupKey,
} from '../src/data/examPreparation';
import { fetchCbtBank, fetchCbtExams, fetchPastQuestionResources, fetchPostUtmeInstitutions, startConfiguredCbt, trackEvent, type CbtBankPayload, type PastQuestionResource, type PostUtmeInstitution } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { userFacingError } from '../lib/errors';
import { WAEC_SUBJECT_GROUPS, waecSubjectGroup, isWaecEnglishSubject } from '../src/data/waecSubjects';
import {
  DEFAULT_CBT_LIMITS,
  describeSession,
  normalizeSubject,
  previewPlan,
  questionCountOptions,
  resolveSetupExam,
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
// from the CBT catalogue — never a hard-coded time.
const setupCopy: Record<ExamSetupKey, SetupCopy> = {
  jamb: {
    eyebrow: 'JAMB CBT entry',
    title: 'Set up your JAMB practice or mock',
    intro: 'Choose the subjects you want, how many questions and how long you want — or sit a full mock based on the course you are applying for. Use of English is compulsory for UTME.',
    duration: 'Practice session',
    logo: '/icons/brands/jamb.png',
  },
  waec: {
    eyebrow: 'WAEC CBT entry',
    title: 'Set up your WAEC practice or mock',
    intro: 'Choose a subject bank for objective practice. WASSCE paper types, marks and timings depend on the subject and official guidance.',
    duration: 'Practice session',
    logo: '/icons/brands/waec.png',
  },
  neco: {
    eyebrow: 'NECO CBT entry',
    title: 'Set up your NECO practice or mock',
    intro: 'Choose a subject bank for practice. Confirm the paper types, marks and timings against current NECO guidance for each subject.',
    duration: 'Practice session',
    logo: '/icons/brands/neco.png',
  },
  'post-utme': {
    eyebrow: 'Post-UTME CBT entry',
    title: 'Set up your Post-UTME practice or mock',
    intro: 'Practise the subjects in your school’s screening, or run a timed mock using the school’s published subject list.',
    duration: 'Practice session',
    logo: '/icons/brands/jamb.png',
  },
};

const guideItems = [
  { title: 'You choose the paper', body: 'Practice sessions are yours: pick the subjects, the number of questions and the time you want to spend.' },
  { title: 'The timer is real', body: 'Once a session starts, the countdown is authoritative and keeps running. Refreshing or leaving the page does not add time.' },
  { title: 'Your work is saved', body: 'Answers are saved as you go, so a lost connection or a closed tab does not throw away the session.' },
  { title: 'Bank coverage is explicit', body: 'Only subjects with questions in the bank are offered. Question counts show availability, not proof of official source or format accuracy.' },
];

function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

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

  // Practice configuration — the student's own session.
  const [practiceSubjects, setPracticeSubjects] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [practiceTrack, setPracticeTrack] = useState<'General' | 'Science' | 'Commercial' | 'Arts & Humanities'>('General');
  const [pendingPracticeSubject, setPendingPracticeSubject] = useState('');

  // Mock configuration — the governed combination for a programme.
  const [department, setDepartment] = useState(jambDepartments[0]);
  const [courseName, setCourseName] = useState(jambCourses[0].name);
  const [schoolId, setSchoolId] = useState(postUtmeSchools[0].id);
  const [secondaryTrack, setSecondaryTrack] = useState<(typeof secondarySubjectTracks)[number]>('General');
  const [mockSubjects, setMockSubjects] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const limits = bank?.limits || DEFAULT_CBT_LIMITS;
  const availability = bank?.subjects || [];

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
      const exams = (await fetchCbtExams()) as CatalogExam[];
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
    // AN-1: which exam bodies reach the setup wizard — the step before any
    // attempt starts, which is where a funnel loses people.
    trackEvent('cbt_setup_view', { metadata: { mode: exam } });
  }, [exam]);

  // The subject list is the bank's real content, so a student can never
  // configure a paper the bank cannot serve. When the bank loads, preselect a
  // sensible default rather than an empty form, and honour a `subjects` wish
  // passed by a deep link (for example from past questions) when the bank has
  // those subjects.
  useEffect(() => {
    if (!availability.length) return;
    setPracticeSubjects((current) => {
      if (current.length) return current;
      const requested = (new URLSearchParams(window.location.search).get('subjects') || '')
        .split(/[|,;]/)
        .map((value) => value.trim())
        .filter(Boolean);
      const matched = requested.filter((subject) => availability.some(
        (entry) => normalizeSubject(entry.subject) === normalizeSubject(subject),
      )).map((subject) => availability.find((entry) => normalizeSubject(entry.subject) === normalizeSubject(subject))?.subject || subject);
      const defaultSubjects = matched.length ? matched : availability.slice(0, Math.min(2, availability.length)).map((entry) => entry.subject);
      const english = availability.find((entry) => /english/i.test(entry.subject))?.subject;
      const withCompulsoryEnglish = english
        ? [english, ...defaultSubjects.filter((subject) => normalizeSubject(subject) !== normalizeSubject(english))]
        : defaultSubjects;
      return withCompulsoryEnglish.slice(0, limits.maxSubjects);
    });
    setQuestionCount((current) => current ?? Math.min(20, bank?.totalQuestions || 20));
  }, [availability, bank]);

  // ---- Derived practice configuration ---------------------------------
  const selectedAvailability = useMemo(
    () => availability.filter((entry) => practiceSubjects.some((subject) => normalizeSubject(subject) === normalizeSubject(entry.subject))),
    [availability, practiceSubjects],
  );
  const selectedBankTotal = selectedAvailability.reduce((sum, entry) => sum + entry.questionCount, 0);
  const countChoices = useMemo(() => questionCountOptions(selectedBankTotal || bank?.totalQuestions || 0, limits), [selectedBankTotal, bank, limits]);
  const effectiveCount = questionCount && countChoices.includes(questionCount) ? questionCount : countChoices[countChoices.length - 1] ?? limits.minQuestions;
  // The question count determines the time allocation; no separate timer choice is shown.
  const effectiveDuration = Math.max(limits.minMinutes, Math.min(
    limits.maxMinutes,
    Math.ceil((effectiveCount / Math.max(1, limits.maxQuestions)) * (bank?.exam.defaultDurationMinutes ?? 120)),
  ));
  const compulsoryEnglish = availability.find((entry) => /english/i.test(entry.subject))?.subject || null;
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
  const visiblePracticeAvailability = availability.filter((entry) => !trackSubjectNames || trackSubjectNames.has(normalizeSubject(entry.subject)) || /english/i.test(entry.subject));
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
  const mockCount = Math.min(mockBankTotal, limits.maxQuestions);

  /** Courses whose full governed combination this bank can actually serve. */
  const coveredCourses = useMemo(() => {
    if (exam !== 'jamb') return [];
    return jambCourses.filter((course) => course.subjects.every((subject) => availability.some(
      (entry) => normalizeSubject(entry.subject) === normalizeSubject(subject) && entry.questionCount > 0,
    )));
  }, [exam, availability]);

  const alternativeCourses = useMemo(() => {
    if (exam !== 'jamb') return [];
    const sameDepartment = coveredCourses.filter((course) => course.department === (jambCourses.find((item) => item.name === courseName)?.department ?? ''));
    return (sameDepartment.length ? sameDepartment : coveredCourses).filter((course) => course.name !== courseName).slice(0, 3);
  }, [exam, coveredCourses, courseName]);

  function changeDepartment(value: string) {
    setDepartment(value);
    const nextCourse = value === 'All departments' ? jambCourses[0] : jambCourses.find((course) => course.department === value) || jambCourses[0];
    setCourseName(nextCourse.name);
  }

  function startPracticeWithAvailableSubjects() {
    // Recovery path: use only the subjects the bank can serve, in practice mode.
    setMode('practice');
    setPracticeSubjects(availability.slice(0, Math.min(limits.maxSubjects, availability.length)).map((entry) => entry.subject));
    setFormError('');
  }

  function togglePracticeSubject(subject: string) {
    setFormError('');
    setPracticeSubjects((current) => {
      const exists = current.some((item) => normalizeSubject(item) === normalizeSubject(subject));
      const english = availability.find((entry) => /english/i.test(entry.subject))?.subject;
      if (exists && english && normalizeSubject(subject) === normalizeSubject(english)) return current; // English is compulsory.
      if (exists) return current.filter((item) => normalizeSubject(item) !== normalizeSubject(subject));
      if (current.length >= limits.maxSubjects) {
        setFormError(`A session can include at most ${limits.maxSubjects} subjects. Remove one before adding another.`);
        return current;
      }
      return [...current, subject];
    });
  }

  async function startSession() {
    if (!targetExam) return;
    const subjects = mode === 'practice' ? practiceSubjects : governedCombination.filter(Boolean);
    if (!compulsoryEnglish) {
      setFormError('English Language is compulsory, but this question bank has no English questions available. Choose another bank.');
      return;
    }
    if (!subjects.some((subject) => normalizeSubject(subject) === normalizeSubject(compulsoryEnglish))) {
      setFormError('English Language is compulsory. Keep it selected before starting the test.');
      return;
    }
    const config = {
      mode,
      subjects,
      questionCount: mode === 'practice' ? effectiveCount : mockCount,
      durationMinutes: mode === 'practice' ? effectiveDuration : (bank?.exam.defaultDurationMinutes ?? 0),
    };

    const localError = validateSession(config, availability, limits);
    if (localError) {
      setFormError(localError);
      return;
    }
    if (mode === 'mock' && uncovered.length) {
      setFormError(`This bank has no questions for: ${uncovered.map((entry) => entry.subject).join(', ')}. Choose a course the bank can serve, or practise the available subjects instead.`);
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
        programme: mode === 'mock' ? (exam === 'jamb' ? courseName : exam === 'post-utme' ? postUtmeSchools.find((school) => school.id === schoolId)?.name ?? null : secondaryTrack) : null,
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

  const summaryLines = describeSession(
    {
      mode,
      subjects: mode === 'practice' ? practiceSubjects : governedCombination,
      questionCount: mode === 'practice' ? effectiveCount : mockCount,
      durationMinutes: mode === 'practice' ? effectiveDuration : (bank?.exam.defaultDurationMinutes ?? 0),
    },
    mode === 'practice' ? practicePlan : previewPlan(coverage, mockCount),
  );

  const defaultMinutes = bank?.exam.defaultDurationMinutes ?? null;
  const filteredCourses = department === 'All departments' ? jambCourses : jambCourses.filter((course) => course.department === department);
  const selectedSchool = postUtmeSchools.find((school) => school.id === schoolId) || postUtmeSchools[0];
  const secondaryOptions = secondaryTrack === 'General' ? secondarySchoolSubjects : secondarySubjectCatalog[secondaryTrack];
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

          {catalogError && !targetExam && (
            <ErrorState error={catalogError} onRetry={() => void resolveCatalogAndBank()} />
          )}

          {catalogEmpty && (
            <InlineNotice tone="warning" title="No question bank is published for this examination yet">
              Nothing has been added for {exam.toUpperCase()} yet, so there is no paper to sit. <a href="/cbt">Browse available CBT question banks</a> or check back soon.
            </InlineNotice>
          )}

          {bankError && targetExam && (
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
                    <span>Choose your subject group and subjects. EduReach sets the question count and standard time automatically.</span>
                  </button>
                </div>
              </section>

              <section className="er-setup-panel" aria-labelledby="setup-selection-title">
                <div className="er-setup-section-heading">
                  <div>
                    <span className="hub-eyebrow">{mode === 'practice' ? 'Your paper' : 'Your programme'}</span>
                    <h2 id="setup-selection-title">
                      {mode === 'practice' ? 'Choose subjects, questions and time' : 'Choose subjects for your mock'}
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
                          <button key={track} type="button" role="radio" aria-checked={practiceTrack === track} className={`er-setup-duration-option${practiceTrack === track ? ' is-selected' : ''}`} onClick={() => { setPracticeTrack(track); const english = availability.find((entry) => /english/i.test(entry.subject))?.subject; setPracticeSubjects(english ? [english] : []); setFormError(''); }}>
                            {track === 'Arts & Humanities' ? 'Arts' : track}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="er-setup-full-width">
                      <span className="er-setup-label">Subjects ({practiceSubjects.length} of {limits.maxSubjects} selected){compulsoryEnglish ? ' · English compulsory' : ''}</span>
                      <div className="er-setup-form-grid">
                        <label className="er-setup-full-width">
                          <span className="er-setup-label">Add a subject from this question bank</span>
                          <select
                            className="admin-select"
                            value={pendingPracticeSubject}
                            onChange={(event) => setPendingPracticeSubject(event.target.value)}
                            aria-label="Choose a subject to add"
                          >
                            <option value="">Choose an available subject…</option>
                            {exam === 'waec'
                              ? WAEC_SUBJECT_GROUPS.map((group) => {
                                  const entries = visiblePracticeAvailability.filter((entry) => waecSubjectGroup(entry.subject) === group
                                    && !practiceSubjects.some((subject) => normalizeSubject(subject) === normalizeSubject(entry.subject)));
                                  return entries.length ? (
                                    <optgroup key={group} label={group}>
                                      {entries.map((entry) => <option key={entry.subject} value={entry.subject}>{entry.subject} ({entry.questionCount} questions)</option>)}
                                    </optgroup>
                                  ) : null;
                                })
                              : visiblePracticeAvailability
                                  .filter((entry) => !practiceSubjects.some((subject) => normalizeSubject(subject) === normalizeSubject(entry.subject)))
                                  .map((entry) => <option key={entry.subject} value={entry.subject}>{entry.subject} ({entry.questionCount} questions)</option>)}
                          </select>
                        </label>
                        <div className="er-setup-full-width">
                          <button
                            type="button"
                            className="hub-outline-btn"
                            disabled={!pendingPracticeSubject || practiceSubjects.length >= limits.maxSubjects}
                            onClick={() => {
                              if (pendingPracticeSubject) {
                                togglePracticeSubject(pendingPracticeSubject);
                                setPendingPracticeSubject('');
                              }
                            }}
                          >Add subject</button>
                        </div>
                      </div>
                      <div className="er-setup-subject-chips" aria-label="Selected subjects">
                        {practiceSubjects.map((subject) => {
                          const entry = availability.find((item) => normalizeSubject(item.subject) === normalizeSubject(subject));
                          if (!entry) return null;
                          const compulsory = exam === 'waec'
                            ? isWaecEnglishSubject(entry.subject)
                            : /english/i.test(entry.subject);
                          return (
                            <label key={entry.subject} className="er-setup-subject-chip">
                              <input
                                type="checkbox"
                                checked
                                onChange={() => togglePracticeSubject(entry.subject)}
                                disabled={compulsory}
                                aria-label={compulsory ? `${entry.subject} is compulsory` : `Remove ${entry.subject}`}
                              />
                              <span>{entry.subject}{compulsory ? ' · compulsory' : ''}</span>
                              <b className="er-chip-count">{entry.questionCount}</b>
                            </label>
                          );
                        })}
                      </div>
                      <p className="er-setup-field-note">
                        <Info size={14} /> Only subjects returned by this question bank can be selected. Counts show stored bank availability, not official-source verification. {exam === 'waec' ? 'WAEC subjects are grouped for easier browsing; English is compulsory when the bank provides an English subject.' : 'English remains compulsory when available in this bank.'}
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

                {false && mode === 'mock' && exam === 'jamb' && (
                  <div className="er-setup-form-grid">
                    <label>
                      Department / interest area
                      <select value={department} onChange={(event) => changeDepartment(event.target.value)}>
                        {jambDepartments.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      Course you are applying for
                      <select value={courseName} onChange={(event) => { setCourseName(event.target.value); setFormError(''); }}>
                        {filteredCourses.map((course) => <option key={course.name} value={course.name}>{course.name}</option>)}
                      </select>
                    </label>
                    <div className="er-setup-full-width">
                      <span className="er-setup-label">Subject combination EduReach will use</span>
                      <ul className="er-plan-list">
                        {coverage.map((entry) => (
                          <li key={entry.subject} className={entry.questionCount ? 'is-covered' : 'is-missing'}>
                            {entry.questionCount
                              ? <CheckCircle2 size={15} />
                              : <TriangleAlert size={15} />}
                            <span>{entry.subject}</span>
                            <b>{entry.questionCount ? `${entry.questionCount} in bank` : 'not in this bank'}</b>
                          </li>
                        ))}
                      </ul>
                      <p className="er-setup-field-note">
                        <ShieldCheck size={14} /> This combination comes from EduReach&rsquo;s UTME subject guide for the selected course. It is a study aid, not an official JAMB registration — confirm the current JAMB brochure and your institution&rsquo;s requirement before you register.
                      </p>
                    </div>
                  </div>
                )}

                {false && mode === 'mock' && (exam === 'waec' || exam === 'neco') && (
                  <div>
                    <div className="er-setup-form-grid" style={{ marginBottom: '12px' }}>
                      <label>
                        Track / subject area
                        <select
                          value={secondaryTrack}
                          onChange={(event) => {
                            const value = event.target.value as (typeof secondarySubjectTracks)[number];
                            setSecondaryTrack(value);
                            const options = (value === 'General' ? secondarySchoolSubjects : secondarySubjectCatalog[value]).slice(0, 9);
                            setMockSubjects(options);
                            setFormError('');
                          }}
                        >
                          {secondarySubjectTracks.map((track) => <option key={track} value={track}>{track}</option>)}
                        </select>
                      </label>
                    </div>
                    <p className="er-setup-field-note" style={{ marginTop: 0 }}>
                      Nine subjects are required for the mock paper, as in the real examination. Choose nine distinct subjects — English Language and Mathematics are suggested as core subjects.
                    </p>
                    <div className="er-setup-subject-grid">
                      {Array.from({ length: 9 }).map((_, index) => {
                        const value = mockSubjects[index] || '';
                        const used = new Set(mockSubjects.filter((_, slot) => slot !== index));
                        return (
                          <label key={index}>
                            Subject {index + 1}{index < 2 ? ' · core' : ''}
                            <select
                              value={value}
                              onChange={(event) => {
                                const next = [...(mockSubjects.length === 9 ? mockSubjects : secondaryOptions.slice(0, 9))];
                                next[index] = event.target.value;
                                setMockSubjects(next);
                                setFormError('');
                              }}
                            >
                              <option value="">Choose a subject</option>
                              {secondaryOptions.map((option) => <option key={option} value={option} disabled={used.has(option)}>{option}</option>)}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {false && mode === 'mock' && exam === 'post-utme' && (
                  <div className="er-setup-form-grid">
                    <label className="er-setup-full-width">
                      School of choice
                      <select value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setFormError(''); }}>
                        {postUtmeSchools.filter((school) => school.offersPostUtme).map((school) => <option key={school.id} value={school.id}>{school.name} · {school.location}</option>)}
                      </select>
                    </label>
                    <div className="er-setup-school-card er-setup-full-width">
                      <CheckCircle2 size={18} />
                      <div>
                        <strong>{selectedSchool.examLabel}</strong>
                        <span>{selectedSchool.subjects.join(' · ')}</span>
                        <small>Only schools with an active Post-UTME practice profile are listed. Check the school&rsquo;s current admission notice before applying.</small>
                      </div>
                    </div>
                    <div className="er-setup-full-width">
                      <span className="er-setup-label">Subject coverage in this bank</span>
                      <ul className="er-plan-list">
                        {coverage.map((entry) => (
                          <li key={entry.subject} className={entry.questionCount ? 'is-covered' : 'is-missing'}>
                            {entry.questionCount ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />}
                            <span>{entry.subject}</span>
                            <b>{entry.questionCount ? `${entry.questionCount} in bank` : 'not in this bank'}</b>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Recovery: never silently build a wrong paper. */}
                {false && mode === 'mock' && uncovered.length > 0 && (
                  <InlineNotice tone="warning" title={`This bank cannot build the full ${exam === 'jamb' ? 'course' : 'school'} paper yet`}>
                    {uncovered.map((entry) => entry.subject).join(', ')} {uncovered.length === 1 ? 'has' : 'have'} no questions in this bank. You can:
                    <span className="er-recovery-actions">
                      {alternativeCourses.map((course) => (
                        <button key={course.name} type="button" className="er-link-btn" onClick={() => { setCourseName(course.name); setFormError(''); }}>
                          {course.name}
                        </button>
                      ))}
                      <button type="button" className="er-link-btn" onClick={startPracticeWithAvailableSubjects}>
                        practise the {availability.length} available subject{availability.length === 1 ? '' : 's'} instead
                      </button>
                      <a className="er-link-btn" href="/cbt">choose another question bank</a>
                    </span>
                  </InlineNotice>
                )}

                {/* What is about to happen, in one place. */}
                <div className="er-summary" aria-live="polite">
                  <h3>Before you start</h3>
                  <ul>
                    {summaryLines.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                  <p className="er-setup-field-note">
                    <ShieldCheck size={14} /> {mode === 'mock'
                      ? 'The timer is fixed by the examination standard and starts the moment you press Start mock. Submitting or ending the test closes it.'
                      : 'You can leave and come back: your answers are saved and the remaining time is preserved.'}
                  </p>
                </div>

                {!user && (
                  <InlineNotice tone="info" title="You need an account to sit a paper">
                    Practice and mock sessions are saved to your account, so answers, time and results survive a lost connection. <a href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Sign in</a> or register, then come back — your setup stays as you left it.
                  </InlineNotice>
                )}

                {!compulsoryEnglish && <InlineNotice tone="warning" title="English Language is required">This question bank has no English questions available yet. Choose another bank to start a session.</InlineNotice>}
                {formError && <div className="hub-form-error" role="alert">{formError}</div>}

                <div className="er-setup-actions">
                  <button
                    type="button"
                    className="hub-primary-btn"
                    onClick={() => void startSession()}
                    disabled={submitting || catalogLoading || !compulsoryEnglish || (mode === 'mock' && uncovered.length > 0)}
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
