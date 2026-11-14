import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { identityClassFor } from './CardIdentityMark';
import { ErrorState } from './AsyncState';
import { SkeletonTiles } from './Skeleton';
import WaveLoader from './WaveLoader';
import { fetchCbtExams, fetchCbtExamsWithAvailability, type CbtExamSummary } from '../lib/api';
import { usePendingPhase } from '../lib/usePendingPhase';
import { isSupabaseConfigured } from '../lib/supabase';

export type ExamSimulator = {
  id: string;
  title: string;
  mode: string;
  logo: string;
  desc?: string;
  meta: string;
  staticMain?: boolean;
};

const brandLogo = (mode: string) => {
  const normalized = mode.toLowerCase();
  if (normalized === 'waec') return '/icons/brands/waec.webp';
  if (normalized === 'neco') return '/icons/brands/neco.webp';
  if (normalized === 'nabteb') return '/icons/brands/nabteb.webp';
  return '/icons/brands/jamb.webp';
};


// The four main examinations are the front door of the home page, even while
// their question bank is being prepared. A live catalogue card replaces the
// matching fallback, so there is never a duplicate.
const MAIN_EXAM_NAMES: Array<[string, string]> = [
  ['JAMB', 'JAMB UTME'],
  ['WAEC', 'WAEC SSCE'],
  ['NECO', 'NECO SSCE'],
  ['Post-UTME', 'Post-UTME'],
];
const mainExams: ExamSimulator[] = MAIN_EXAM_NAMES.map(([mode, title]) => ({
  id: `${mode.toLowerCase()}-main`,
  title,
  mode,
  logo: brandLogo(mode),
  meta: 'Timed practice',
  staticMain: true,
}));

export function simulatorStartHref(key: string, examId?: string) {
  const mode = key.trim().toLowerCase().replace(/[\s_-]+/g, '-');
  const normalized = mode === 'postutme' ? 'post-utme' : mode;
  if (!['jamb', 'waec', 'neco', 'post-utme'].includes(normalized)) return '/cbt';
  const query = examId ? `?exam=${encodeURIComponent(examId)}` : '';
  return `/cbt/setup/${normalized}${query}`;
}

export default function ExamSimulatorGrid({
  variant = 'start',
}: {
  variant?: 'mode' | 'start';
}) {
  const [exams, setExams] = useState<ExamSimulator[]>([]);
  const [error, setError] = useState<unknown>(null);
  // Whether the catalogue has answered at all. Until it has, the section shows
  // placeholders: claiming "no question banks have been published" while the
  // request is still in flight is both wrong and a layout jump when the cards
  // arrive (PERF-1 measured that jump at 262px).
  const [settled, setSettled] = useState(false);
  // Retrying re-runs the same request. It is the only recovery that makes
  // sense here, and a failed lookup used to leave a dead sentence with no way
  // back except a page reload.
  const [attempt, setAttempt] = useState(0);
  const phase = usePendingPhase(!settled && error === null);

  useEffect(() => {
    let active = true;
    setError(null);
    setSettled(false);
    void (isSupabaseConfigured ? fetchCbtExamsWithAvailability() : fetchCbtExams())
      .then((items: CbtExamSummary[]) => {
        if (!active) return;
        // List every active bank the catalogue returns. Availability counts
        // describe whether a full session can start; they are not permission to
        // hide a published bank from the listing. Hiding them here made the
        // main page say "no active CBT" while /cbt and past questions listed
        // the same banks.
        const live = items.map((exam) => {
          const mode = String(exam.exam_body || exam.subject || 'CBT').trim();
          return {
            id: String(exam.id),
            title: String(exam.title),
            mode,
            logo: brandLogo(mode),
            desc: String(exam.description || 'Choose your subjects and start a timed paper.'),
            // A bank's size and the standard paper time are configuration, not
            // a promise about every practice session. The setup screen derives
            // the real time from the subjects and question count.
            meta: typeof exam.question_count === 'number' && (exam.question_count < 5 || (exam.subject_count ?? 1) < 1)
              ? 'Question pool still being prepared'
              : 'Timed practice',
          };
        });
        const normalizeMode = (mode: string) => mode.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
        const present = new Set(live.map((exam) => normalizeMode(exam.mode)));
        setExams([
          ...mainExams.filter((exam) => !present.has(normalizeMode(exam.mode))),
          ...live,
        ]);
      })
      .catch((value) => active && setError(value))
      .finally(() => { if (active) setSettled(true); });
    return () => { active = false; };
  }, [attempt]);

  if (!settled && error === null) {
    return (
      <div className="er-late-region er-late-region--simulators">
        <SkeletonTiles className="er-sim-grid" tiles={4} label="Loading CBT question banks" />
        {/* The skeleton keeps the layout; this names the wait once it is long
            enough to need a name, and replaces itself with a retry if the
            request never answers. */}
        {(phase === 'slow' || phase === 'stalled') && (
          <div className="er-slow-note">
            <WaveLoader variant="inline" decorative />
            <span>{phase === 'stalled' ? 'Still waiting for the question banks.' : 'Connecting to the question banks…'}</span>
            {phase === 'stalled' && (
              <button type="button" className="hub-outline-btn" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  if (error !== null) {
    return (
      <div className="er-late-region er-late-region--simulators">
        <ErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} />
      </div>
    );
  }
  if (!exams.length) {
    return (
      <div className="er-late-region er-late-region--simulators">
        <div className="er-empty">No CBT question banks are listed right now. Browse past questions while the catalogue is updated.</div>
      </div>
    );
  }

  return (
    <div className="er-late-region er-late-region--simulators">
      <div className="er-sim-grid">
        {exams.map((exam) => (
          <a
            key={exam.id}
            className={`er-sim-card er-sim-${exam.mode.toLowerCase().replace(/[^a-z0-9]+/g, '-')} ${identityClassFor(exam.mode, 'service')}`}
            href={variant === 'mode' ? `/cbt?mode=${encodeURIComponent(exam.mode)}` : (exam.staticMain ? simulatorStartHref(exam.mode) : simulatorStartHref(exam.mode, exam.id))}
          >
            <span className="er-sim-top">
              <img src={exam.logo} alt={`${exam.mode} logo`} width={40} height={40} loading="lazy" decoding="async" />
              <span className="er-sim-badge">{exam.mode}</span>
            </span>
            <span className="er-sim-body">
              <strong>{exam.title}</strong>
              {exam.desc && <small>{exam.desc}</small>}
              <span className="er-sim-foot">
                <span>{exam.meta}</span>
                <span className="er-card-arrow" aria-hidden="true"><ArrowRight size={14} /></span>
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
