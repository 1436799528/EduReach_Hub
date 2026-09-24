import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { fetchCbtExams } from '../src/lib/api';

function setupPathForExam(exam: Exam) {
  const value = `${exam.exam_body} ${exam.id} ${exam.title}`.toLowerCase();
  if (value.includes('post-utme') || value.includes('postutme')) return '/cbt/setup/post-utme';
  if (value.includes('waec')) return '/cbt/setup/waec';
  if (value.includes('neco')) return '/cbt/setup/neco';
  return '/cbt/setup/jamb';
}
import { SkeletonRows } from '../src/components/Skeleton';

type Exam = { id: string; title: string; exam_body: string; subject: string; duration_minutes: number };
type ExamMode = 'ALL' | 'JAMB' | 'POST-UTME' | 'WAEC' | 'NECO';

const modes: Array<{ id: ExamMode; label: string }> = [
  { id: 'ALL', label: 'All Exams' },
  { id: 'JAMB', label: 'JAMB / UTME' },
  { id: 'POST-UTME', label: 'Post-UTME' },
  { id: 'WAEC', label: 'WAEC SSCE' },
  { id: 'NECO', label: 'NECO SSCE' },
];

export default function CbtPage() {
  const readModeFromUrl = (): ExamMode => {
    if (typeof window === 'undefined') return 'ALL';
    const requested = new URLSearchParams(window.location.search).get('mode')?.trim().toUpperCase();
    return modes.some((item) => item.id === requested) ? (requested as ExamMode) : 'ALL';
  };

  const [exams, setExams] = useState<Exam[]>([]);
  const [mode, setMode] = useState<ExamMode>(() => readModeFromUrl());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadExams() {
    setLoading(true);
    setError('');
    try {
      setExams((await fetchCbtExams()) as Exam[]);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load CBT exams.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const syncMode = () => setMode(readModeFromUrl());
    window.addEventListener('popstate', syncMode);
    void loadExams();
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

  function changeMode(nextMode: string) {
    const value = nextMode as ExamMode;
    setMode(value);
    window.history.replaceState({}, '', value === 'ALL' ? '/cbt' : '/cbt?mode=' + encodeURIComponent(value));
  }

  return (
    <HubLayout>
      <div className="hub-page">
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow" style={{ color: '#C85841', fontWeight: 800 }}>QUESTION BANKS</span>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '2px 0 4px' }}>CBT Practice</h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Pick a question bank below — each test opens a short setup page before the timed CBT simulator and on-screen calculator.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a className="hub-outline-btn" href="/screening-calculator" style={{ textDecoration: 'none' }}>
                <Calculator size={14} /> Screening Calculator
              </a>
              <a className="hub-primary-btn" href="/dashboard/cbt" style={{ textDecoration: 'none' }}>
                <Trophy size={14} /> My Results
              </a>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              margin: '0 0 22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock3 size={20} style={{ color: '#C85841', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>Real-Time Exam Timer</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Countdown, auto-submit and calculator</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={20} style={{ color: '#059669', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>Instant Evaluation</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Accurate scoring and percentages</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={20} style={{ color: '#B45309', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>Detailed Corrections</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Explanations for all options</span>
              </div>
            </div>
          </div>

          <section className="er-section" style={{ marginTop: 0 }}>
            <SectionHead title="Choose an exam" />
            <div style={{ marginBottom: '18px' }}>
              <FilterPills options={modes} active={mode} onChange={changeMode} ariaLabel="Exam categories" />
            </div>
          </section>

          {loading && <SkeletonRows rows={4} label="Loading question banks" />}
          {error && (
            <div className="hub-form-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span>{error}</span>
              <button type="button" className="hub-outline-btn" onClick={() => void loadExams()} disabled={loading}>Try again</button>
            </div>
          )}
          {!loading && !error && !filteredExams.length && (
            <div className="hub-panel hub-empty">
              <FileQuestion size={26} style={{ color: '#64748b', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>No {mode === 'ALL' ? '' : mode + ' '}exams available yet.</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Select another category to practice.</p>
            </div>
          )}

          {!loading && !error && filteredExams.length > 0 && (
            <div className="er-bank-list">
              {filteredExams.map((exam) => (
                <div key={exam.id} className={`er-bank-card ${identityClassFor(exam.exam_body, 'service')}`}>
                  <div className="er-bank-main">
                    <CardIdentityMark value={exam.exam_body} type="service" />
                    <div className="er-bank-copy">
                      <span className="er-bank-eyebrow">
                        {exam.exam_body} • {exam.subject}
                      </span>
                      <h3>{exam.title}</h3>
                      <span className="er-bank-meta">
                        <Clock3 size={13} />
                        {exam.duration_minutes} Minutes
                      </span>
                    </div>
                  </div>

                  <a
                    href={setupPathForExam(exam)}
                    className="hub-primary-btn er-bank-cta"
                  >
                    Set up test <ArrowRight size={14} />
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
