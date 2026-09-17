import { CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { sampleQuestions } from '../src/data/hubContent';

export default function CbtResultsPage() {
  const score = 72;
  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-score-card"><div><span className="hub-eyebrow">PRACTICE RESULT</span><h1>{score}%</h1><p>Performance tier: Good start</p></div><div className="hub-score-stats"><span><strong>18/25</strong>Correct</span><span><strong>22:14</strong><Clock3 size={15}/>Time</span><span><strong>7</strong>Review</span></div></div>
    <div className="hub-section-heading compact"><div><span className="hub-eyebrow">CORRECTIONS</span><h2>Review your answers</h2></div><a href="/cbt">Practice again</a></div>
    <div className="hub-corrections">{sampleQuestions.map((item) => <details key={item.id} open={item.id === 1} className="hub-correction"><summary><span className="hub-correction-num">{item.id}</span><span className="hub-correction-text">{item.text}</span><span className="hub-correction-status"><CheckCircle2 size={16}/></span></summary><div className="hub-correction-body"><p><strong>Correct option:</strong> {String.fromCharCode(65 + item.correct)} — {item.options[item.correct]}</p><p>{item.explanation}</p><div className="hub-correction-answer"><XCircle size={16}/><span>Use this review pattern to understand the answer before your next practice session.</span></div></div></details>)}</div>
  </div></div></HubLayout>;
}
