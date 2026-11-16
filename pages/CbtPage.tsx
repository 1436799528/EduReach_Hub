import { userFacingError } from '../lib/errors';
import {
  ArrowRight,
  Calculator,
  FileQuestion,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { SkeletonTiles } from '../src/components/Skeleton';
import { identityClassFor } from '../src/components/CardIdentityMark';
import { useAuth } from '../src/lib/auth';
import { fetchAdmissionPreparationReadiness, fetchCbtExams, fetchCbtExamsWithAvailability, type AdmissionPreparationReadiness } from '../src/lib/api';
import FilterPills from '../src/components/FilterPills';
import SectionHead from '../src/components/SectionHead';
import { isSupabaseConfigured } from '../src/lib/supabase';
import CbtHistoryPanel from '../src/components/CbtHistoryPanel';

type Exam = { id: string; title: string; exam_body: string; subject: string; description: string | null; duration_minutes: number; question_count?: number; subject_count?: number };

type ExamMode = 'ALL' | 'JAMB' | 'POST-UTME' | 'WAEC' | 'NECO';

function simulatorKeyForBody(value: string): 'jamb' | 'waec' | 'neco' | 'post-utme' {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized.includes('postutme')) return 'post-utme';
  if (normalized.includes('waec')) return 'waec';
  if (normalized.includes('neco')) return 'neco';
  return 'jamb';
}

function simulatorLogoForBody(value: string): string {
  const key = simulatorKeyForBody(value);
  return `/icons/brands/${key === 'post-utme' ? 'jamb' : key}.webp`;
}

// The card routes into the body-specific setup wizard and carries the real
// exam id, so the setup page can show THIS exam's configured default duration
// and start THIS exam's question pool. Durations are not shown on the card
// itself; they live on the setup page where the student configures the session.
function setupPathForExam(exam: Exam, preferredSubjects: string[] = []) {
  const value = `${exam.exam_body} ${exam.id} ${exam.title}`.toLowerCase();
  const base = value.includes('post-utme') || value.includes('postutme')
    ? '/cbt/setup/post-utme'
    : value.includes('waec')
      ? '/cbt/setup/waec'
      : value.includes('neco')
        ? '/cbt/setup/neco'
        : value.includes('jamb') || value.includes('utme')
          ? '/cbt/setup/jamb'
          : null;
  const params = new URLSearchParams({ exam: exam.id });
  if (preferredSubjects.length) params.set('subjects', preferredSubjects.join('|'));
  if (!base) return `/cbt/practice?${params.toString()}`;
  return `${base}?${params.toString()}`;
}
const modes: Array<{ id: ExamMode; label: string }> = [
  { id: 'ALL', label: 'All Exams' },
  { id: 'JAMB', label: 'JAMB / UTME' },
  { id: 'POST-UTME', label: 'Post-UTME' },
  { id: 'WAEC', label: 'WAEC SSCE' },
  { id: 'NECO', label: 'NECO SSCE' },
];

