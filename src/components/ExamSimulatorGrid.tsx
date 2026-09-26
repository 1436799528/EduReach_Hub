import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { identityClassFor } from './CardIdentityMark';
import { fetchCbtExams } from '../lib/api';

export type ExamSimulator = {
  id: string;
  title: string;
  mode: string;
  logo: string;
  desc: string;
  meta: string;
  guideHref: string;
};

const brandLogo = (mode: string) => {
  const normalized = mode.toLowerCase();
  if (normalized === 'waec') return '/icons/brands/waec.webp';
  if (normalized === 'neco') return '/icons/brands/neco.webp';
  if (normalized === 'nabteb') return '/icons/brands/nabteb.png';
  return '/icons/brands/jamb.png';
};

const guideHref = (mode: string) => {
  const normalized = mode.toLowerCase();
  if (normalized === 'post-utme') return '/post-utme';
  if (normalized === 'jamb') return '/jamb';
  if (normalized === 'waec') return '/waec';
  if (normalized === 'neco') return '/neco';
  if (normalized === 'nabteb') return '/nabteb';
  return '/cbt';
};

export function simulatorStartHref(key: string) {
  return `/cbt/setup/${encodeURIComponent(key)}`;
}

export default function ExamSimulatorGrid({
  variant = 'start',
  showGuides = false,
}: {
  variant?: 'mode' | 'start';
  showGuides?: boolean;
}) {
  const [exams, setExams] = useState<ExamSimulator[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetchCbtExams()
      .then((items: any[]) => {
        if (!active) return;
        setExams(items.map((exam) => {
          const mode = String(exam.exam_body || exam.subject || 'CBT').trim();
          return {
            id: String(exam.id),
            title: String(exam.title),
            mode,
            logo: brandLogo(mode),
            desc: String(exam.description || `Practice ${mode} questions in the EduReach CBT environment.`),
            meta: `${Number(exam.duration_minutes || 0)} min timed practice`,
            guideHref: guideHref(mode),
          };
        }));
      })
      .catch((value) => active && setError(value instanceof Error ? value.message : 'Unable to load CBT catalog.'));
    return () => { active = false; };
  }, []);

  if (error) return <div className="er-empty" role="alert">{error}</div>;
  if (!exams.length) return <div className="er-empty">No active CBT question banks have been published yet.</div>;

  return (
    <div>
      <div className="er-sim-grid">
        {exams.map((exam) => (
          <a
            key={exam.id}
            className={`er-sim-card er-sim-${exam.mode.toLowerCase().replace(/[^a-z0-9]+/g, '-')} ${identityClassFor(exam.mode, 'service')}`}
            href={variant === 'mode' ? `/cbt?mode=${encodeURIComponent(exam.mode)}` : simulatorStartHref(exam.id)}
          >
            <span className="er-sim-top">
              <img src={exam.logo} alt={`${exam.mode} logo`} width={40} height={40} loading="lazy" />
              <span className="er-sim-badge">{exam.mode}</span>
            </span>
            <span className="er-sim-body">
              <strong>{exam.title}</strong>
              <small>{exam.desc}</small>
              <span className="er-sim-foot">
                <span>{exam.meta}</span>
                <span className="er-sim-cta">{variant === 'mode' ? 'Practice' : 'Start Test'} <ArrowRight size={12} /></span>
              </span>
            </span>
          </a>
        ))}
      </div>
      {showGuides && (
        <div className="er-guide-strip">
          {exams.map((exam) => (
            <a key={exam.id} href={exam.guideHref}>
              {exam.mode === 'POST-UTME' ? 'Post-UTME' : exam.mode} Guide <ArrowRight size={11} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
