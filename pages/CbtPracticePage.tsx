import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flag, Send, TimerReset } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { sampleQuestions } from '../src/data/hubContent';

export default function CbtPracticePage() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flags, setFlags] = useState<Record<number, boolean>>({});
  const [seconds, setSeconds] = useState(20 * 60);
  const questions = useMemo(() => sampleQuestions, []);
  const question = questions[index];

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'n') setIndex((value) => Math.min(value + 1, questions.length - 1));
      if (key === 'p') setIndex((value) => Math.max(value - 1, 0));
      if (key === 'f') setFlags((value) => ({ ...value, [question.id]: !value[question.id] }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [question.id, questions.length]);

  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return <HubLayout><div className="hub-cbt-engine">
    <div className="hub-cbt-topbar"><div><strong>EduReach CBT</strong><span>Use of English · JAMB 2026</span></div><div className="hub-cbt-timer"><TimerReset size={17}/> {mins}:{secs}</div><button className="hub-primary-btn" onClick={() => window.location.href = '/cbt/results'}><Send size={16}/> Submit Exam</button></div>
    <div className="hub-container hub-cbt-layout">
      <section className="hub-question-card"><div className="hub-question-meta"><span>Question {index + 1} of {questions.length}</span><button onClick={() => setFlags((value) => ({ ...value, [question.id]: !value[question.id] }))}><Flag size={16}/> {flags[question.id] ? 'Flagged' : 'Flag'}</button></div><h1>{question.text}</h1><div className="hub-options">{question.options.map((option, optionIndex) => <button key={option} className={answers[question.id] === optionIndex ? 'selected' : ''} onClick={() => setAnswers((value) => ({ ...value, [question.id]: optionIndex }))}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div><div className="hub-question-actions"><button className="hub-outline-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft size={16}/> Previous</button><button className="hub-primary-btn" disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)}>Next <ChevronRight size={16}/></button></div></section>
      <aside className="hub-palette-card"><div><span className="hub-eyebrow">QUESTION PALETTE</span><h3>Jump to question</h3></div><div className="hub-palette-grid">{questions.map((item, itemIndex) => <button key={item.id} className={`${answers[item.id] !== undefined ? 'answered' : ''} ${flags[item.id] ? 'flagged' : ''}`} onClick={() => setIndex(itemIndex)}>{itemIndex + 1}</button>)}</div><div className="hub-palette-legend"><span><i className="answered-dot"/>Answered</span><span><i className="flagged-dot"/>Flagged</span><span><i className="open-dot"/>Unanswered</span></div></aside>
    </div>
  </div></HubLayout>;
}
