import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  HelpCircle,
  Send,
  TimerReset,
  Wifi,
  WifiOff,
} from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { fetchCbtQuestions, startCbt, submitCbt } from '../src/lib/api';
import { getExamProgress, saveExamProgress, queueOfflineSubmission, syncPendingSubmissions } from '../src/lib/cbt-offline';

type Question = { id: number; text: string; options: string[] };

export default function CbtPracticePage() {
  const urlParam = new URLSearchParams(window.location.search).get('exam');
  const examId = urlParam || 'practice-exam-jamb';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [examTitle, setExamTitle] = useState('JAMB UTME Comprehensive Practice');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flags, setFlags] = useState<Record<number, boolean>>({});
  const [seconds, setSeconds] = useState(1800);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [attemptId, setAttemptId] = useState('');
  const [restored, setRestored] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const question = questions[index];

  useEffect(() => {
    let active = true;
    async function loadExam() {
      try {
        const data = await fetchCbtQuestions(examId);
        if (!active) return;
        setQuestions(data.questions);
        setDurationMinutes(data.exam.durationMinutes || 30);
        setExamTitle(data.exam.title || 'JAMB UTME Comprehensive Practice');

        const saved = await getExamProgress(examId).catch(() => null);
        if (saved && active) {
          setAnswers(saved.answers);
          setFlags(saved.flags);
          setSeconds(saved.timeRemainingSeconds);
        } else {
          setSeconds((data.exam.durationMinutes || 30) * 60);
        }

        const storageKey = `edureach-cbt-attempt-${examId}`;
        const stored = JSON.parse(localStorage.getItem(storageKey) || 'null') as { attemptId?: string; expiresAt?: string } | null;
        if (stored?.attemptId && stored.expiresAt && new Date(stored.expiresAt).getTime() > Date.now()) {
          setAttemptId(stored.attemptId);
          setSeconds(Math.max(0, Math.ceil((new Date(stored.expiresAt).getTime() - Date.now()) / 1000)));
        } else {
          const started = await startCbt(examId);
          if (!active) return;
          setAttemptId(started.attemptId);
          localStorage.setItem(storageKey, JSON.stringify({ attemptId: started.attemptId, expiresAt: started.expiresAt }));
          setSeconds(Math.max(0, Math.ceil((new Date(started.expiresAt).getTime() - Date.now()) / 1000)));
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load the CBT exam.');
      } finally {
        if (active) {
          setRestored(true);
          setLoading(false);
        }
      }
    }
    void loadExam();
    return () => { active = false; };
  }, [examId]);

  useEffect(() => {
    if (!restored || seconds <= 0 || !questions.length) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [restored, seconds, questions.length]);

  useEffect(() => {
    if (restored && questions.length && seconds === 0 && attemptId) {
      void handleDirectSubmit();
    }
  }, [restored, questions.length, seconds, attemptId]);

  // Keyboard shortcut listener for fast answering
  useEffect(() => {
    if (!question) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['a', 'b', 'c', 'd'].includes(key)) {
        const optionIndex = key.charCodeAt(0) - 97;
        setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }));
      }
      if (key === 'n' || key === 'arrowright') {
        setIndex((value) => Math.min(value + 1, questions.length - 1));
      }
      if (key === 'p' || key === 'arrowleft') {
        setIndex((value) => Math.max(value - 1, 0));
      }
      if (key === 'f') {
        setFlags((value) => ({ ...value, [question.id]: !value[question.id] }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [question, questions.length]);

  useEffect(() => {
    if (!restored || !questions.length) return;
    saveExamProgress({ examId, answers, flags, timeRemainingSeconds: seconds, lastUpdated: Date.now() }).catch(() => undefined);
  }, [answers, flags, seconds, restored, questions.length, examId]);

  async function handleDirectSubmit() {
    setSubmitting(true);
    setMessage('');
    const timeSpentSeconds = Math.max(0, durationMinutes * 60 - seconds);

    try {
      const activeAttemptId = attemptId || `local-att-${Date.now()}`;
      const result = await submitCbt({ examId, attemptId: activeAttemptId, answers });
      localStorage.setItem('edureach-last-cbt-attempt', result.attemptId);
      localStorage.removeItem(`edureach-cbt-attempt-${examId}`);
      window.history.pushState({}, '', `/dashboard/cbt/results?attempt=${encodeURIComponent(result.attemptId)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission failed. Your answers are saved locally.');
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  }

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const flaggedCount = useMemo(() => Object.values(flags).filter(Boolean).length, [flags]);
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  const isTimeCritical = seconds < 300; // < 5 minutes

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '20px 0 60px' }}>
        <div className="hub-container">
          {/* MYSCHOOL CBT EXAM CONTROL TOPBAR */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              background: '#0f172a',
              color: '#ffffff',
              padding: '14px 20px',
              borderRadius: '12px',
              marginBottom: '16px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={examId.includes('waec') ? '/icons/waec.svg' : examId.includes('neco') ? '/icons/neco.svg' : '/icons/jamb.svg'}
                alt="Exam Body"
                width={34}
                height={34}
                style={{ objectFit: 'contain' }}
              />
              <div>
                <strong style={{ fontSize: '15px', display: 'block', color: '#ffffff' }}>
                  {examTitle}
                </strong>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  EduReach Official CBT Classroom Simulator
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isTimeCritical ? '#dc2626' : '#1e293b',
                  border: `1px solid ${isTimeCritical ? '#ef4444' : '#334155'}`,
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  fontWeight: 900,
                  letterSpacing: '0.05em',
                  transition: 'background 0.3s ease',
                }}
              >
                <Clock size={16} />
                <span>{mins}:{secs}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                disabled={loading || !questions.length}
                style={{
                  background: '#D9381E',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Send size={14} /> Submit Test
              </button>
            </div>
          </div>

          {message && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px' }}>
              {message}
            </div>
          )}

          {loading ? (
            <div className="hub-panel hub-empty">Loading question bank…</div>
          ) : !question ? (
            <div className="hub-panel hub-empty">
              No questions found for this exam.
              <div style={{ marginTop: '12px' }}>
                <a className="hub-primary-btn" href="/cbt" style={{ textDecoration: 'none' }}>
                  Return to CBT Center
                </a>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 280px',
                gap: '18px',
                alignItems: 'start',
              }}
            >
              {/* QUESTION WORKSPACE */}
              <section
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '24px',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#D9381E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Question {index + 1} of {questions.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => setFlags((prev) => ({ ...prev, [question.id]: !prev[question.id] }))}
                    style={{
                      border: '1px solid',
                      borderColor: flags[question.id] ? '#fde68a' : '#e2e8f0',
                      background: flags[question.id] ? '#fffbeb' : '#f8fafc',
                      color: flags[question.id] ? '#b45309' : '#64748b',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Flag size={13} /> {flags[question.id] ? 'Flagged' : 'Flag Question'}
                  </button>
                </div>

                {/* QUESTION TEXT */}
                <h2
                  style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    color: '#0f172a',
                    lineHeight: 1.5,
                    margin: '0 0 20px',
                  }}
                >
                  {question.text}
                </h2>

                {/* OPTIONS (A, B, C, D) */}
                <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
                  {question.options.map((option, optIdx) => {
                    const isSelected = answers[question.id] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: optIdx }))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: '2px solid',
                          borderColor: isSelected ? '#D9381E' : '#e2e8f0',
                          background: isSelected ? '#FFF0E6' : '#ffffff',
                          color: '#0f172a',
                          textAlign: 'left',
                          fontSize: '14px',
                          fontWeight: isSelected ? 800 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '12px',
                            fontWeight: 900,
                            background: isSelected ? '#D9381E' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#475569',
                            flexShrink: 0,
                          }}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span style={{ flex: 1 }}>{option}</span>
                      </button>
                    );
                  })}
                </div>

                {/* NAVIGATION BUTTONS */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <button
                    type="button"
                    className="hub-outline-btn"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>

                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Tip: Press A, B, C, D to answer • N for next
                  </span>

                  <button
                    type="button"
                    className="hub-primary-btn"
                    style={{ background: '#2563eb' }}
                    disabled={index === questions.length - 1}
                    onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </section>

              {/* QUESTION PALETTE SIDEBAR */}
              <aside
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '18px',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>
                    QUESTION PALETTE
                  </span>
                  <h3 style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                    Jump to Question
                  </h3>
                </div>

                {/* 1-10 GRID */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '7px',
                    marginBottom: '16px',
                  }}
                >
                  {questions.map((q, qIdx) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const isFlagged = flags[q.id];
                    const isCurrent = index === qIdx;

                    let bg = '#f8fafc';
                    let color = '#475569';
                    let border = '1px solid #e2e8f0';

                    if (isAnswered) {
                      bg = '#ecfdf5';
                      color = '#047857';
                      border = '1px solid #a7f3d0';
                    }
                    if (isFlagged) {
                      bg = '#fffbeb';
                      color = '#b45309';
                      border = '1px solid #fde68a';
                    }
                    if (isCurrent) {
                      border = '2px solid #2563eb';
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setIndex(qIdx)}
                        style={{
                          height: '36px',
                          borderRadius: '8px',
                          border,
                          background: bg,
                          color,
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {qIdx + 1}
                      </button>
                    );
                  })}
                </div>

                {/* PALETTE LEGEND */}
                <div style={{ display: 'grid', gap: '6px', fontSize: '11px', color: '#64748b', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#059669' }} />
                    <span>Answered ({answeredCount})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d97706' }} />
                    <span>Flagged ({flaggedCount})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#cbd5e1' }} />
                    <span>Unanswered ({questions.length - answeredCount})</span>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* SUBMIT CONFIRMATION MODAL */}
          {showSubmitModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(3px)',
                display: 'grid',
                placeItems: 'center',
                padding: '20px',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  maxWidth: '440px',
                  width: '100%',
                  padding: '26px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
                }}
              >
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                  Are you ready to submit your exam?
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                  You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
                  {questions.length - answeredCount > 0 && (
                    <span style={{ color: '#b45309', display: 'block', marginTop: '6px' }}>
                      ⚠️ You still have {questions.length - answeredCount} unanswered question(s).
                    </span>
                  )}
                </p>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="hub-outline-btn"
                    onClick={() => setShowSubmitModal(false)}
                    disabled={submitting}
                  >
                    Continue Answering
                  </button>
                  <button
                    type="button"
                    className="hub-primary-btn"
                    style={{ background: '#D9381E' }}
                    onClick={() => void handleDirectSubmit()}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting…' : 'Yes, Submit Test'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
