import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flag, Send, TimerReset, WifiOff } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { fetchCbtQuestions, submitCbt } from '../src/lib/api';
import { getExamProgress, saveExamProgress, queueOfflineSubmission, syncPendingSubmissions } from '../src/lib/cbt-offline';

const EXAM_ID = 'd37a0c7c-4b59-49a1-afad-30f08a6cfd09';
type Question = { id: number; text: string; options: string[] };

export default function CbtPracticePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flags, setFlags] = useState<Record<number, boolean>>({});
  const [seconds, setSeconds] = useState(20 * 60);
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [restored, setRestored] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const question = questions[index];

  useEffect(() => {
    let active = true;
    async function loadExam() {
      try {
        const data = await fetchCbtQuestions(EXAM_ID);
        if (!active) return;
        setQuestions(data.questions);
        setDurationMinutes(data.exam.durationMinutes);
        setSeconds(data.exam.durationMinutes * 60);
        const saved = await getExamProgress(EXAM_ID);
        if (saved && active) {
          setAnswers(saved.answers);
          setFlags(saved.flags);
          setSeconds(saved.timeRemainingSeconds);
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load the CBT exam.');
      } finally {
        if (active) { setRestored(true); setLoading(false); }
      }
    }
    void loadExam();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!question) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'n') setIndex((value) => Math.min(value + 1, questions.length - 1));
      if (key === 'p') setIndex((value) => Math.max(value - 1, 0));
      if (key === 'f') setFlags((value) => ({ ...value, [question.id]: !value[question.id] }));
    };
    const onOffline = () => setOffline(true);
    const onOnline = () => {
      setOffline(false);
      void syncPendingSubmissions(async (payload) => {
        try { await submitCbt({ examId: payload.examId, answers: payload.answers, timeSpentSeconds: payload.timeSpentSeconds }); return true; }
        catch { return false; }
      });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [question, questions.length]);

  useEffect(() => {
    if (!restored || !questions.length) return;
    saveExamProgress({ examId: EXAM_ID, answers, flags, timeRemainingSeconds: seconds, lastUpdated: Date.now() }).catch(() => undefined);
  }, [answers, flags, seconds, restored, questions.length]);

  async function submitExam() {
    setMessage('');
    if (!questions.length) return;
    const timeSpentSeconds = durationMinutes * 60 - seconds;
    if (offline) {
      await queueOfflineSubmission({ examId: EXAM_ID, answers, timeSpentSeconds });
      setMessage('Submission is queued. It will sync automatically when your connection returns.');
      return;
    }
    try {
      const result = await submitCbt({ examId: EXAM_ID, answers, timeSpentSeconds });
      localStorage.setItem('edureach-last-cbt-attempt', result.attemptId);
      window.location.href = `/cbt/results?attempt=${encodeURIComponent(result.attemptId)}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission could not be completed. Your progress is still saved locally.');
    }
  }

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');

  return <HubLayout><div className="hub-cbt-engine">
    <div className="hub-cbt-topbar"><div><strong>EduReach CBT</strong><span>Practice exam</span></div><div className="hub-cbt-timer"><TimerReset size={17}/> {mins}:{secs}</div><div className="hub-cbt-network">{offline && <><WifiOff size={15}/> Offline mode • progress saved locally</>}</div><button className="hub-primary-btn" onClick={() => void submitExam()} disabled={loading || !questions.length}><Send size={16}/> Submit Exam</button></div>
    {message && <div className="hub-container"><div className="hub-form-note">{message}</div></div>}
    {loading ? <div className="hub-container"><div className="hub-panel hub-empty">Loading the current practice exam…</div></div> : !question ? <div className="hub-container"><div className="hub-panel hub-empty">No questions are available for this exam yet.</div></div> : <div className="hub-container hub-cbt-layout">
      <section className="hub-question-card"><div className="hub-question-meta"><span>Question {index + 1} of {questions.length} · {answeredCount} answered</span><button type="button" onClick={() => setFlags((value) => ({ ...value, [question.id]: !value[question.id] }))}><Flag size={16}/> {flags[question.id] ? 'Flagged' : 'Flag'}</button></div><h1>{question.text}</h1><div className="hub-options">{question.options.map((option, optionIndex) => <button type="button" key={option} className={answers[question.id] === optionIndex ? 'selected' : ''} onClick={() => setAnswers((value) => ({ ...value, [question.id]: optionIndex }))}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div><div className="hub-question-actions"><button type="button" className="hub-outline-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft size={16}/> Previous</button><button type="button" className="hub-primary-btn" disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)}>Next <ChevronRight size={16}/></button></div></section>
      <aside className="hub-palette-card"><div><span className="hub-eyebrow">QUESTION PALETTE</span><h3>Jump to question</h3></div><div className="hub-palette-grid">{questions.map((item, itemIndex) => <button type="button" key={item.id} className={`${answers[item.id] !== undefined ? 'answered' : ''} ${flags[item.id] ? 'flagged' : ''}`} onClick={() => setIndex(itemIndex)}>{itemIndex + 1}</button>)}</div><div className="hub-palette-legend"><span><i className="answered-dot"/>Answered</span><span><i className="flagged-dot"/>Flagged</span><span><i className="open-dot"/>Unanswered</span></div></aside>
    </div>}
  </div></HubLayout>;
}