export default function CbtPage() {
  const { isAuthenticated } = useAuth();
  const readModeFromUrl = (): ExamMode => {
    if (typeof window === 'undefined') return 'ALL';
    const requested = new URLSearchParams(window.location.search).get('mode')?.trim().toUpperCase();
    return modes.some((item) => item.id === requested) ? (requested as ExamMode) : 'ALL';
  };

  const [exams, setExams] = useState<Exam[]>([]);
  const [mode, setMode] = useState<ExamMode>(() => readModeFromUrl());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [admissionReadiness, setAdmissionReadiness] = useState<AdmissionPreparationReadiness | null>(null);

  async function loadExams() {
    setLoading(true);
    setError('');
    try {
      const catalogue = (isSupabaseConfigured
        ? (await fetchCbtExamsWithAvailability()) as unknown as Exam[]
        : (await fetchCbtExams()) as Exam[]);
      // Show the catalogue the server returned. "Too few questions" is a
      // startability detail the setup wizard explains; it is not a reason to
      // make the listing disagree with the rest of the CBT surfaces.
      setExams([...catalogue].sort((a, b) => {
        const readiness = (exam: Exam) => typeof exam.question_count === 'number' && (exam.question_count < 5 || (exam.subject_count ?? 1) < 1) ? 1 : 0;
        return readiness(a) - readiness(b) || String(a.title).localeCompare(String(b.title));
      }));
    } catch (value) {
      setError(userFacingError(value, 'Unable to load CBT exams.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setAdmissionReadiness(null);
      return () => { active = false; };
    }
    void fetchAdmissionPreparationReadiness()
      .then((data) => { if (active) setAdmissionReadiness(data); })
      .catch(() => { if (active) setAdmissionReadiness(null); });
    return () => { active = false; };
  }, [isAuthenticated]);

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
              <h1 style={{ fontSize: '24px', fontWeight: 680, color: '#0f172a', margin: '0 0 4px' }}>CBT practice</h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#5e6c82' }}>
                Choose a bank, then pick your subjects and the number of questions.
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

          {admissionReadiness?.target && (
            <section className="er-prep-goal" aria-label="Your admission preparation target">
              <div className="er-prep-goal-heading">
                <span className="er-prep-goal-mark" aria-hidden="true"><Trophy size={17} /></span>
                <div>
                  <strong>{admissionReadiness.target.programme_name}</strong>
                  <small>{admissionReadiness.target.school_name} · {admissionReadiness.target.admission_session}</small>
                </div>
              </div>
              <div className="er-prep-goal-stats">
                <span>UTME target <b>{admissionReadiness.target.target_utme_score == null ? '—' : `${admissionReadiness.target.target_utme_score}/400`}</b></span>
                <span>Practice average <b>{admissionReadiness.averagePracticePercent == null ? '—' : `${admissionReadiness.averagePracticePercent}%`}</b></span>
                <span>Practice goal <b>{admissionReadiness.practiceTargetPercent == null ? '—' : `${admissionReadiness.practiceTargetPercent}%`}</b></span>
              </div>
              {admissionReadiness.requiredSubjects.length > 0 && (
                <p className="er-prep-goal-subjects">Required JAMB subjects: {admissionReadiness.requiredSubjects.map((subject) => subject === 'english' ? 'Use of English' : subject.replace(/\b\w/g, (letter) => letter.toUpperCase())).join(' · ')}</p>
              )}
              {admissionReadiness.publishedCutoffs && admissionReadiness.publishedCutoffs.length > 0 ? (
                <div className="er-prep-goal-cutoffs">
                  {admissionReadiness.publishedCutoffs.map((cutoff) => {
                    const label = cutoff.cutoff_type === 'institution_utme_minimum'
                      ? 'School minimum'
                      : cutoff.cutoff_type === 'departmental'
                        ? 'Department cutoff'
                        : cutoff.cutoff_type === 'aggregate'
                          ? 'Aggregate cutoff'
                          : cutoff.cutoff_type === 'post_utme'
                            ? 'Post-UTME cutoff'
                            : cutoff.cutoff_type === 'programme_utme_minimum'
                              ? 'Course minimum'
                              : 'Published cutoff';
                    const scale = cutoff.score_scale_max == null ? '' : ` / ${cutoff.score_scale_max}`;
                    return (
                      <div key={cutoff.id} className="er-prep-goal-cutoff">
                        <span>{label}</span>
                        <b>{cutoff.utme_cutoff == null ? '—' : `${cutoff.utme_cutoff}${scale}`}</b>
                        {cutoff.departmental_cutoff != null && (
                          <small>Department: {cutoff.departmental_cutoff}{scale}</small>
                        )}
                        {cutoff.source_url && (
                          <a href={cutoff.source_url} target="_blank" rel="noreferrer" aria-label={`View source for ${label}`} title="Source">
                            <ArrowRight size={13} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <small className="er-prep-goal-note">No verified cutoff is published for this programme and session yet.</small>
              )}
              <small className="er-prep-goal-note">Practice results are preparation indicators, not an admission prediction.</small>
            </section>
          )}

          <section className="er-section" style={{ marginTop: admissionReadiness?.target ? 20 : 0 }}>
            <SectionHead title="Choose an exam simulator" />
            <div style={{ marginBottom: '14px' }}>
              <FilterPills options={modes} active={mode} onChange={changeMode} ariaLabel="Exam categories" />
            </div>
          </section>

          {loading && <SkeletonTiles className="er-sim-grid" tiles={4} label="Loading exam simulators" />}
          {error && (
            <div className="hub-form-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span>{error}</span>
              <button type="button" className="hub-outline-btn" onClick={() => void loadExams()} disabled={loading}>Try again</button>
            </div>
          )}
          {!loading && !error && !filteredExams.length && (
            <div className="hub-panel hub-empty">
              <FileQuestion size={26} style={{ color: '#5e6c82', marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>No {mode === 'ALL' ? '' : mode + ' '}exams available yet.</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#5e6c82' }}>Select another category to practice.</p>
            </div>
          )}
          {!loading && !error && filteredExams.length > 0 && (
            <div className="er-sim-grid">
              {filteredExams.map((exam) => {
                const body = String(exam.exam_body || 'JAMB');
                const simulatorKey = simulatorKeyForBody(body);
                const rawBody = body.trim().toUpperCase().replace(/[\s_-]+/g, '');
                const isJambTarget = ['JAMB', 'UTME'].includes(rawBody) && admissionReadiness?.target?.entry_mode === 'UTME';
                const preferredSubjects = isJambTarget ? admissionReadiness?.requiredSubjects || [] : [];
                return (
                  <a
                    key={exam.id}
                    href={setupPathForExam(exam, preferredSubjects)}
                    className={`er-sim-card er-sim-${simulatorKey} ${identityClassFor(body, 'service')}`}
                  >
                    <span className="er-sim-top">
                      <img src={simulatorLogoForBody(body)} alt="" width={40} height={40} loading="lazy" decoding="async" />
                      <span className="er-sim-badge">{isJambTarget && preferredSubjects.length === 4 ? 'YOUR COURSE' : body}</span>
                    </span>
                    <span className="er-sim-body">
                      <strong>{exam.title}</strong>
                      {exam.description && <small>{exam.description}</small>}
                      <span className="er-sim-foot">
                        <span>{exam.subject || 'Timed practice'}</span>
                        <span className="er-card-arrow" aria-hidden="true"><ArrowRight size={14} /></span>
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          {/* The student's own sessions sit directly under the banks so a
              half-finished paper is one tap away, not buried in a dashboard. */}
          <section className="er-section" style={{ marginTop: '26px' }}>
            <CbtHistoryPanel />
          </section>


        </div>
      </div>
    </HubLayout>
  );
}
