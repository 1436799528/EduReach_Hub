import { ArrowRight } from 'lucide-react';

export type ExamSimulator = {
  key: string;
  title: string;
  mode: string;
  logo: string;
  desc: string;
  meta: string;
  guideHref: string;
};

export const examSimulators: ExamSimulator[] = [
  {
    key: 'jamb',
    title: 'JAMB CBT Simulator',
    mode: 'JAMB',
    logo: '/icons/brands/jamb.png',
    desc: 'UTME past questions in a real CBT environment with timer.',
    meta: '40 Qs • 30 mins',
    guideHref: '/jamb',
  },
  {
    key: 'waec',
    title: 'WAEC CBT Practice',
    mode: 'WAEC',
    logo: '/icons/brands/waec.webp',
    desc: 'SSCE revision across English, Maths and sciences.',
    meta: '50 Qs • 45 mins',
    guideHref: '/waec',
  },
  {
    key: 'neco',
    title: 'NECO CBT Practice',
    mode: 'NECO',
    logo: '/icons/brands/neco.webp',
    desc: 'SSCE practice papers by syllabus objective.',
    meta: '40 Qs • 40 mins',
    guideHref: '/neco',
  },
  {
    key: 'post-utme',
    title: 'Post-UTME Screening Tests',
    mode: 'POST-UTME',
    logo: '/icons/brands/jamb.png',
    desc: 'Screening aptitude tests for federal and state schools.',
    meta: '30 Qs • 25 mins',
    guideHref: '/post-utme',
  },
];

/**
 * Shared Myschool-style exam simulator grid.
 * variant="mode" links each card to the filtered CBT hall (/cbt?mode=X).
 * variant="start" links each card straight into a practice session.
 */
export default function ExamSimulatorGrid({
  variant = 'mode',
  showGuides = false,
}: {
  variant?: 'mode' | 'start';
  showGuides?: boolean;
}) {
  return (
    <div>
      <div className="er-sim-grid">
        {examSimulators.map((exam) => (
          <a
            key={exam.key}
            className="er-sim-card"
            href={variant === 'mode' ? `/cbt?mode=${exam.mode}` : `/cbt/practice?exam=practice-exam-${exam.key}`}
          >
            <span className="er-sim-top">
              <img src={exam.logo} alt="" width={34} height={34} loading="lazy" />
              <span className="er-sim-badge">{exam.mode}</span>
            </span>
            <strong>{exam.title}</strong>
            <small>{exam.desc}</small>
            <span className="er-sim-foot">
              <span>{exam.meta}</span>
              <span className="er-sim-cta">
                {variant === 'mode' ? 'Practice' : 'Start Test'} <ArrowRight size={12} />
              </span>
            </span>
          </a>
        ))}
      </div>
      {showGuides && (
        <div className="er-guide-strip">
          {examSimulators.map((exam) => (
            <a key={exam.key} href={exam.guideHref}>
              {exam.mode === 'POST-UTME' ? 'Post-UTME' : exam.mode} Guide <ArrowRight size={11} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
