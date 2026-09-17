import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { fetchCbtResult } from '../src/lib/api';

export default function CbtResultsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const attemptId = new URLSearchParams(window.location.search).get('attempt') || localStorage.getItem('edureach-last-cbt-attempt');
    if (!attemptId) {
      setError('No CBT result is available yet. Complete a practice exam first.');
      setLoading(false);
      return;
    }
    void fetchCbtResult(attemptId)
      .then(setResult)
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load the CBT result.'))
      .finally(() => setLoading(false));
  }, []);

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    {loading && <div className="hub-panel hub-empty">Loading your CBT result…</div>}
    {!loading && error && <div className="hub-panel hub-empty"><p>{error}</p><a className="hub-primary-btn" href="/cbt">Start CBT Practice</a></div>}
    {!loading && result && <>
      <div className="hub-score-card"><div><span className="hub-eyebrow">PRACTICE RESULT</span><h1>{Number(result.attempt.score || 0).toFixed(0)}%</h1><p>{Number(result.attempt.score || 0) >= 70 ? 'Strong result. Review the questions you missed and keep practising.' : 'Review the corrections below and practise the weaker areas again.'}</p></div><div className="hub-score-stats"><span><strong>{result.attempt.correct_answers}/{result.attempt.total_questions}</strong>Correct</span><span><strong>{result.attempt.submitted_at ? new Date(result.attempt.submitted_at).toLocaleTimeString() : '—'}</strong><Clock3 size={15}/>Submitted</span><span><strong>{result.answers.filter((answer: any) => !answer.is_correct).length}</strong>Review</span></div></div>
      <div className="hub-section-heading compact"><div><span className="hub-eyebrow">CORRECTIONS</span><h2>Review your answers</h2></div><a href="/cbt">Practice again</a></div>
      <div className="hub-corrections">{result.questions.map((question: any) => {
        const answer = result.answers.find((item: any) => item.question_id === question.id);
        const correctIndex = String(question.correct_option).charCodeAt(0) - 65;
        const selectedIndex = answer?.selected_option ? String(answer.selected_option).charCodeAt(0) - 65 : null;
        return <details key={question.id} open={question.position === 1} className="hub-correction"><summary><span className="hub-correction-num">{question.position}</span><span className="hub-correction-text">{question.question_text}</span><span className="hub-correction-status">{answer?.is_correct ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}</span></summary><div className="hub-correction-body"><p><strong>Your answer:</strong> {selectedIndex === null ? 'Not answered' : `${String.fromCharCode(65 + selectedIndex)} — ${[question.option_a, question.option_b, question.option_c, question.option_d][selectedIndex]}`}</p><p><strong>Correct option:</strong> {String.fromCharCode(65 + correctIndex)} — {[question.option_a, question.option_b, question.option_c, question.option_d][correctIndex]}</p><p>{question.explanation || 'Review the question and compare the available options before your next attempt.'}</p></div></details>;
      })}</div>
    </>}
  </div></div></HubLayout>;
}
