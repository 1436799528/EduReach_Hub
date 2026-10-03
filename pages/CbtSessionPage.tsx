import {
  AlertTriangle, ArrowLeft, ArrowRight, Calculator, CheckCircle2, Clock3, Eraser,
  Flag, Grid3X3, Loader2, LogOut, Send, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScientificCalculator from '../src/components/ScientificCalculator';
import ConnectionBanner from '../src/components/ConnectionBanner';
import { ErrorState } from '../src/components/AsyncState';
import {
  abandonConfiguredCbt, fetchCbtAttemptPaper, saveConfiguredCbtDraft, submitConfiguredCbt,
  type CbtAttemptPayload, type CbtQuestionPayload,
} from '../src/lib/api';
import { userFacingError } from '../lib/errors';
import { classifyFailure } from '../src/lib/failures';

/**
 * CBT-3 — the examination hall.
 *
 * This is a dedicated shell on purpose: no site header, no footer, no navigation
 * away. The student sees one paper, one timer and two deliberate exits:
 *
 *   Submit  — ends the examination, scores the paper and shows the result.
 *   End Test — leaves the examination; the paper is closed, not scored.
 *
 * The countdown is driven by the server's `expiresAt` (offset against the
 * server's own clock so a device with the wrong time cannot change it), the
 * paper is the frozen one the server planned, and answers are saved as they are
 * chosen — including retrying after a connection drop.
 */

function navigateInApp(path: string, replace = false) {
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

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

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'pending' | 'error';

export default function CbtSessionPage({ attemptId }: { attemptId: string }) {
  const [attempt, setAttempt] = useState<CbtAttemptPayload | null>(null);
  const [questions, setQuestions] = useState<CbtQuestionPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [index, setIndex] = useState(0);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [closed, setClosed] = useState<'expired' | 'submitted' | 'cancelled' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'submit' | 'end' | null>(null);

  const submitDialog = useRef<HTMLDialogElement | null>(null);
  const endDialog = useRef<HTMLDialogElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswers = useRef<Record<number, number> | null>(null);
  const autoSubmitStarted = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const payload = await fetchCbtAttemptPaper(attemptId);
      setAttempt(payload.attempt);
      setQuestions(payload.questions);
      setClockOffsetMs(Date.parse(payload.serverTime) - Date.now());
      // The server's saved draft wins only where the student has not typed
      // something newer; the local pending draft is always the newest.
      const pending = readPending(attemptId) || {};
      setAnswers({ ...(payload.attempt.savedAnswers || {}), ...Object.fromEntries(Object.entries(pending).map(([key, value]) => [Number(key), value])) });
      setIndex(Math.max(0, Math.min(payload.attempt.questionIndex || 0, Math.max(0, payload.questions.length - 1))));
      if (payload.attempt.status !== 'in_progress') setClosed(payload.attempt.status);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    document.body.classList.add('er-exam-shell');
    return () => { document.body.classList.remove('er-exam-shell'); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const expiresAt = attempt?.expiresAt ? Date.parse(attempt.expiresAt) : null;
  const remainingSeconds = expiresAt === null ? 0 : Math.max(0, Math.floor((expiresAt - (now + clockOffsetMs)) / 1000));
  const totalSeconds = (attempt?.durationMinutes || 0) * 60;

  /** Save the current answers, retrying once the connection returns. */
  const flush = useCallback(async (nextAnswers: Record<number, number>, nextIndex: number) => {
    pendingAnswers.current = nextAnswers;
    writePending(attemptId, nextAnswers);
    setSaveState('saving');
    try {
      await saveConfiguredCbtDraft(attemptId, nextAnswers, nextIndex);
      pendingAnswers.current = null;
      writePending(attemptId, null);
      setSaveState('saved');
    } catch (error) {
      const failure = classifyFailure(error);
      if (failure.kind === 'offline' || failure.kind === 'timeout' || failure.kind === 'server') {
        // Keep the work locally; the online event below retries it.
        setSaveState('pending');
      } else if (failure.kind === 'auth') {
        setSaveState('error');
        setActionError('Your session ended. Sign in again in this tab to keep saving — your answers are still on this device.');
      } else {
        setSaveState('error');
      }
    }
  }, [attemptId]);

  const scheduleSave = useCallback((nextAnswers: Record<number, number>, nextIndex: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flush(nextAnswers, nextIndex); }, 900);
  }, [flush]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  useEffect(() => {
    const retry = () => { if (pendingAnswers.current) void flush(pendingAnswers.current, index); };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [flush, index]);

  useEffect(() => {
    const onHide = () => { if (pendingAnswers.current) void flush(pendingAnswers.current, index); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush, index]);

  const currentSubject = questions[index]?.subject || attempt?.subjects[0] || '';
  const subjectPlan = attempt?.plan || [];
  const answeredCount = Object.keys(answers).length;
  const markedCount = Object.values(marked).filter(Boolean).length;

  const submit = useCallback(async (reason: 'manual' | 'timer') => {
    if (submitting || !attempt || closed === 'submitted') return;
    setSubmitting(true);
    setActionError('');
    try {
      await submitConfiguredCbt(attempt.id, answers);
      setClosed('submitted');
      navigateInApp(`/cbt/results/${encodeURIComponent(attempt.id)}`, true);
    } catch (error) {
      const failure = classifyFailure(error);
      if (failure.kind === 'not-found' || /expired/i.test(String((error as Error)?.message || ''))) {
        setClosed('expired');
        setActionError(reason === 'timer'
          ? 'Time is up. The examination was closed and nothing was submitted.'
          : 'This attempt had already expired, so nothing was submitted.');
      } else if (failure.kind === 'offline' || failure.kind === 'timeout' || failure.kind === 'server') {
        setActionError('Your submission did not reach EduReach. Your answers are saved on this device — check your connection and press Submit again.');
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
    setSubmitting(true);
    setActionError('');
    try {
      if (pendingAnswers.current) writePending(attemptId, pendingAnswers.current);
      await abandonConfiguredCbt(attemptId);
      setClosed('cancelled');
      navigateInApp(attempt?.mode === 'practice' ? '/cbt?ended=practice' : '/cbt?ended=mock', true);
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
      scheduleSave(next, index);
      return next;
    });
  }, [closed, index, questions, scheduleSave]);

  const clearAnswer = useCallback(() => {
    if (closed) return;
    setAnswers((current) => {
      const next = { ...current };
      delete next[questions[index].position];
      scheduleSave(next, index);
      return next;
    });
  }, [closed, index, questions, scheduleSave]);

  const goTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    setIndex(nextIndex);
    if (pendingAnswers.current) void flush(pendingAnswers.current, nextIndex);
    else if (attempt) void saveConfiguredCbtDraft(attemptId, answers, nextIndex).catch(() => undefined);
  }, [answers, attempt, attemptId, flush, questions.length]);

  // Keyboard: 1–4 / A–D choose, arrows move, M marks. Never while a dialog is open.
  useEffect(() => {
    if (confirmKind) return;
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
  }, [choose, confirmKind, goTo, index, questions]);

  useEffect(() => {
    if (confirmKind === 'submit' && submitDialog.current && !submitDialog.current.open) submitDialog.current.showModal();
    if (confirmKind === 'end' && endDialog.current && !endDialog.current.open) endDialog.current.showModal();
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

  if (loading) {
    return (
      <div className="er-exam-shell">
        <ConnectionBanner />
        <div className="er-exam-loading" role="status">
          <Loader2 className="er-spin" size={22} aria-hidden="true" />
          <span>Preparing your paper…</span>
        </div>
      </div>
    );
  }

  if (loadError || !attempt) {
    return (
      <div className="er-exam-shell">
        <ConnectionBanner />
        <div className="er-exam-centred">
          <ErrorState
            error={loadError}
            onRetry={() => void load()}
            action={<a className="hub-outline-btn" href="/cbt">Back to the CBT Centre</a>}
          />
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

  return (
    <div className="er-exam-shell">
      <ConnectionBanner />

      <header className="er-exam-bar">
        <div className="er-exam-bar-left">
          <img src="/icons/logo.png" alt="EduReach" width={26} height={26} loading="lazy" fetchPriority="low" />
          <div>
            <strong>{attempt.exam.title}</strong>
            <span>
              {attempt.mode === 'mock' ? 'Mock examination' : 'Practice'}
              {attempt.programme ? ` · ${attempt.programme}` : ''}
              {' · '}
              {questions.length} question{questions.length === 1 ? '' : 's'}
              {' · '}
              {attempt.durationMinutes ? `${attempt.durationMinutes} minutes` : 'untimed'}
            </span>
          </div>
        </div>

        <div className="er-exam-timer" role="timer" aria-live="off">
          <Clock3 size={15} aria-hidden="true" />
          <b className={timeAlmostUp ? 'is-critical' : ''}>{formatClock(remainingSeconds)}</b>
          <span>remaining</span>
          <i className="er-exam-timer-track" aria-hidden="true"><span style={{ width: `${progressPercent}%` }} /></i>
        </div>

        <div className="er-exam-bar-actions">
          <button type="button" className="er-exam-ghost" onClick={() => setCalcOpen(true)}>
            <Calculator size={15} /> <span>Calculator</span>
          </button>
          <button type="button" className="er-exam-ghost" onClick={() => setPaletteOpen(true)}>
            <Grid3X3 size={15} /> <span>Questions</span>
          </button>
          <button type="button" className="er-exam-end" onClick={() => setConfirmKind('end')}>
            <LogOut size={15} /> <span>End Test</span>
          </button>
          <button type="button" className="er-exam-submit" onClick={() => setConfirmKind('submit')}>
            <Send size={15} /> Submit
          </button>
        </div>
      </header>

      <main className="er-exam-main">
        <div className="er-exam-paper">
          <div className="er-exam-question-head">
            <span className="er-exam-subject-pill">{question?.subject}</span>
            <span className="er-exam-position">
              Question {index + 1} of {questions.length}
              {subjectPlan.length > 1 && (() => {
                const entry = subjectPlan.find((plan) => question?.position >= plan.first && question?.position <= plan.last);
                return entry ? <em> · {entry.subject} {question.position - entry.first + 1} of {entry.questions}</em> : null;
              })()}
            </span>
            <span className="er-exam-save-state" role="status">
              {saveState === 'saving' && <><Loader2 className="er-spin" size={13} /> saving…</>}
              {saveState === 'saved' && <><CheckCircle2 size={13} /> saved</>}
              {saveState === 'pending' && <><AlertTriangle size={13} /> saved on this device — will sync</>}
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
            <button type="button" className="er-exam-next" onClick={() => goTo(index + 1)} disabled={index === questions.length - 1}>
              Next <ArrowRight size={15} />
            </button>
          </div>

          {subjectPlan.length > 1 && (
            <div className="er-exam-subject-rail" aria-label="Paper structure">
              {subjectPlan.map((entry) => {
                const answeredInBlock = Object.keys(answers).filter((position) => Number(position) >= entry.first && Number(position) <= entry.last).length;
                const current = question?.position >= entry.first && question?.position <= entry.last;
                return (
                  <button
                    key={entry.subject}
                    type="button"
                    className={current ? 'er-exam-subject-block is-current' : 'er-exam-subject-block'}
                    onClick={() => goTo(entry.first - 1)}
                  >
                    <strong>{entry.subject}</strong>
                    <span>{answeredInBlock} of {entry.questions} answered</span>
                  </button>
                );
              })}
            </div>
          )}

          {actionError && <div className="hub-form-error" role="alert">{actionError}</div>}
        </div>

        {paletteOpen && (
          <div className="er-exam-palette" role="dialog" aria-label="Question navigator">
            <div className="er-exam-palette-head">
              <strong>Question navigator</strong>
              <button type="button" onClick={() => setPaletteOpen(false)} aria-label="Close navigator"><X size={16} /></button>
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
                        aria-label={`Question ${questions.indexOf(item) + 1}, ${subject}, ${isAnswered ? 'answered' : 'unanswered'}${isMarkedItem ? ', marked for review' : ''}`}
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
          </div>
        )}
      </main>

      {/* Submit confirmation: what is answered, what is not, and what happens next. */}
      <dialog
        ref={submitDialog}
        className="er-confirm"
        onClose={() => setConfirmKind(null)}
        aria-labelledby="er-submit-title"
      >
        <div className="er-confirm-body">
          <h2 id="er-submit-title">Submit this paper?</h2>
          <p>
            <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions answered
            {questions.length - answeredCount > 0 && <> · <strong>{questions.length - answeredCount}</strong> left unanswered</>}
            {markedCount > 0 && <> · <strong>{markedCount}</strong> marked for review</>}
            . Time remaining: <strong>{formatClock(remainingSeconds)}</strong>.
          </p>
          <p>
            Submitting scores the paper and closes the session — you cannot change an answer afterwards.
            {questions.length - answeredCount > 0 && ' Unanswered questions score zero.'}
          </p>
          <div className="er-confirm-actions">
            <button type="button" className="hub-outline-btn" onClick={() => { setConfirmKind(null); submitDialog.current?.close(); }}>Keep working</button>
            <button
              type="button"
              className="hub-primary-btn"
              disabled={submitting}
              onClick={() => { setConfirmKind(null); submitDialog.current?.close(); void submit('manual'); }}
            >
              {submitting ? 'Submitting…' : 'Submit and see result'}
            </button>
          </div>
        </div>
      </dialog>

      {/* End Test: distinct from Submit, and explicit about what is kept. */}
      <dialog ref={endDialog} className="er-confirm" onClose={() => setConfirmKind(null)} aria-labelledby="er-end-title">
        <div className="er-confirm-body">
          <h2 id="er-end-title">End this test now?</h2>
          <p>
            Ending leaves the examination without scoring it. {answeredCount > 0
              ? `${answeredCount} saved answer${answeredCount === 1 ? '' : 's'} stay with the session.`
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
