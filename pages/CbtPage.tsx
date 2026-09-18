import { ArrowRight, BarChart3, Calculator, Clock3, FileQuestion, GraduationCap, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { fetchCbtExams } from '../src/lib/api';

type Exam = { id: string; title: string; exam_body: string; subject: string; duration_minutes: number };
type ExamMode = 'ALL' | 'JAMB' | 'POST-UTME';

const modes: Array<{ key: ExamMode; label: string; description: string }> = [
  { key: 'ALL', label: 'All Exams', description: 'Browse every active EduReach practice exam.' },
  { key: 'JAMB', label: 'JAMB / UTME', description: 'UTME-style practice, timed mocks and subject revision.' },
  { key: 'POST-UTME', label: 'Post-UTME', description: 'University screening-style practice and preparation.' },
];

export default function CbtPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [mode, setMode] = useState<ExamMode>('JAMB');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchCbtExams()
      .then((data) => setExams(data as Exam[]))
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load CBT exams.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredExams = useMemo(() => {
    if (mode === 'ALL') return exams;
    return exams.filter((exam) => exam.exam_body.toUpperCase() === mode);
  }, [exams, mode]);

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <section className="hub-cbt-hero">
      <div>
        <span className="hub-eyebrow">JAMB &amp; POST-UTME ENGINE</span>
        <h1>One CBT engine for serious exam practice.</h1>
        <p>Practise with a timed exam interface, question palette, flagging, saved progress, offline recovery and detailed corrections. JAMB and Post-UTME are treated as exam modes inside the same engine.</p>
      </div>
      <div className="hub-cbt-hero-actions">
        <a className="hub-primary-btn" href="/screening-calculator"><Calculator size={16}/> Screening Calculator</a>
        <a className="hub-outline-btn" href="/cbt/results"><Trophy size={16}/> My Results</a>
      </div>
    </section>

    <div className="hub-cbt-feature-grid">
      <article className="hub-cbt-feature"><div className="hub-cbt-feature-icon"><GraduationCap size={20}/></div><div><strong>JAMB / UTME</strong><span>Timed subject practice and full-mock ready structure.</span></div></article>
      <article className="hub-cbt-feature"><div className="hub-cbt-feature-icon"><FileQuestion size={20}/></div><div><strong>POST-UTME</strong><span>University screening-style question banks in the same engine.</span></div></article>
      <article className="hub-cbt-feature"><div className="hub-cbt-feature-icon"><BarChart3 size={20}/></div><div><strong>Screening planning</strong><span>Estimate aggregate scores before you apply.</span></div></article>
    </div>

    <div className="hub-section-heading hub-page-heading-compact"><div><span className="hub-eyebrow">EXAM MODE</span><h2>Choose what you want to practise</h2></div></div>
    <div className="hub-cbt-mode-switcher">
      {modes.map((item) => <button type="button" key={item.key} className={mode === item.key ? 'active' : ''} onClick={() => setMode(item.key)}><strong>{item.label}</strong><span>{item.description}</span></button>)}
    </div>

    {loading && <div className="hub-panel hub-empty">Loading available exams…</div>}
    {error && <div className="hub-form-error">{error}</div>}

    {!loading && !error && !filteredExams.length && <div className="hub-panel hub-empty">
      <FileQuestion size={28}/>
      <h3>No {mode === 'ALL' ? '' : mode} exams are published yet.</h3>
      <p>The engine is ready for JAMB and Post-UTME question banks. Add or publish the relevant exams from the CBT admin area.</p>
      <div className="hub-wizard-actions"><a className="hub-outline-btn" href="/services">Student Services</a><a className="hub-primary-btn" href="/screening-calculator">Use Screening Calculator <ArrowRight size={15}/></a></div>
    </div>}

    {!loading && !error && filteredExams.length > 0 && <div className="hub-cbt-exam-list">
      {filteredExams.map((exam) => <article className="hub-cbt-exam-row" key={exam.id}>
        <div className="hub-cbt-exam-icon"><FileQuestion size={21}/></div>
        <div className="hub-cbt-exam-main"><span>{exam.exam_body} · {exam.subject}</span><h2>{exam.title}</h2><p><Clock3 size={13}/> {exam.duration_minutes} minutes</p></div>
        <a className="hub-primary-btn" href={"/cbt/practice?exam=" + encodeURIComponent(exam.id)}>Start Practice <ArrowRight size={15}/></a>
      </article>)}
    </div>}
  </div></div></HubLayout>;
}
