import {
  AlertTriangle, ArrowLeft, ArrowRight, Calculator, CheckCircle2, Clock3, Eraser,
  Flag, Grid3X3, LogOut, Send, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScientificCalculator from '../src/components/ScientificCalculator';
import ConnectionBanner from '../src/components/ConnectionBanner';
import { ErrorState } from '../src/components/AsyncState';
import WaveLoader from '../src/components/WaveLoader';
import { useAuth } from '../src/lib/auth';
import { usePendingPhase } from '../src/lib/usePendingPhase';
import {
  abandonConfiguredCbt, CbtProtocolUnavailableError, fetchCbtAttemptPaper, fetchCbtV2State, saveConfiguredCbtDraft, submitConfiguredCbt, trackEvent,
  type CbtAttemptPayload, type CbtQuestionPayload,
} from '../src/lib/api';
import { userFacingError } from '../lib/errors';
import { classifyFailure } from '../src/lib/failures';
import { navigateInApp } from '../src/lib/navigation';
import { inspectCbtAnswerJournal, projectCbtJournal } from '../src/lib/cbtAnswerQueue';

/**
 * CBT-3 - the examination hall.
 *
 * This is a dedicated shell on purpose: no site header, no footer, no navigation
 * away. The student sees one paper, one timer and two ways out:
 *
 *   Submit  - ends the examination, scores the paper and shows the result.
 *   End Test - leaves the examination; the paper is closed, not scored.
 *
 * The countdown is driven by the server's `expiresAt` (offset against the
 * server's own clock so a device with the wrong time cannot change it), the
 * paper is the frozen one the server planned, and answers are saved as they are
 * chosen - including retrying after a connection drop.
 */

const PENDING_PREFIX = 'edureach-cbt-pending:';

function readPending(attemptId: string): Record<number, number> | null {
  try {
    const raw = localStorage.getItem(`${PENDING_PREFIX}${attemptId}`);
    return raw ? JSON.parse(raw) as Record<number, number> : null;
  } catch {
    return null;
  }
}

function writePending(attemptId: string, answers: Record<number, number> | null) {
  try {
    if (answers) localStorage.setItem(`${PENDING_PREFIX}${attemptId}`, JSON.stringify(answers));
    else localStorage.removeItem(`${PENDING_PREFIX}${attemptId}`);
  } catch {
    // localStorage may be disabled; the session still works in memory.
  }
}

/** Best-effort compare before removal; localStorage does not provide an atomic CAS. */
function clearAcknowledgedPending(attemptId: string, snapshot: Record<number, number>): boolean {
  try {
    const key = `${PENDING_PREFIX}${attemptId}`;
    const stored = localStorage.getItem(key);
    if (stored === null) return true;
    if (stored !== JSON.stringify(snapshot)) return false;
    localStorage.removeItem(key);
    return localStorage.getItem(key) === null;
  } catch { return false; }
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'pending' | 'error';
class CbtJournalStorageError extends CbtProtocolUnavailableError {}

export default function CbtSessionPage({ attemptId }: { attemptId: string }) {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<CbtAttemptPayload | null>(null);
  const [questions, setQuestions] = useState<CbtQuestionPayload[]>([]);
  const [loading, setLoading] = useState(true);
  // UI-2: the paper is one request; if it never answers, the screen says so
  // and offers the retry rather than spinning for the length of the exam.
  const loadPhase = usePendingPhase(loading);
  const [loadError, setLoadError] = useState<unknown>(null);
  // For eventual v2 integration, server draft/revision is authoritative, the
  // journal holds unresolved intent, and this existing state is only the
  // visible projection. A local projection is never itself a saved answer.
  const [answers, setAnswers] = useState<Record<number, number>>({});
  // Identity only; answers remain in the single visible projection above.
  const [previewScope, setPreviewScope] = useState<{ accountId: string; attemptId: string } | null>(null);
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [index, setIndex] = useState(0);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [closed, setClosed] = useState<'expired' | 'submitted' | 'cancelled' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'submit' | 'end' | 'unanswered' | null>(null);

  const submitDialog = useRef<HTMLDialogElement | null>(null);
  const endDialog = useRef<HTMLDialogElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswers = useRef<Record<number, number> | null>(null);
  const pendingIndex = useRef(0);
  const pendingVersion = useRef(0);
  const saveInFlight = useRef(false);
  const autoSubmitStarted = useRef(false);
  const legacyProtocol = useRef(false);
  const currentAccount = useRef(user?.id);
  currentAccount.current = user?.id;
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    // Concurrent paper retries must not allow an older response to re-enable
    // legacy writes after a later response failed protocol negotiation.
    const generation = ++loadGeneration.current;
    legacyProtocol.current = false;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setLoading(true);
    setLoadError(null);
    setPreviewScope(null);
    try {
      const payload = await fetchCbtAttemptPaper(attemptId);
      if (generation !== loadGeneration.current) return;
      // Recovery is read-only: keep the Phase 5 guard and never initialize an
      // editable attempt, retry operations, or transmit answers here.
      if (payload.protocol.version === 2) {
        try {
          const accountId = currentAccount.current;
          if (!accountId) throw new CbtProtocolUnavailableError();
          const state = await fetchCbtV2State(attemptId);
          const operations = await inspectCbtAnswerJournal({ accountId, attemptId }).catch(() => { throw new CbtJournalStorageError(); });
          if (generation !== loadGeneration.current) return;
          if (accountId !== currentAccount.current) throw new CbtProtocolUnavailableError();
          const recovered = projectCbtJournal({ accountId, attemptId }, state, payload.questions, operations);
          if (operations.length) {
            setAnswers(recovered);
            setQuestions(payload.questions);
            setPreviewScope({ accountId, attemptId });
          }
        } catch (error) {
          if (error instanceof CbtJournalStorageError) throw error;
          // An unavailable or inconsistent preflight never enables v1.
        }
        throw new CbtProtocolUnavailableError();
      }
      legacyProtocol.current = true;
      setAttempt(payload.attempt);
      setQuestions(payload.questions);
      setClockOffsetMs(Date.parse(payload.serverTime) - Date.now());
      // A pending draft is a whole snapshot, not a patch: merging would
      // resurrect answers the student deliberately cleared. Its age relative
      // to another tab/device or an in-flight request cannot be established.
      const pending = readPending(attemptId);
      setAnswers(pending ?? payload.attempt.savedAnswers ?? {});
      if (pending) {
        setSaveState('pending');
        setRecoveryNotice('A browser copy was restored but is not confirmed saved. It may be older than work in another tab or device. Review your answers before submitting.');
      }
      setIndex(Math.max(0, Math.min(payload.attempt.questionIndex || 0, Math.max(0, payload.questions.length - 1))));
      if (payload.attempt.status !== 'in_progress') setClosed(payload.attempt.status);
    } catch (error) {
      if (generation === loadGeneration.current) setLoadError(error);
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    void load();
    return () => { loadGeneration.current++; legacyProtocol.current = false; };
  }, [load]);

  useEffect(() => {
    document.body.classList.add('er-exam-mode');
    // Ensure the mobile bottom nav / site chrome stay hidden during an exam.
    document.documentElement.classList.add('er-exam-mode');
    return () => {
      document.body.classList.remove('er-exam-mode');
      document.documentElement.classList.remove('er-exam-mode');
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const expiresAt = attempt?.expiresAt ? Date.parse(attempt.expiresAt) : null;
  const remainingSeconds = expiresAt === null ? 0 : Math.max(0, Math.floor((expiresAt - (now + clockOffsetMs)) / 1000));
  const totalSeconds = (attempt?.durationMinutes || 0) * 60;

  // The clock is heard, not just seen. The ticking timer stays silent
  // (`aria-live="off"` below); a candidate who cannot see it is told once at
  // five minutes and once at one minute through the live region in the bar.
  // The retired pages/CbtPracticePage.tsx had this; the live session page had
  // lost it.
  const [clockNotice, setClockNotice] = useState('');
  useEffect(() => {
    const next = expiresAt === null || remainingSeconds <= 0
      ? ''
      : remainingSeconds <= 60
        ? 'One minute remaining.'
        : remainingSeconds <= 300
          ? 'Five minutes remaining.'
          : '';
    setClockNotice((current) => (current === next ? current : next));
  }, [remainingSeconds, expiresAt]);

  /** Serialize successful writes within this tab; only the newest acknowledgement clears its draft. */
  const flush = useCallback(async function drain() {
    if (!legacyProtocol.current || saveInFlight.current || !pendingAnswers.current) return;
    const generation = loadGeneration.current;
    const snapshot = pendingAnswers.current;
    const snapshotIndex = pendingIndex.current;
    const version = pendingVersion.current;
    saveInFlight.current = true;
    setSaveState('saving');
    let succeeded = false;
    try {
      await saveConfiguredCbtDraft(attemptId, snapshot, snapshotIndex);
      succeeded = true;
      // An old response is not permission to clear pending work after a new
      // paper load or an unmount changed the active protocol.
      if (legacyProtocol.current && generation === loadGeneration.current && version === pendingVersion.current) {
        pendingAnswers.current = null;
        if (clearAcknowledgedPending(attemptId, snapshot)) {
          setSaveState('saved');
          setRecoveryNotice('');
        } else {
          setSaveState('pending');
          setRecoveryNotice('A different browser copy may still be present. Further changes in this tab can overwrite it; check your other tab before continuing.');
        }
      }
    } catch (error) {
      const failure = classifyFailure(error);
      if (failure.kind === 'offline' || failure.kind === 'timeout' || failure.kind === 'server') {
        // Storage may be unavailable; keep the latest in-memory draft and report it as pending.
        setSaveState('pending');
      } else if (failure.kind === 'auth') {
        setSaveState('error');
        setActionError('Your session ended. Sign in again in this tab to keep saving. Your answers may be lost if you leave this page.');
      } else if (failure.kind === 'forbidden') {
        setSaveState('error');
        setActionError('Your account cannot save this attempt. Keep this page open and contact EduReach if you think this is a mistake.');
      } else {
        setSaveState('error');
      }
    } finally {
      saveInFlight.current = false;
      // Never spin on an error or assume a timed-out request did not commit.
      if (succeeded && pendingAnswers.current && version !== pendingVersion.current) void drain();
    }
  }, [attemptId]);

  const queueSave = useCallback((nextAnswers: Record<number, number>, nextIndex: number, immediate = false) => {
    if (!legacyProtocol.current) return;
    pendingAnswers.current = nextAnswers;
    pendingIndex.current = nextIndex;
    pendingVersion.current += 1;
    writePending(attemptId, nextAnswers);
    setSaveState('pending');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (immediate) void flush();
    else saveTimer.current = setTimeout(() => { void flush(); }, 900);
  }, [attemptId, flush]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  useEffect(() => {
    const retry = () => { if (pendingAnswers.current) void flush(); };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (pendingAnswers.current) void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  const subjectPlan = attempt?.plan || [];
  // Count only questions on this paper so stale local draft keys cannot inflate progress.
  const answeredCount = questions.filter((item) => answers[item.position] !== undefined).length;
  const markedCount = questions.filter((item) => Boolean(marked[item.position])).length;

  const submit = useCallback(async (reason: 'manual' | 'timer') => {
    if (!legacyProtocol.current || submitting || !attempt || closed === 'submitted') return;
    setSubmitting(true);
    setActionError('');
    try {
      await submitConfiguredCbt(attempt.id, answers);
      // AN-1: attempt completion is the denominator for cbt_start. Only a
      // submission the server accepted is counted, so a failed or expired
      // attempt never inflates the funnel.
      trackEvent('cbt_submit', { metadata: { examId: attempt.examId } });
      setClosed('submitted');
      navigateInApp(`/cbt/results/${encodeURIComponent(attempt.id)}`, { replace: true });
    } catch (error) {
      const failure = classifyFailure(error);
      if (failure.kind === 'not-found' || /expired/i.test(String((error as Error)?.message || ''))) {
        setClosed('expired');
        setActionError(reason === 'timer'
          ? 'Time is up. The examination was closed and nothing was submitted.'
          : 'This attempt had already expired, so nothing was submitted.');
      } else if (failure.kind === 'offline' || failure.kind === 'timeout' || failure.kind === 'server') {
        setActionError('Your submission could not be confirmed. Keep this page open, check your connection and your results before trying again.');
      } else {
        setActionError(userFacingError(error, 'Your paper could not be submitted. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [answers, attempt, closed, submitting]);

  // Time expired: stop the session exactly once, and never show negative time.
  useEffect(() => {
    if (!attempt || closed || loading) return;
    if (expiresAt !== null && remainingSeconds === 0 && !autoSubmitStarted.current) {
      autoSubmitStarted.current = true;
      void submit('timer');
    }
  }, [attempt, closed, expiresAt, loading, remainingSeconds, submit]);

  const endTest = useCallback(async () => {
    if (!legacyProtocol.current) return;
    setSubmitting(true);
    setActionError('');
    try {
      if (pendingAnswers.current) writePending(attemptId, pendingAnswers.current);
      await abandonConfiguredCbt(attemptId);
      setClosed('cancelled');
      navigateInApp(attempt?.mode === 'practice' ? '/cbt?ended=practice' : '/cbt?ended=mock', { replace: true });
    } catch (error) {
      setActionError(userFacingError(error, 'The test could not be ended. Check your connection and try again.'));
    } finally {
      setSubmitting(false);
    }
  }, [attempt?.mode, attemptId]);

  const choose = useCallback((optionIndex: number) => {
    if (closed) return;
    setAnswers((current) => {
      const next = { ...current, [questions[index].position]: optionIndex };
      queueSave(next, index);
      return next;
    });
  }, [closed, index, questions, queueSave]);

  const clearAnswer = useCallback(() => {
    if (closed) return;
    setAnswers((current) => {
      const next = { ...current };
      delete next[questions[index].position];
      queueSave(next, index);
      return next;
    });
  }, [closed, index, questions, queueSave]);

  const goTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    setIndex(nextIndex);
    if (attempt) queueSave(pendingAnswers.current || answers, nextIndex, true);
  }, [answers, attempt, queueSave, questions.length]);

  // Keyboard: 1–4 / A–D choose, arrows move, M marks. Never while a dialog is open.
  useEffect(() => {
    if (confirmKind || loading || loadError || !attempt || !questions[index]) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key >= '1' && event.key <= '4') choose(Number(event.key) - 1);
      else if (/^[a-dA-D]$/.test(event.key)) choose(event.key.toUpperCase().charCodeAt(0) - 65);
      else if (event.key === 'ArrowRight') goTo(index + 1);
      else if (event.key === 'ArrowLeft') goTo(index - 1);
      else if (event.key.toLowerCase() === 'm') setMarked((current) => ({ ...current, [questions[index].position]: !current[questions[index].position] }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attempt, choose, confirmKind, goTo, index, loadError, loading, questions]);

  const unansweredDialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (confirmKind === 'submit' && submitDialog.current && !submitDialog.current.open) submitDialog.current.showModal();
    if (confirmKind === 'end' && endDialog.current && !endDialog.current.open) endDialog.current.showModal();
    if (confirmKind === 'unanswered' && unansweredDialog.current && !unansweredDialog.current.open) unansweredDialog.current.showModal();
  }, [confirmKind]);

  const bySubject = useMemo(() => {
    const groups = new Map<string, CbtQuestionPayload[]>();
    questions.forEach((question) => {
      const list = groups.get(question.subject) || [];
      list.push(question);
      groups.set(question.subject, list);
    });
    return Array.from(groups.entries());
  }, [questions]);

  // Compact student identity (initials) - never push the question content aside.
  const studentInitials = useMemo(() => {
    const name = (user?.name || 'Student').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.slice(0, 2) || 'ST').toUpperCase();
  }, [user?.name]);
  const studentDisplayName = useMemo(() => {
    const name = (user?.name || 'Student').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
  }, [user?.name]);


  if (loading) {
    return (
      <div className="er-exam-shell">
        <ConnectionBanner />
        <div className="er-exam-loading" role="status">
          <WaveLoader decorative />
          <span>Preparing your paper…</span>
          {loadPhase === 'stalled' && (
            <button type="button" className="hub-outline-btn" onClick={() => void load()}>
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loadError || !attempt) {
    return (
      <div className="er-exam-shell">
        <ConnectionBanner />
        <div className="er-exam-centred">
          {loadError instanceof CbtProtocolUnavailableError ? (
            <div className="er-state er-state-error" role="alert">
              <div>
                <strong>This CBT session cannot be opened safely</strong>
                <p>{loadError instanceof CbtJournalStorageError
                  ? 'Browser storage is unavailable or requires review; pending answers cannot be recovered safely.'
                  : 'The session protocol is unavailable. This page cannot confirm your answers.'} Keep local work and contact EduReach.</p>
              </div>
              <a className="hub-outline-btn" href="/cbt">Back to the CBT Centre</a>
            </div>
          ) : (
            <ErrorState
              error={loadError}
              onRetry={() => void load()}
              action={<a className="hub-outline-btn" href="/cbt">Back to the CBT Centre</a>}
            />
          )}
          {previewScope?.accountId === user?.id && previewScope?.attemptId === attemptId && (
            <section aria-label="Read-only recovery preview">
              <h2>Read-only recovery preview</h2>
              <p>This is a local preview, not confirmation that pending answers are saved. Editing and submission remain unavailable.</p>
              <ol>
                {questions.map(question => (
                  <li key={question.id}>
                    {question.text}: {answers[question.position] === undefined ? 'No answer' : question.options[answers[question.position]]}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    );
  }

  if (closed || attempt.status !== 'in_progress') {
    const state = closed || attempt.status;
    return (
      <div className="er-exam-shell">
        <div className="er-exam-centred">
          <div className="er-exam-closed" role="status">
            <CheckCircle2 size={26} aria-hidden="true" />
            <h1>
              {state === 'submitted' ? 'Your paper was submitted' :
                state === 'expired' ? 'The time for this paper ran out' :
                  'This session was ended'}
            </h1>
            <p>
              {state === 'submitted'
                ? 'The result is ready.'
                : state === 'expired'
                  ? 'An examination is scored within its own time, so nothing was submitted. You can start a fresh session whenever you are ready.'
                  : 'Answers you had saved are kept with the session. Practice sessions can be restarted, and an examination record stays in your history.'}
            </p>
            <div className="er-exam-closed-actions">
              <a className="hub-primary-btn" href={`/cbt/results/${encodeURIComponent(attempt.id)}`}>View result</a>
              <a className="hub-outline-btn" href="/cbt">Back to the CBT Centre</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[index];
  const selected = answers[question?.position];
  const isMarked = Boolean(marked[question?.position]);
  const timeAlmostUp = remainingSeconds <= 300;
  const progressPercent = totalSeconds ? Math.min(100, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0;
  const isLastQuestion = index === questions.length - 1;
  const unansweredCount = questions.length - answeredCount;
  const currentSubjectEntry = subjectPlan.length > 1
    ? subjectPlan.find((plan) => question?.position >= plan.first && question?.position <= plan.last)
    : null;
  function handlePrimaryAction() {
    if (isLastQuestion) {
      // Final question: check for unanswered before confirming.
      if (unansweredCount > 0) {
        setConfirmKind('unanswered');
      } else {
        setConfirmKind('submit');
      }
    } else {
      goTo(index + 1);
    }
  }

  return (
    <div className="er-exam-shell">
      <ConnectionBanner />

      <header className="er-exam-bar">
        <div className="er-exam-bar-left">
          <div className="er-exam-candidate" aria-label="Candidate information">
            <div className="er-exam-candidate-avatar" aria-hidden="true">{studentInitials}</div>
            <div className="er-exam-candidate-meta">
              <strong>{studentDisplayName}</strong>
              <span>
                {attempt.mode === 'mock' ? 'Mock examination' : 'Practice'}
                {attempt.programme ? ` · ${attempt.programme}` : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="er-exam-bar-controls">
          <div className="er-exam-timer" role="timer" aria-live="off">
            <Clock3 size={15} aria-hidden="true" />
            <b className={timeAlmostUp ? 'is-critical' : ''}>{formatClock(remainingSeconds)}</b>
            <span>remaining</span>
            <i className="er-exam-timer-track" aria-hidden="true"><span style={{ width: `${progressPercent}%` }} /></i>
          </div>

          {/* Threshold announcements only; the ticking clock itself stays silent. */}
          <span className="er-visually-hidden" role="status">{clockNotice}</span>

          <button type="button" className="er-exam-tool" onClick={() => setCalcOpen(true)} aria-label="Open calculator">
            <Calculator size={15} /> <span className="er-exam-tool-label">Calculator</span>
          </button>
          <button type="button" className="er-exam-tool" onClick={() => setPaletteOpen((current) => !current)} aria-expanded={paletteOpen} aria-controls="er-exam-question-navigator" aria-label="Toggle question navigator">
            <Grid3X3 size={15} /> <span className="er-exam-tool-label">Questions</span>
          </button>
          <button type="button" className="er-exam-end" style={{ backgroundColor: '#B14933', color: '#ffffff', border: '2px solid #8f3727', boxShadow: '0 2px 8px rgba(0,0,0,0.22)', minHeight: 40, padding: '8px 14px', borderRadius: 8 }} onClick={() => setConfirmKind('end')} aria-label="End test">
            <LogOut size={15} /> <span className="er-exam-tool-label">End Test</span>
          </button>
        </div>
      </header>

      <main className="er-exam-main">
        {recoveryNotice && <p className="hub-form-error" role="note">{recoveryNotice}</p>}

        {subjectPlan.length > 1 && (
          <div className="er-exam-subject-tabs" role="tablist" aria-label="Exam subjects">
            {subjectPlan.map((entry) => {
              const answeredInBlock = questions.filter((item) =>
                item.position >= entry.first && item.position <= entry.last && answers[item.position] !== undefined
              ).length;
              const current = Boolean(question && question.position >= entry.first && question.position <= entry.last);
              return (
                <button
                  key={entry.subject}
                  type="button"
                  role="tab"
                  aria-selected={current}
                  className={current ? 'er-exam-subject-tab is-current' : 'er-exam-subject-tab'}
                  onClick={() => goTo(entry.first - 1)}
                >
                  <span>{entry.subject}</span>
                  <small>{answeredInBlock}/{entry.questions} answered</small>
                </button>
              );
            })}
          </div>
        )}
        <div className="er-exam-layout">
          <div className="er-exam-paper">
          <div className="er-exam-question-head">
            <div className="er-exam-subject-context">
              <span className="er-exam-subject-name er-exam-subject-pill">{(question?.subject || '').toUpperCase()}</span>
              {currentSubjectEntry ? (
                <span className="er-exam-position">
                  {currentSubjectEntry.subject} · Question {question.position - currentSubjectEntry.first + 1} of {currentSubjectEntry.questions}
                  <em> · Question {index + 1} of {questions.length}</em>
                </span>
              ) : (
                <span className="er-exam-position">
                  Question {index + 1} of {questions.length}
                </span>
              )}
            </div>
            <span className="er-exam-save-state" role="status">
              {saveState === 'saving' && <><WaveLoader variant="inline" decorative /> saving…</>}
              {saveState === 'saved' && <><CheckCircle2 size={13} /> saved</>}
              {saveState === 'pending' && <><AlertTriangle size={13} /> not yet saved; keep this page open</>}
              {saveState === 'error' && <><AlertTriangle size={13} /> not saved</>}
            </span>
          </div>

          <article className="er-exam-question">
            <h1>{question?.text}</h1>
            <div className="er-exam-options" role="radiogroup" aria-label="Answer options">
              {question?.options.map((option, optionIndex) => {
                const letter = String.fromCharCode(65 + optionIndex);
                const isSelected = selected === optionIndex;
                return (
                  <button
                    key={letter}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={isSelected ? 'er-exam-option is-selected' : 'er-exam-option'}
                    onClick={() => choose(optionIndex)}
                  >
                    <span className="er-exam-option-letter">{letter}</span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          </article>

          <div className="er-exam-question-actions">
            <button type="button" className="er-exam-ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
              <ArrowLeft size={15} /> Previous
            </button>
            <button
              type="button"
              className={isMarked ? 'er-exam-mark is-on' : 'er-exam-mark'}
              aria-pressed={isMarked}
              onClick={() => setMarked((current) => ({ ...current, [question.position]: !current[question.position] }))}
            >
              <Flag size={15} /> {isMarked ? 'Marked for review' : 'Mark for review'}
            </button>
            {selected !== undefined && (
              <button type="button" className="er-exam-ghost" onClick={clearAnswer}>
                <Eraser size={15} /> Clear answer
              </button>
            )}
            {isLastQuestion ? (
              <button type="button" className="er-exam-next er-exam-submit-primary" onClick={handlePrimaryAction}>
                Submit Examination <Send size={15} />
              </button>
            ) : (
              <button type="button" className="er-exam-next" onClick={handlePrimaryAction}>
                Next <ArrowRight size={15} />
              </button>
            )}
          </div>

          {actionError && <div className="hub-form-error" role="alert">{actionError}</div>}
        </div>
          <aside id="er-exam-question-navigator" className={paletteOpen ? 'er-exam-palette is-open' : 'er-exam-palette'} aria-label="Question navigator">
            <div className="er-exam-palette-head">
              <strong>Question navigator</strong>
              <button type="button" className="er-exam-palette-close" onClick={() => setPaletteOpen(false)} aria-label="Close navigator"><X size={16} /></button>
            </div>
            <p className="er-exam-palette-legend">
              <span className="is-answered">{answeredCount} answered</span>
              <span className="is-unanswered">{questions.length - answeredCount} unanswered</span>
              {markedCount > 0 && <span className="is-marked">{markedCount} marked</span>}
            </p>
            {bySubject.map(([subject, list]) => (
              <div key={subject} className="er-exam-palette-group">
                <h3>{subject}</h3>
                <div className="er-exam-palette-grid">
                  {list.map((item) => {
                    const position = item.position;
                    const isAnswered = answers[position] !== undefined;
                    const isMarkedItem = Boolean(marked[position]);
                    const isCurrent = item.position === question?.position;
                    const classes = ['er-exam-palette-cell'];
                    if (isAnswered) classes.push('is-answered');
                    else classes.push('is-unanswered');
                    if (isMarkedItem) classes.push('is-marked');
                    if (isCurrent) classes.push('is-current');
                    return (
                      <button
                        key={position}
                        type="button"
                        className={classes.join(' ')}
                        aria-current={isCurrent ? 'true' : undefined}
                        aria-label={'Question ' + (questions.indexOf(item) + 1) + ', ' + subject + ', ' + (isAnswered ? 'answered' : 'unanswered') + (isMarkedItem ? ', marked for review' : '')}
                        onClick={() => { goTo(questions.indexOf(item)); setPaletteOpen(false); }}
                      >
                        {questions.indexOf(item) + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button type="button" className="hub-primary-btn er-exam-palette-submit" onClick={() => { setPaletteOpen(false); setConfirmKind('submit'); }}>
              <Send size={15} /> Submit paper
            </button>
          </aside>
        </div>
      </main>

      {/* Unanswered questions warning: return or submit anyway. */}
      <dialog
        ref={unansweredDialog}
        className="er-confirm"
        onClose={() => setConfirmKind((current) => current === 'unanswered' ? null : current)}
        aria-labelledby="er-unanswered-title"
      >
        <div className="er-confirm-body">
          <h2 id="er-unanswered-title">You have {unansweredCount} unanswered question{unansweredCount === 1 ? '' : 's'}</h2>
          <p>
            You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
            Unanswered questions score zero.
          </p>
          <div className="er-confirm-actions">
            <button
              type="button"
              className="hub-outline-btn"
              onClick={() => { setConfirmKind(null); unansweredDialog.current?.close(); }}
            >
              Return to questions
            </button>
            <button
              type="button"
              className="hub-primary-btn"
              onClick={() => {
                setConfirmKind(null);
                unansweredDialog.current?.close();
                setConfirmKind('submit');
              }}
            >
              Submit anyway
            </button>
          </div>
        </div>
      </dialog>

      {/* Final submit confirmation: concise, states what happens next. */}
      <dialog
        ref={submitDialog}
        className="er-confirm"
        onClose={() => setConfirmKind((current) => current === 'submit' ? null : current)}
        aria-labelledby="er-submit-title"
      >
        <div className="er-confirm-body">
          <h2 id="er-submit-title">Submit examination?</h2>
          <p>
            You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
          </p>
          <p>
            Once submitted, you cannot return to this examination.
            {unansweredCount > 0 && <> Unanswered questions will score zero.</>}
          </p>
          <div className="er-confirm-actions">
            <button type="button" className="hub-outline-btn" onClick={() => { setConfirmKind(null); submitDialog.current?.close(); }}>Cancel</button>
            <button
              type="button"
              className="hub-primary-btn"
              disabled={submitting}
              onClick={() => { setConfirmKind(null); submitDialog.current?.close(); void submit('manual'); }}
            >
              {submitting ? 'Submitting…' : 'Submit Examination'}
            </button>
          </div>
        </div>
      </dialog>

      {/* End Test: distinct from Submit, and explicit about what is kept. */}
      <dialog ref={endDialog} className="er-confirm" onClose={() => setConfirmKind((current) => current === 'end' ? null : current)} aria-labelledby="er-end-title">
        <div className="er-confirm-body">
          <h2 id="er-end-title">End this test now?</h2>
          <p>
            Ending leaves the examination without scoring it. {answeredCount > 0
              ? `${answeredCount} question${answeredCount === 1 ? '' : 's'} answered. Changes that have not been saved may be lost.`
              : 'Nothing has been answered yet.'}
          </p>
          <p>
            {attempt.mode === 'practice'
              ? 'This is a practice session: it will appear in your practice history where you can restart it or delete it.'
              : 'This is a mock examination: it will be recorded as ended, and a fresh mock can be started from the CBT Centre.'}
          </p>
          <div className="er-confirm-actions">
            <button type="button" className="hub-outline-btn" onClick={() => { setConfirmKind(null); endDialog.current?.close(); }}>Continue the test</button>
            <button
              type="button"
              className="er-danger-btn"
              disabled={submitting}
              onClick={() => { setConfirmKind(null); endDialog.current?.close(); void endTest(); }}
            >
              End test without submitting
            </button>
          </div>
        </div>
      </dialog>

      {calcOpen && <ScientificCalculator onClose={() => setCalcOpen(false)} />}
    </div>
  );
}
