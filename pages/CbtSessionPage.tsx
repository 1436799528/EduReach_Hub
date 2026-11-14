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
import { useCbtPageWriter } from '../src/lib/useCbtPageWriter';
import { inspectCbtAnswerJournal, validateCbtJournalPaper } from '../src/lib/cbtAnswerQueue';
import { CBT_UUID } from '../src/lib/cbtProtocolValidation';
import './CbtSessionPage.css';

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

/**
 * UX-6: a flag is review intent, not an answer. The server protocol does not
 * carry flag state, so it is kept per attempt in this browser. It never
 * changes scoring or submission and disappears with the attempt's local data.
 */
function readFlags(attemptId: string): Record<number, boolean> | null {
  try {
    const raw = localStorage.getItem(`edureach-cbt-flags:${attemptId}`);
    return raw ? JSON.parse(raw) as Record<number, boolean> : null;
  } catch {
    return null;
  }
}

function writeFlags(attemptId: string, flags: Record<number, boolean>) {
  try {
    localStorage.setItem(`edureach-cbt-flags:${attemptId}`, JSON.stringify(flags));
  } catch {
    // Flagging still works for this page view when storage is unavailable.
  }
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
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [v2Paper, setV2Paper] = useState<CbtQuestionPayload[] | null>(null);
  const [v2Owner, setV2Owner] = useState<string | null>(null);
  const writer = useCbtPageWriter(user?.id?.toLowerCase() === v2Owner ? user.id : undefined, attemptId, v2Paper);
  const visibleAnswers = v2Paper ? writer.answers : answers;
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
  const sessionActionInFlight = useRef(false);
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
    setV2Paper(null);
    setV2Owner(null);
    try {
      const payload = await fetchCbtAttemptPaper(attemptId);
      if (generation !== loadGeneration.current) return;
      if (payload.protocol.version === 2) {
        const accountId = currentAccount.current;
        if (!accountId || !CBT_UUID.test(accountId) || !CBT_UUID.test(attemptId) || typeof payload.attempt?.id !== 'string' || payload.attempt.id.toLowerCase() !== attemptId.toLowerCase()) throw new CbtProtocolUnavailableError();
        const state = await fetchCbtV2State(attemptId);
        const operations = await inspectCbtAnswerJournal({ accountId, attemptId }).catch(() => { throw new CbtJournalStorageError(); });
        if (generation !== loadGeneration.current) return;
        if (accountId !== currentAccount.current) throw new CbtProtocolUnavailableError();
        try {
          validateCbtJournalPaper(state, payload.questions, operations);
          if (payload.attempt.status !== state.status || !Number.isFinite(Date.parse(payload.serverTime)) ||
              (payload.attempt.expiresAt && !Number.isFinite(Date.parse(payload.attempt.expiresAt)))) throw new Error('Invalid CBT timing or status.');
        } catch { throw new CbtProtocolUnavailableError(); }
        setV2Owner(accountId.toLowerCase());
        setAttempt(payload.attempt);
        setQuestions(payload.questions);
        setClockOffsetMs(Date.parse(payload.serverTime) - Date.now());
        setMarked(readFlags(attemptId) ?? {});
        setIndex(Math.max(0, Math.min(payload.attempt.questionIndex || 0, Math.max(0, payload.questions.length - 1))));
        setV2Paper(payload.questions);
        return;
      }
      legacyProtocol.current = true;
      setAttempt(payload.attempt);
      setQuestions(payload.questions);
      setClockOffsetMs(Date.parse(payload.serverTime) - Date.now());
      setMarked(readFlags(attemptId) ?? {});
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
  const answeredCount = questions.filter((item) => visibleAnswers[item.position] !== undefined).length;
  const markedCount = questions.filter((item) => Boolean(marked[item.position])).length;
  const answeredAndMarkedCount = questions.filter((item) => visibleAnswers[item.position] !== undefined && Boolean(marked[item.position])).length;

  const submit = useCallback(async (reason: 'manual' | 'timer') => {
    if (submitting) return;
    if (sessionActionInFlight.current || !attempt || closed === 'submitted') return;
    if (!legacyProtocol.current && !v2Paper) return;
    sessionActionInFlight.current = true;
    setSubmitting(true);
    setActionError('');
    try {
      if (v2Paper) {
        // v2 submissions use the leased, revision-checked finalization
        // gateway. The server alone confirms that the paper was submitted.
        const outcome = await writer.finalize();
        if (outcome.outcome === 'submitted' || outcome.outcome === 'replayed' || outcome.outcome === 'already_submitted') {
          trackEvent('cbt_submit', { metadata: { examId: attempt.examId } });
          setClosed('submitted');
          navigateInApp(`/cbt/results/${encodeURIComponent(attempt.id)}`, { replace: true });
          return;
        }
        if (outcome.outcome === 'expired') {
          setClosed('expired');
          setActionError(reason === 'timer'
            ? 'Time is up. The server did not confirm a submission, so nothing was submitted.'
            : outcome.message);
          return;
        }
        if (outcome.outcome === 'closed') {
          setClosed('expired');
          setActionError(outcome.message);
          return;
        }
        setActionError(outcome.message);
        return;
      }
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
      sessionActionInFlight.current = false;
      setSubmitting(false);
    }
  }, [answers, attempt, closed, submitting, v2Paper, writer]);

  // Time expired: stop the session exactly once, and never show negative time.
  useEffect(() => {
    if (!attempt || closed || loading) return;
    if (expiresAt !== null && remainingSeconds === 0 && !autoSubmitStarted.current) {
      autoSubmitStarted.current = true;
      void submit('timer');
    }
  }, [attempt, closed, expiresAt, loading, remainingSeconds, submit]);

  const endTest = useCallback(async () => {
    if (sessionActionInFlight.current) return;
    if (!legacyProtocol.current) return;
    sessionActionInFlight.current = true;
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
      sessionActionInFlight.current = false;
      setSubmitting(false);
    }
  }, [attempt?.mode, attemptId]);

  const choose = useCallback((optionIndex: number) => {
    if (closed) return;
    if (v2Paper) { if ((expiresAt === null || remainingSeconds > 0) && questions[index]) void writer.choose(questions[index], optionIndex); return; }
    if (!legacyProtocol.current) return;
    setAnswers((current) => {
      const next = { ...current, [questions[index].position]: optionIndex };
      queueSave(next, index);
      return next;
    });
  }, [closed, expiresAt, index, questions, queueSave, remainingSeconds, v2Paper, writer]);

  const clearAnswer = useCallback(() => {
    if (closed) return;
    if (v2Paper) { if ((expiresAt === null || remainingSeconds > 0) && questions[index]) void writer.choose(questions[index], null); return; }
    if (!legacyProtocol.current) return;
    setAnswers((current) => {
      const next = { ...current };
      delete next[questions[index].position];
      queueSave(next, index);
      return next;
    });
  }, [closed, expiresAt, index, questions, queueSave, remainingSeconds, v2Paper, writer]);

  const goTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    setIndex(nextIndex);
    if (attempt) queueSave(pendingAnswers.current || answers, nextIndex, true);
  }, [answers, attempt, queueSave, questions.length]);

  const toggleMark = useCallback((position: number) => {
    setMarked((current) => {
      const next = { ...current, [position]: !current[position] };
      writeFlags(attemptId, next);
      return next;
    });
  }, [attemptId]);

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
      else if (event.key.toLowerCase() === 'm') toggleMark(questions[index].position);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attempt, choose, confirmKind, goTo, index, loadError, loading, questions, toggleMark]);

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

  if (v2Paper && user?.id?.toLowerCase() !== v2Owner) {
    return <div className="er-exam-shell"><div className="er-exam-centred" role="alert">The signed-in account changed. Reopen the attempt with the original account; local work is preserved.</div></div>;
  }

  if (loadError || !attempt) {
    return (
      <div className="er-exam-shell">
        <ConnectionBanner />
        <div className="er-exam-centred">
          {loadError instanceof CbtProtocolUnavailableError ? (
            <div className="er-state er-state-error" role="alert">
              <div><strong>This CBT session cannot be opened safely</strong><p>{loadError instanceof CbtJournalStorageError ? 'Browser storage is unavailable or requires review.' : 'The session protocol is unavailable.'} Keep local work and contact EduReach.</p></div>
              <a className="hub-outline-btn" href="/cbt">Back to the CBT Centre</a>
            </div>
          ) : (
            <ErrorState error={loadError} onRetry={() => void load()} action={<a className="hub-outline-btn" href="/cbt">Back to the CBT Centre</a>} />
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
  const selected = visibleAnswers[question?.position];
  const isMarked = Boolean(marked[question?.position]);
  const timeAlmostUp = remainingSeconds <= 300;
  const progressPercent = totalSeconds ? Math.min(100, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0;
  const isLastQuestion = index === questions.length - 1;
  const unansweredCount = questions.length - answeredCount;
  const v2Blocked = Boolean(v2Paper && (writer.phase !== 'active' || writer.busy || (expiresAt !== null && remainingSeconds <= 0) || writer.rows.some(row => ['pending', 'conflicted', 'closed'].includes(row.status))));
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
          <div className="er-exam-candidate" aria-label={`Candidate ${studentDisplayName}, ${attempt.mode === 'mock' ? 'mock examination' : 'practice'}${attempt.programme ? `, ${attempt.programme}` : ''}`}>
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
          <div className="er-exam-timer" role="timer" aria-live="off" aria-label={`${formatClock(remainingSeconds)} remaining`}>
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
          <button type="button" className="er-exam-end" style={{ backgroundColor: '#B14933', color: '#ffffff', border: '2px solid #8f3727', boxShadow: '0 2px 8px rgba(0,0,0,0.22)', minHeight: 40, padding: '8px 14px', borderRadius: 8 }} onClick={() => setConfirmKind('end')} disabled={Boolean(v2Paper)} aria-label="End test" title={v2Paper ? 'Ending without submitting is unavailable for this attempt' : undefined}>
            <LogOut size={15} /> <span className="er-exam-tool-label">End Test</span>
          </button>
        </div>
      </header>

      <main className="er-exam-main">
        {recoveryNotice && !v2Paper && <p className="hub-form-error" role="note">{recoveryNotice}</p>}
        {v2Paper && <section aria-label="Writing session and recovery" className="hub-form-error">
          <p role="status">{writer.phase === 'loading' ? 'Confirming writing session…' : writer.phase === 'active' ? 'Writing session confirmed by the server.' : 'Writing is paused.'} {writer.message}</p>
          <p>Submit when the writing session is confirmed and every answer is saved. Ending this attempt without submitting is unavailable. Work on another disconnected device cannot be discovered here.</p>
          {writer.phase !== 'active' && writer.hasSnapshot && <section aria-label="Read-only recovery preview">
            <h2>Read-only recovery preview</h2>
            <p>These are the last confirmed server answers, not confirmation that pending local work is saved. Review unsaved answers separately below.</p>
            <ol>{questions.map(item => <li key={item.id}>{item.text}: {visibleAnswers[item.position] === undefined ? 'No answer' : item.options[visibleAnswers[item.position]]}</li>)}</ol>
          </section>}
          {expiresAt !== null && remainingSeconds <= 0 && <p>Time has expired; no further answers can be entered. Pending work remains in this browser.</p>}
          {writer.phase !== 'expired' && <button type="button" className="hub-outline-btn" disabled={writer.busy || writer.phase === 'loading'} onClick={() => { if (window.confirm('Take over writing on this tab? Any other active writer will be revoked. Unsaved work on other devices must be reviewed separately.')) void writer.takeover(); }}>Take over writing</button>}
          {(writer.phase === 'error' || (writer.phase === 'active' && writer.rows.some(row => row.status === 'pending'))) && <button type="button" className="hub-outline-btn" disabled={writer.busy} onClick={() => writer.phase === 'error' ? void load() : void writer.retry()}>Retry connection</button>}
          {writer.rows.filter(row => row.status === 'pending' || row.status === 'conflicted' || row.status === 'closed').map(row => {
            const item = questions[row.position - 1];
            const label = (value: number | null) => value === null ? 'No answer' : item?.options[value] ?? 'Unavailable';
            return <div key={row.operationKey}>
              <p>Question {row.position}: local answer {label(row.selected)} — {row.status === 'pending' ? 'not confirmed saved; review required if the session changed' : row.status === 'closed' ? 'attempt closed; not saved' : `server answer ${label(row.lastServerAnswer)} (revision ${row.lastServerRevision})`}.</p>
              {row.status === 'pending' && writer.phase === 'active' && <button type="button" className="hub-outline-btn" disabled={writer.busy} onClick={() => void writer.review(row.operationKey)}>Review this pending answer</button>}
              {row.status === 'conflicted' && writer.phase === 'active' && <>
                <button type="button" className="hub-outline-btn" disabled={writer.busy} onClick={() => void writer.resolve(row, 'server')}>Keep server answer</button>
                <button type="button" className="hub-outline-btn" disabled={writer.busy} onClick={() => void writer.resolve(row, 'local')}>Apply my local answer</button>
              </>}
            </div>;
          })}
        </section>}

        {subjectPlan.length > 1 && (
          <div className="er-exam-subject-tabs" role="tablist" aria-label="Exam subjects">
            {subjectPlan.map((entry) => {
              const answeredInBlock = questions.filter((item) =>
                item.position >= entry.first && item.position <= entry.last && visibleAnswers[item.position] !== undefined
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
              {v2Paper ? (writer.busy ? 'saving…' : writer.rows.some(row => row.status === 'conflicted') ? 'review required' : writer.rows.some(row => row.status === 'pending' || row.status === 'closed') ? 'not yet saved' : writer.phase === 'active' ? 'saved' : 'writing paused') : <>
                {saveState === 'saving' && <><WaveLoader variant="inline" decorative /> saving…</>}
                {saveState === 'saved' && <><CheckCircle2 size={13} /> saved</>}
                {saveState === 'pending' && <><AlertTriangle size={13} /> not yet saved; keep this page open</>}
                {saveState === 'error' && <><AlertTriangle size={13} /> not saved</>}
              </>}
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
                    disabled={v2Blocked}
                    className={isSelected ? 'er-exam-option is-selected' : 'er-exam-option'}
                    onClick={() => choose(optionIndex)}
                  >
                    <span className="er-exam-option-letter">{letter}</span>
                    <span className="er-exam-option-text">{option}</span>
                    {isSelected && <CheckCircle2 size={16} className="er-exam-option-check" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </article>

          <div className="er-exam-question-actions">
            <button
              type="button"
              className="er-exam-ghost"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label={index === 0 ? 'Previous question — you are on the first question' : 'Previous question'}
              title={index === 0 ? 'You are on the first question' : undefined}
            >
              <ArrowLeft size={15} /> Previous
            </button>
            <button
              type="button"
              className={isMarked ? 'er-exam-mark is-on' : 'er-exam-mark'}
              aria-pressed={isMarked}
              onClick={() => toggleMark(question.position)}
            >
              <Flag size={15} /> {isMarked ? 'Marked for review' : 'Mark for review'}
            </button>
            {selected !== undefined && (
              <button type="button" className="er-exam-ghost" onClick={clearAnswer} disabled={v2Blocked}>
                <Eraser size={15} /> Clear answer
              </button>
            )}
            {isLastQuestion ? (
              <button type="button" className="er-exam-next er-exam-submit-primary" disabled={v2Blocked || submitting} title={v2Blocked ? 'Submit after every answer is saved and the writing session is active.' : undefined} onClick={handlePrimaryAction}>
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
              {answeredAndMarkedCount > 0 && <span className="is-both">{answeredAndMarkedCount} answered + marked</span>}
            </p>
            {bySubject.map(([subject, list]) => (
              <div key={subject} className="er-exam-palette-group">
                <h3>{subject}</h3>
                <div className="er-exam-palette-grid">
                  {list.map((item) => {
                    const position = item.position;
                    const isAnswered = visibleAnswers[position] !== undefined;
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
            <button type="button" className="hub-primary-btn er-exam-palette-submit" disabled={v2Blocked || submitting} title={v2Blocked ? 'Submit after every answer is saved and the writing session is active.' : undefined} onClick={() => { setPaletteOpen(false); setConfirmKind('submit'); }}>
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
            {markedCount > 0 && <> <strong>{markedCount}</strong> question{markedCount === 1 ? '' : 's'} marked for review.</>}
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
            {markedCount > 0 && <> <strong>{markedCount}</strong> marked for review.</>}
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
              disabled={submitting || v2Blocked}
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
