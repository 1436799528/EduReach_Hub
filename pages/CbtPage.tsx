import { ArrowRight, Clock3, FileQuestion } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { fetchCbtExams } from '../src/lib/api';

type Exam = { id: string; title: string; exam_body: string; subject: string; duration_minutes: number };

export default function CbtPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchCbtExams()
      .then((data) => setExams(data as Exam[]))
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load CBT exams.'))
      .finally(() => setLoading(false));
  }, []);

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-section-heading hub-page-heading-compact"><div><span className="hub-eyebrow">CBT PRACTICE</span><h1>Practice</h1></div><a className="hub-outline-btn" href="/cbt/results">My Results</a></div>
    {loading && <div className="hub-panel hub-empty">Loading available exams…</div>}
    {error && <div className="hub-form-error">{error}</div>}
    {!loading && !error && !exams.length && <div className="hub-panel hub-empty">No active CBT exams are available yet.</div>}
    {!loading && !error && <div className="hub-cbt-exam-list">{exams.map((exam) => <article className="hub-cbt-exam-row" key={exam.id}><div className="hub-cbt-exam-icon"><FileQuestion size={21}/></div><div className="hub-cbt-exam-main"><span>{exam.exam_body} · {exam.subject}</span><h2>{exam.title}</h2><p><Clock3 size={13}/> {exam.duration_minutes} minutes</p></div><a className="hub-primary-btn" href={`/cbt/practice?exam=${encodeURIComponent(exam.id)}`}>Start Practice <ArrowRight size={15}/></a></article>)}</div>}
  </div></div></HubLayout>;
}
