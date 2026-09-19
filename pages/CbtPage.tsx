import { ArrowRight, BarChart3, Clock3, FileQuestion, GraduationCap, Trophy, Calculator } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchCbtExams } from '../src/lib/api';

type Exam = { id: string; title: string; exam_body: string; subject: string; duration_minutes: number };
type ExamMode = 'ALL' | 'JAMB' | 'POST-UTME' | 'WAEC' | 'NECO';

const modes: Array<{ key: ExamMode; label: string; description: string }> = [
  { key: 'ALL', label: 'All Exams', description: 'All active practice exams.' },
  { key: 'JAMB', label: 'JAMB / UTME', description: 'UTME-style practice and mocks.' },
  { key: 'POST-UTME', label: 'Post-UTME', description: 'University screening practice.' },
  { key: 'WAEC', label: 'WAEC', description: 'WAEC preparation and revision.' },
  { key: 'NECO', label: 'NECO', description: 'NECO preparation and revision.' },
];

const cbtServices = [
  { key: 'jamb-cbt', label: 'JAMB', title: 'JAMB CBT', description: 'UTME practice and timed mocks.', tone: 'blue' },
  { key: 'results', label: 'WAEC / NECO', title: 'WAEC / NECO CBT', description: 'Exam-focused revision practice.', tone: 'green' },
  { key: 'post-utme', label: 'POST-UTME', title: 'Post-UTME Practice', description: 'University screening-style practice.', tone: 'amber' },
  { key: 'services', label: 'EDUREACH', title: 'Student Learning Tools', description: 'Academic tools around your exams.', tone: 'slate' },
];

export default function CbtPage() {
  const readModeFromUrl = (): ExamMode => {
    if (typeof window === 'undefined') return 'JAMB';
    const requested = new URLSearchParams(window.location.search).get('mode')?.trim().toUpperCase();
    return modes.some((item) => item.key === requested) ? requested as ExamMode : 'JAMB';
  };

  const [exams, setExams] = useState<Exam[]>([]);
  const [mode, setMode] = useState<ExamMode>(() => readModeFromUrl());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const syncMode = () => setMode(readModeFromUrl());
    window.addEventListener('popstate', syncMode);

    void fetchCbtExams()
      .then((data) => setExams(data as Exam[]))
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load CBT exams.'))
      .finally(() => setLoading(false));

    return () => window.removeEventListener('popstate', syncMode);
  }, []);

  const filteredExams = useMemo(() => {
    if (mode === 'ALL') return exams;

    return exams.filter((exam) => {
      const body = exam.exam_body.trim().toUpperCase().replace(/[\s_-]+/g, '');
      const selected = mode.replace(/[\s_-]+/g, '');

      if (selected === 'JAMB') return body === 'JAMB' || body === 'UTME';
      if (selected === 'WAEC') return body === 'WAEC' || body.includes('WAEC');
      if (selected === 'NECO') return body === 'NECO' || body.includes('NECO');
      if (selected === 'POSTUTME') return body === 'POSTUTME' || body.includes('POSTUTME');
      return body === selected;
    });
  }, [exams, mode]);

  function changeMode(nextMode: ExamMode) {
    setMode(nextMode);
    window.history.replaceState({}, '', nextMode === 'ALL' ? '/cbt' : '/cbt?mode=' + encodeURIComponent(nextMode));
  }

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-section-heading hub-page-heading-compact">
      <div><span className="hub-eyebrow">CBT</span><h1>Exam Practice</h1><p>Choose an exam mode and practise from the same EduReach CBT engine.</p></div>
      <div className="hub-home-top-actions"><a className="hub-outline-btn" href="/screening-calculator"><Calculator size={15}/> Calculator</a><a className="hub-primary-btn" href="/cbt/results"><Trophy size={15}/> Results</a></div>
    </div>

    <section className="hub-cbt-services-area">
      <div className="hub-section-heading compact"><div><span className="hub-eyebrow">EXAM SERVICES</span><h2>Choose an examination service</h2></div></div>
      <div className="hub-cbt-service-list hub-cbt-compact-service-list">
        {cbtServices.map((service) => (
          <a className={`hub-cbt-service-card tone-${service.tone} hub-click-card`} href={service.key === 'services' ? '/dashboard' : '/cbt?mode=' + (service.key === 'jamb-cbt' ? 'JAMB' : service.key === 'results' ? 'WAEC' : 'POST-UTME')} key={service.key}>
            <div className="hub-cbt-brand-area"><CardIdentityMark value={service.key} type="service" /></div>
            <div className="hub-cbt-service-content"><span className="hub-cbt-service-label">{service.label}</span><h3>{service.title}</h3><p>{service.description}</p></div>
            <ArrowRight size={17} className="hub-compact-arrow" />
          </a>
        ))}
      </div>
    </section>

    <div className="hub-cbt-feature-grid hub-cbt-compact-feature-grid">
      <article className="hub-cbt-feature"><div className="hub-cbt-feature-icon"><GraduationCap size={19}/></div><div><strong>Timed practice</strong><span>Work through questions under exam-like time pressure.</span></div></article>
      <article className="hub-cbt-feature"><div className="hub-cbt-feature-icon"><FileQuestion size={19}/></div><div><strong>Corrections</strong><span>Review answers and explanations after submission.</span></div></article>
      <article className="hub-cbt-feature"><div className="hub-cbt-feature-icon"><BarChart3 size={19}/></div><div><strong>Performance</strong><span>Keep your practice results inside your account.</span></div></article>
    </div>

    <div className="hub-section-heading compact"><div><span className="hub-eyebrow">EXAM MODE</span><h2>Choose what to practise</h2></div></div>
    <div className="hub-cbt-mode-switcher">
      {modes.map((item) => <button type="button" key={item.key} className={mode === item.key ? 'active' : ''} onClick={() => changeMode(item.key)}><strong>{item.label}</strong><span>{item.description}</span></button>)}
    </div>

    {loading && <div className="hub-panel hub-empty">Loading available exams…</div>}
    {error && <div className="hub-form-error">{error}</div>}
    {!loading && !error && !filteredExams.length && <div className="hub-panel hub-empty"><FileQuestion size={26}/><h3>No {mode === 'ALL' ? '' : mode + ' '}exams published yet.</h3><p>Add or publish the relevant question bank from the CBT admin area.</p></div>}

    {!loading && !error && filteredExams.length > 0 && <div className="hub-cbt-exam-list">
      {filteredExams.map((exam) => (
        <a className="hub-cbt-exam-row hub-click-card" href={'/cbt/practice?exam=' + encodeURIComponent(exam.id)} key={exam.id}>
          <div className="hub-cbt-exam-icon"><CardIdentityMark value={exam.exam_body === 'JAMB' ? 'jamb-cbt' : exam.exam_body === 'WAEC' ? 'waec-result' : exam.exam_body === 'NECO' ? 'neco-result' : 'cbt'} type="service" /></div>
          <div className="hub-cbt-exam-main"><span>{exam.exam_body} · {exam.subject}</span><h2>{exam.title}</h2><p><Clock3 size={13}/> {exam.duration_minutes} minutes</p></div>
          <ArrowRight size={17} className="hub-compact-arrow" />
        </a>
      ))}
    </div>}
  </div></div></HubLayout>;
}
