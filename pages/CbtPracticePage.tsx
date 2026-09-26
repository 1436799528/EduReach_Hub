import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  LayoutGrid,
  LogIn,
  Send,
  X,
} from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { identityClassFor } from '../src/components/CardIdentityMark';
import ScientificCalculator from '../src/components/ScientificCalculator';
import { fetchCbtAttemptProgress, fetchCbtExams, fetchCbtQuestions, saveCbtAttemptProgress, startCbt, submitCbt, trackEvent } from '../src/lib/api';
import { clearExamProgress, getExamProgress, saveExamProgress } from '../src/lib/cbt-offline';
import { localStorageKey } from '../src/lib/localPreview';
import { useAuth } from '../src/lib/auth';

type Question = { id: number; text: string; options: string[] };
type ExamSummary = { id: string; title: string; exam_body: string; subject: string; duration_minutes: number };
type ExamKey = 'jamb' | 'waec' | 'neco' | 'post-utme' | '';

const BRAND_LOGO: Record<Exclude<ExamKey, ''>, string> = {
  jamb: '/icons/brands/jamb.png',
  waec: '/icons/brands/waec.webp',
  neco: '/icons/brands/neco.webp',
  'post-utme': '/icons/brands/jamb.png',
};

function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function examKeyFor(value: string): ExamKey {
  const normalized = value.toLowerCase().replace(/[\s_]+/g, '-');
  if (normalized.includes('post-utme') || normalized.includes('postutme')) return 'post-utme';
  if (normalized.includes('waec')) return 'waec';
  if (normalized.includes('neco')) return 'neco';
  if (normalized.includes('jamb') || normalized.includes('utme')) return 'jamb';
  return '';
}

/**
 * Simulator links use stable ids (practice-exam-jamb, …). When a live exam
 * catalogue is available, map that request onto the first matching exam so the
 * "Start test" cards work against real question banks as well as the built-in
 * practice set.
 */
async function resolveExamId(requested: string): Promise<{ id: string; summary: ExamSummary | null }> {
  const exams = (await fetchCbtExams().catch(() => [])) as ExamSummary[];
  const exact = exams.find((exam) => exam.id === requested);
  if (exact) return { id: requested, summary: exact };
  const wanted = examKeyFor(requested);
  const match = wanted ? exams.find((exam) => examKeyFor(`${exam.exam_body} ${exam.title}`) === wanted) : undefined;
  return match ? { id: match.id, summary: match } : { id: requested, summary: null };
}

