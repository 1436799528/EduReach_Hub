import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock3,
  FileQuestion,
  GraduationCap,
  Laptop,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchCbtExams } from '../src/lib/api';

type Exam = { id: string; title: string; exam_body: string; subject: string; duration_minutes: number };
type ExamMode = 'ALL' | 'JAMB' | 'POST-UTME' | 'WAEC' | 'NECO';

const modes: Array<{ key: ExamMode; label: string; description: string }> = [
  { key: 'ALL', label: 'All Exams', description: 'All active CBT practice questions.' },
  { key: 'JAMB', label: 'JAMB / UTME', description: 'UTME-style timed test practice.' },
  { key: 'POST-UTME', label: 'Post-UTME', description: 'University screening practice tests.' },
  { key: 'WAEC', label: 'WAEC SSCE', description: 'Senior school certificate revision.' },
  { key: 'NECO', label: 'NECO SSCE', description: 'Senior secondary practice papers.' },
];

const cbtExamsOverview = [
  { key: 'jamb', label: 'JAMB UTME', title: 'JAMB CBT Classroom', desc: 'Simulate the exact UTME computer test environment with real past questions and timer.', tone: 'emerald', questions: '40 Qs', time: '30 mins' },
  { key: 'waec', label: 'WAEC SSCE', title: 'WAEC Exam Practice', desc: 'Sharpen your preparation in English, Mathematics, Biology, Chemistry & Physics.', tone: 'blue', questions: '50 Qs', time: '45 mins' },
  { key: 'neco', label: 'NECO SSCE', title: 'NECO Examination Revision', desc: 'Comprehensive practice tests covering high-frequency SSCE syllabus objectives.', tone: 'emerald', questions: '40 Qs', time: '40 mins' },
  { key: 'post-utme', label: 'POST-UTME', title: 'Post-UTME Screening Tests', desc: 'Screening aptitude tests for UNILAG, UNICAL, UNN, ABU, UI and state institutions.', tone: 'purple', questions: '30 Qs', time: '25 mins' },
];

export default function CbtPage() {
  const readModeFromUrl = (): ExamMode => {
    if (typeof window === 'undefined') return 'ALL';
    const requested = new URLSearchParams(window.location.search).get('mode')?.trim().toUpperCase();
    return modes.some((item) => item.key === requested) ? (requested as ExamMode) : 'ALL';
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

  return (
    <HubLayout>
      <div className="hub-page">
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow">CBT</span>
              <h1 style={{ fontSize: '28px', fontWeight: 900 }}>CBT Practice</h1>
              <p></p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a className="hub-outline-btn" href="/screening-calculator" style={{ textDecoration: 'none' }}>
                <Calculator size={14} /> Screening Calculator
              </a>
              <a className="hub-primary-btn" href="/dashboard/cbt/results" style={{ textDecoration: 'none' }}>
                <Trophy size={14} /> View Past Results
              </a>
            </div>
          </div>

          {/* 4 EXAM BODIES MYSCHOOL GRID */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
              marginBottom: '26px',
            }}
          >
            {cbtExamsOverview.map((item) => (
              <div
                key={item.key}
                className="ms-card"
                style={{ padding: '18px', cursor: 'default' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <CardIdentityMark value={item.key} type="service" />
                    <span className="ms-card-badge">{item.label}</span>
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                    {item.desc}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                    {item.questions} • {item.time}
                  </span>
                  <a
                    href={`/cbt/practice?exam=practice-exam-${item.key}`}
                    className="hub-primary-btn"
                    style={{ minHeight: '32px', padding: '0 12px', fontSize: '11px', textDecoration: 'none' }}
                  >
                    Start Test →
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* KEY BENEFITS OF MYSCHOOL CBT */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '26px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock3 size={20} style={{ color: '#059669', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: '#0f172a' }}>Real-Time Exam Timer</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Simulate real exam pressure</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={20} style={{ color: '#2563eb', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: '#0f172a' }}>Instant Evaluation</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Accurate scoring and percentages</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={20} style={{ color: '#7c3aed', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: '#0f172a' }}>Detailed Corrections</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Explanations for all options</span>
              </div>
            </div>
          </div>

          {/* MODE SELECTOR */}
          <div className="hub-section-heading" style={{ marginBottom: '12px' }}>
            <div>
              <span className="hub-eyebrow">SELECT CATEGORY</span>
              <h2 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 900 }}>Filter CBT Question Banks</h2>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '18px',
            }}
          >
            {modes.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => changeMode(item.key)}
                style={{
                  border: '1px solid',
                  borderColor: mode === item.key ? '#059669' : '#e2e8f0',
                  background: mode === item.key ? '#ecfdf5' : '#ffffff',
                  color: mode === item.key ? '#047857' : '#334155',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading && <div className="hub-panel hub-empty">Loading question banks…</div>}
          {error && <div className="hub-form-error">{error}</div>}
          {!loading && !error && !filteredExams.length && (
            <div className="hub-panel hub-empty">
              <FileQuestion size={26} style={{ color: '#64748b', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>No {mode === 'ALL' ? '' : mode + ' '}exams available yet.</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Select another category to practice.</p>
            </div>
          )}

          {!loading && !error && filteredExams.length > 0 && (
            <div style={{ display: 'grid', gap: '10px' }}>
              {filteredExams.map((exam) => (
                <div
                  key={exam.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    padding: '16px 18px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <CardIdentityMark value={exam.exam_body} type="service" />
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {exam.exam_body} • {exam.subject}
                      </span>
                      <h3 style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                        {exam.title}
                      </h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        <Clock3 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                        {exam.duration_minutes} Minutes
                      </span>
                    </div>
                  </div>

                  <a
                    href={`/cbt/practice?exam=${encodeURIComponent(exam.id)}`}
                    className="hub-primary-btn"
                    style={{
                      background: '#059669',
                      padding: '0 16px',
                      minHeight: '36px',
                      fontSize: '12px',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Take Test <ArrowRight size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