function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${mins}:${secs}` : `${mins}:${secs}`;
}

export default function CbtPracticePage() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const requestedExamId = new URLSearchParams(window.location.search).get('exam') || 'practice-exam-jamb';
  // Optional duration chosen on the setup page. It applies to guest/local
  // sessions; signed-in attempts keep the server-enforced expiry from the
  // exam's configured duration (single source of truth).
  const requestedDurationRaw = Number(new URLSearchParams(window.location.search).get('duration'));
  const requestedDuration = Number.isInteger(requestedDurationRaw) && requestedDurationRaw >= 5 && requestedDurationRaw <= 180
    ? requestedDurationRaw
    : null;

  const [examId, setExamId] = useState(requestedExamId);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examTitle, setExamTitle] = useState('CBT Practice Test');
  const [examBody, setExamBody] = useState('');
  const [subject, setSubject] = useState('');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flags, setFlags] = useState<Record<number, boolean>>({});
  const [seconds, setSeconds] = useState(1800);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [attemptId, setAttemptId] = useState('');
  const [restored, setRestored] = useState(false);
  const [attemptStarted, setAttemptStarted] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [message, setMessage] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const question = questions[index];
  const total = questions.length;
  const brand = examKeyFor(`${examId} ${examBody} ${examTitle}`) || 'jamb';
  const setupParams = new URLSearchParams(window.location.search);
  const setupCourse = setupParams.get('course') || '';
  const setupSchool = setupParams.get('schoolName') || '';
  const setupSubjects = (setupParams.get('subjects') || '').split('|').filter(Boolean);

  // Exam-focus mode: hide the site footer / mobile tab bar / page bar while a test is open.
  useEffect(() => {
    document.body.classList.add('er-exam-mode');
    const syncTop = () => {
      const header = document.querySelector('header');
      const height = header ? Math.round(header.getBoundingClientRect().height) : 60;
      document.documentElement.style.setProperty('--er-exam-top', `${height}px`);
    };
    syncTop();
    window.addEventListener('resize', syncTop);
    return () => {
      document.body.classList.remove('er-exam-mode');
      window.removeEventListener('resize', syncTop);
      document.documentElement.style.removeProperty('--er-exam-top');
    };
  }, []);

  async function beginAttempt(targetExamId: string, targetDurationMinutes: number, asGuest = false, questionCount = questions.length) {
    const storageKey = localStorageKey(`cbt-attempt-${targetExamId}`);
    let started: { attemptId: string; expiresAt: string; guest?: boolean } | null = null;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null') as { attemptId?: string; expiresAt?: string } | null;
      if (stored?.attemptId && stored.expiresAt && new Date(stored.expiresAt).getTime() > Date.now()) started = stored as { attemptId: string; expiresAt: string };
    } catch {
      // localStorage may be disabled
    }
    if (!started) started = await startCbt(targetExamId, targetDurationMinutes);
    trackEvent('cbt_start', { metadata: { examId: targetExamId, examTitle } });
    setAttemptId(started.attemptId);
    setAttemptStarted(true);
    setGuestMode(asGuest || Boolean(started.guest) || started.attemptId.startsWith('guest-cbt-'));
    setShowAccountPrompt(false);
    setSeconds(Math.max(0, Math.ceil((new Date(started.expiresAt).getTime() - Date.now()) / 1000)));
    try {
      localStorage.setItem(storageKey, JSON.stringify({ attemptId: started.attemptId, expiresAt: started.expiresAt }));
    } catch {
      // localStorage may be disabled
    }
    if (!asGuest && authUser && !started.attemptId.startsWith('guest-cbt-')) {
      const serverProgress = await fetchCbtAttemptProgress(started.attemptId).catch(() => ({ answers: {}, questionIndex: undefined }));
      if (Object.keys(serverProgress.answers).length) setAnswers((previous) => ({ ...previous, ...serverProgress.answers }));
      if (Number.isInteger(serverProgress.questionIndex) && questionCount) {
        setIndex(Math.max(0, Math.min(serverProgress.questionIndex as number, questionCount - 1)));
      }
    }
  }

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    async function loadExam() {
      try {
        const resolved = await resolveExamId(requestedExamId);
        if (!active) return;
        setExamId(resolved.id);
        if (resolved.summary) {
          setExamBody(resolved.summary.exam_body || '');
          setSubject(resolved.summary.subject || '');
        }

        const data = await fetchCbtQuestions(resolved.id);
        if (!active) return;
        setQuestions(data.questions);
        setExamTitle(data.exam.title || 'CBT Practice Test');
        setExamBody((data.exam as any).examBody || resolved.summary?.exam_body || '');
        if (data.exam.subject) setSubject(data.exam.subject);
        const examDurationMinutes = data.exam.durationMinutes || 30;
        const sessionMinutes = requestedDuration || examDurationMinutes;
        setDurationMinutes(sessionMinutes);

        const saved = await getExamProgress(resolved.id).catch(() => null);
        if (saved && active) {
          setAnswers(saved.answers);
          setFlags(saved.flags);
          setSeconds(saved.timeRemainingSeconds);
          if (Number.isInteger(saved.questionIndex)) setIndex(Math.max(0, Math.min(saved.questionIndex as number, data.questions.length - 1)));
        } else {
          setSeconds(sessionMinutes * 60);
        }

        setRestored(true);
        if (!authUser) {
          setShowAccountPrompt(true);
        } else {
          await beginAttempt(resolved.id, sessionMinutes, false, data.questions.length);
        }
      } catch (error) {
        if (!active) return;
        const text = error instanceof Error ? error.message : 'Unable to load the CBT exam.';
        if (/sign in/i.test(text)) setAuthRequired(true);
        else setMessage(text);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadExam();
    return () => { active = false; };
    // authLoading/authUser are deliberate dependencies so a student who signs in
    // and returns to this URL starts the same exam instead of losing the context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedExamId, authLoading, authUser?.id]);

  useEffect(() => {
    if (!restored || !attemptStarted || seconds <= 0 || !questions.length || authRequired) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [restored, attemptStarted, seconds, questions.length, authRequired]);

  useEffect(() => {
    if (restored && attemptStarted && questions.length && seconds === 0 && attemptId && !submitting) {
      void handleDirectSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, attemptStarted, questions.length, seconds, attemptId]);

  // JAMB-style keyboard shortcuts: A–D answer, N/→ next, P/← previous, F flag, S submit.
  useEffect(() => {
    if (!question) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], .er-calc')) return;
      const key = event.key.toLowerCase();

      if (showSubmitModal) {
        if (key === 'escape') setShowSubmitModal(false);
        return;
      }
      if (key === 'escape') {
        setCalcOpen(false);
        setPaletteOpen(false);
        return;
      }
      if (['a', 'b', 'c', 'd'].includes(key)) {
        const optionIndex = key.charCodeAt(0) - 97;
        if (optionIndex < question.options.length) setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }));
      } else if (key === 'n' || key === 'arrowright') {
        setIndex((value) => Math.min(value + 1, questions.length - 1));
      } else if (key === 'p' || key === 'arrowleft') {
        setIndex((value) => Math.max(value - 1, 0));
      } else if (key === 'f') {
        setFlags((value) => ({ ...value, [question.id]: !value[question.id] }));
      } else if (key === 's') {
        setShowSubmitModal(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [question, questions.length, showSubmitModal]);

  useEffect(() => {
    if (!restored || !questions.length) return;
    saveExamProgress({ examId, answers, flags, questionIndex: index, timeRemainingSeconds: seconds, lastUpdated: Date.now() }).catch(() => undefined);
  }, [answers, flags, index, seconds, restored, questions.length, examId]);

  useEffect(() => {
    if (!attemptStarted || guestMode || !authUser || !attemptId) return;
    const timer = window.setTimeout(() => {
      void saveCbtAttemptProgress(attemptId, answers, index).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [answers, attemptId, attemptStarted, authUser, guestMode, index]);

  async function handleDirectSubmit() {
    setSubmitting(true);
    setMessage('');

    try {
      const activeAttemptId = attemptId || `local-att-${Date.now()}`;
      const result = await submitCbt({ examId, attemptId: activeAttemptId, answers });
      trackEvent('cbt_submit', { metadata: { examId } });
      localStorage.setItem(localStorageKey('last-cbt-attempt'), result.attemptId);
      localStorage.removeItem(localStorageKey(`cbt-attempt-${examId}`));
      await clearExamProgress(examId).catch(() => undefined);
      navigateInApp(`/cbt/results?attempt=${encodeURIComponent(result.attemptId)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission failed. Your answers are saved locally.');
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  }

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const flaggedCount = useMemo(() => Object.values(flags).filter(Boolean).length, [flags]);
  const unansweredCount = Math.max(0, total - answeredCount);
  const isTimeCritical = seconds < 300;
  const isLast = index === total - 1;

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (isLast) setShowSubmitModal(true);
    else setIndex((i) => Math.min(total - 1, i + 1));
  };
  const jumpTo = (target: number) => {
    setIndex(target);
    setPaletteOpen(false);
  };

  const paletteState = (q: Question, qIdx: number) => {
    const classes = ['er-exam-pal-btn'];
    if (answers[q.id] !== undefined) classes.push('is-answered');
    if (flags[q.id]) classes.push('is-flagged');
    if (index === qIdx) classes.push('is-current');
    return classes.join(' ');
  };

  const palette = (
    <>
      <div className="er-exam-pal-grid" role="list" aria-label="Question palette">
        {questions.map((q, qIdx) => (
          <button
            key={q.id}
            type="button"
            role="listitem"
            className={paletteState(q, qIdx)}
            onClick={() => jumpTo(qIdx)}
            aria-label={`Go to question ${qIdx + 1}${answers[q.id] !== undefined ? ', answered' : ''}${flags[q.id] ? ', flagged' : ''}`}
            aria-current={index === qIdx ? 'true' : undefined}
          >
            {qIdx + 1}
          </button>
        ))}
      </div>
      <div className="er-exam-legend">
        <span><i className="dot is-answered" /> Answered ({answeredCount})</span>
        <span><i className="dot is-flagged" /> Flagged ({flaggedCount})</span>
        <span><i className="dot" /> Not answered ({unansweredCount})</span>
      </div>
    </>
  );

  return (
    <HubLayout>
      <div className="er-exam">
        {/* EXAM CONTROL BAR — candidate strip, countdown, calculator, submit */}
        <div className="er-exam-bar">
          <div className="er-exam-bar-inner er-container">
            <div className="er-exam-id">
              <img src={BRAND_LOGO[brand]} alt={`${brand.toUpperCase()} logo`} width={36} height={36} />
              <div className="er-exam-id-copy">
                <h1>{examTitle}</h1>
                <span>
                  {subject && <em className="er-exam-chip">{subject}</em>}
                  {total > 0 && <span className="er-exam-progress">Question {index + 1} of {total}</span>}
                  {attemptStarted && <span className={`er-exam-session-note${guestMode ? ' is-guest' : ''}`}>{guestMode ? 'Guest session · not permanently saved' : 'Saved to your account'}</span>}
                </span>
                {(setupCourse || setupSchool || setupSubjects.length > 0) && (
                  <small className="er-exam-setup-context">
                    {setupCourse && `Course: ${setupCourse}`}
                    {setupSchool && `School: ${setupSchool}`}
                    {setupSubjects.length > 0 && `Subjects: ${setupSubjects.join(' · ')}`}
                  </small>
                )}
              </div>
            </div>

            <div className={`er-exam-timer${isTimeCritical ? ' is-critical' : ''}`} role="timer" aria-live="off" aria-label="Time remaining">
              <Clock size={16} />
              <span>{formatClock(seconds)}</span>
            </div>

            <div className="er-exam-controls">
              <button
                type="button"
                className={`er-exam-tool${calcOpen ? ' is-active' : ''}`}
                onClick={() => setCalcOpen((open) => !open)}
                aria-pressed={calcOpen}
                aria-label="Toggle calculator"
                disabled={loading || !total}
              >
                <Calculator size={16} /> <span>Calculator</span>
              </button>
              <button
                type="button"
                className="er-exam-submit"
                onClick={() => setShowSubmitModal(true)}
                disabled={loading || !total}
              >
                <Send size={14} /> <span>Submit</span>
              </button>
            </div>
          </div>
        </div>

        <div className="er-container er-exam-body">
          {message && (
            <div className="er-exam-alert" role="alert">
              <AlertTriangle size={16} /> <span>{message}</span>
            </div>
          )}

          {loading ? (
            <div className="er-cbt-workspace">
              <section className="er-exam-q er-skeleton-card" aria-busy="true" aria-label="Loading questions">
                <div className="er-skel er-skel-line" style={{ width: '32%' }} />
                <div className="er-skel er-skel-line" style={{ width: '90%', height: 18 }} />
                <div className="er-skel er-skel-line" style={{ width: '70%', height: 18 }} />
                <div className="er-skel er-skel-block" />
                <div className="er-skel er-skel-block" />
                <div className="er-skel er-skel-block" />
                <div className="er-skel er-skel-block" />
              </section>
              <aside className="er-exam-side er-skeleton-card">
                <div className="er-skel er-skel-line" style={{ width: '50%' }} />
                <div className="er-skel er-skel-block" style={{ height: 160 }} />
              </aside>
            </div>
          ) : showAccountPrompt ? (
            <div className="er-exam-gate er-exam-account-prompt">
              <LogIn size={26} />
              <h2>Save your CBT progress?</h2>
              <p>Take this test as normal. Sign in or register if you want EduReach to save your progress, test history, result and name with the score.</p>
              <div className="er-exam-save-points">
                <span>Progress you can continue later</span>
                <span>Results in My CBT</span>
                <span>Your details attached to the result</span>
              </div>
              <div className="er-exam-gate-actions">
                <a className="hub-primary-btn" href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Sign In</a>
                <a className="hub-outline-btn" href={`/register?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Register</a>
                <button type="button" className="hub-text-btn" onClick={() => void beginAttempt(examId, durationMinutes, true)}>Continue Without Account</button>
              </div>
              <small className="er-exam-guest-note">Guest results are kept on this device only. Sign in before starting if you need permanent history.</small>
            </div>
          ) : authRequired ? (
            <div className="er-exam-gate">
              <LogIn size={26} />
              <h2>We need to reconnect your session</h2>
              <p>Sign in again to save this test securely. Your local answers are still on this device.</p>
              <div className="er-exam-gate-actions">
                <a className="hub-primary-btn" href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Sign in &amp; continue</a>
                <button type="button" className="hub-text-btn" onClick={() => void beginAttempt(examId, durationMinutes, true)}>Continue as guest</button>
              </div>
            </div>
          ) : !question ? (
            <div className="er-exam-gate">
              <AlertTriangle size={26} />
              <h2>No questions found for this exam</h2>
              <p>This question bank is empty at the moment. Choose another exam to continue practising.</p>
              <div className="er-exam-gate-actions">
                <a className="hub-primary-btn" href="/cbt">Back to question banks</a>
              </div>
            </div>
          ) : (
            <div className="er-cbt-workspace">
              {/* QUESTION WORKSPACE */}
              <section className={`er-exam-q ${identityClassFor(examBody || 'cbt', 'service')}`} aria-labelledby="er-exam-question">
                <div className="er-exam-q-head">
                  <span className="er-exam-q-num">Question {index + 1} of {total}</span>
                  <button
                    type="button"
                    className={`er-exam-flag${flags[question.id] ? ' is-on' : ''}`}
                    onClick={() => setFlags((prev) => ({ ...prev, [question.id]: !prev[question.id] }))}
                    aria-pressed={Boolean(flags[question.id])}
                  >
                    <Flag size={14} /> {flags[question.id] ? 'Flagged for review' : 'Flag for review'}
                  </button>
                </div>

                <h2 id="er-exam-question" className="er-exam-text">{question.text}</h2>

                <div className="er-exam-options" role="radiogroup" aria-label="Answer options">
                  {question.options.map((option, optIdx) => {
                    const isSelected = answers[question.id] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`er-exam-option${isSelected ? ' is-selected' : ''}`}
                        onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: optIdx }))}
                      >
                        <span className="er-exam-letter">{String.fromCharCode(65 + optIdx)}</span>
                        <span className="er-exam-option-text">{option}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="er-exam-nav">
                  <button type="button" className="hub-outline-btn er-exam-nav-btn" disabled={index === 0} onClick={goPrev}>
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <span className="er-exam-hint">Keyboard: A–D answer · N next · P previous · F flag · S submit</span>
                  <button type="button" className="hub-primary-btn er-exam-nav-btn" onClick={goNext}>
                    {isLast ? 'Finish' : 'Next'} <ChevronRight size={16} />
                  </button>
                </div>
              </section>

              {/* QUESTION PALETTE (desktop sidebar) */}
              <aside className="er-exam-side">
                <div className="er-exam-side-head">
                  <span>Question palette</span>
                  <strong>{answeredCount}/{total} answered</strong>
                </div>
                {palette}
                <button type="button" className="er-exam-side-submit" onClick={() => setShowSubmitModal(true)}>
                  <Send size={14} /> Submit test
                </button>
              </aside>
            </div>
          )}
        </div>

        {/* MOBILE EXAM BAR — previous / palette / next */}
        {!loading && question && (
          <div className="er-exam-mobile-bar">
            <button type="button" disabled={index === 0} onClick={goPrev} aria-label="Previous question">
              <ChevronLeft size={18} /> Prev
            </button>
            <button type="button" className="er-exam-mobile-map" onClick={() => setPaletteOpen(true)} aria-haspopup="dialog">
              <LayoutGrid size={16} /> {index + 1}/{total} · {answeredCount} done
            </button>
            <button type="button" className="is-primary" onClick={goNext} aria-label={isLast ? 'Finish test' : 'Next question'}>
              {isLast ? 'Finish' : 'Next'} <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* MOBILE PALETTE SHEET */}
        {paletteOpen && (
          <div className="er-exam-sheet-backdrop" onClick={() => setPaletteOpen(false)}>
            <div className="er-exam-sheet" role="dialog" aria-label="Question palette" onClick={(event) => event.stopPropagation()}>
              <div className="er-exam-sheet-head">
                <strong>Questions · {answeredCount}/{total} answered</strong>
                <button type="button" onClick={() => setPaletteOpen(false)} aria-label="Close palette"><X size={18} /></button>
              </div>
              {palette}
              <button
                type="button"
                className="er-exam-side-submit"
                onClick={() => {
                  setPaletteOpen(false);
                  setShowSubmitModal(true);
                }}
              >
                <Send size={14} /> Submit test
              </button>
            </div>
          </div>
        )}

        {/* ON-SCREEN CALCULATOR */}
        {calcOpen && <ScientificCalculator onClose={() => setCalcOpen(false)} />}

        {/* SUBMIT CONFIRMATION */}
        {showSubmitModal && (
          <div className="er-exam-modal-backdrop">
            <div className="er-exam-modal" role="dialog" aria-modal="true" aria-labelledby="er-exam-submit-title">
              <h3 id="er-exam-submit-title">{seconds === 0 ? 'Time is up' : 'Submit your test?'}</h3>
              <p>
                You have answered <strong>{answeredCount}</strong> of <strong>{total}</strong> questions.
                {unansweredCount > 0 && (
                  <span className="er-exam-modal-warn">
                    <AlertTriangle size={14} /> {unansweredCount} unanswered question{unansweredCount === 1 ? '' : 's'} will be marked wrong.
                  </span>
                )}
                {flaggedCount > 0 && <span className="er-exam-modal-note">{flaggedCount} question{flaggedCount === 1 ? '' : 's'} still flagged for review.</span>}
              </p>
              <div className="er-exam-modal-actions">
                <button type="button" className="hub-outline-btn" onClick={() => setShowSubmitModal(false)} disabled={submitting}>
                  Continue test
                </button>
                <button type="button" className="hub-primary-btn" onClick={() => void handleDirectSubmit()} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Yes, submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </HubLayout>
  );
}
