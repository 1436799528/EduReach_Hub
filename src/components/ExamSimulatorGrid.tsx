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
    meta: 'Timed • 30 mins',
    guideHref: '/jamb',
  },
  {
    key: 'waec',
    title: 'WAEC CBT Practice',
    mode: 'WAEC',
    logo: '/icons/brands/waec.webp',
    desc: 'SSCE revision across English, Maths and sciences.',
    meta: 'Timed • 45 mins',
    guideHref: '/waec',
  },
  {
    key: 'neco',
    title: 'NECO CBT Practice',
    mode: 'NECO',
    logo: '/icons/brands/neco.webp',
    desc: 'SSCE practice papers by syllabus objective.',
    meta: 'Timed • 40 mins',
    guideHref: '/neco',
  },
  {
    key: 'post-utme',
    title: 'Post-UTME Screening Tests',
    mode: 'POST-UTME',
    logo: '/icons/brands/jamb.png',
    desc: 'Screening aptitude tests for federal and state schools.',
    meta: 'Timed • 25 mins',
    guideHref: '/post-utme',
  },
];

/** Direct-start URL for a simulator card: no intermediate hall page. */
export function simulatorStartHref(key: string) {
  return `/cbt/practice?exam=practice-exam-${key}`;
}

/**
 * Shared Myschool-style exam simulator grid. Every card starts its simulator
 * directly (/cbt/practice?exam=…); variant="mode" is kept for catalog contexts
 * that deliberately want the filtered question-bank list (/cbt?mode=X).
 *
 * Layout lives in edu-portal.css: 4-up vertical cards on desktop; on mobile the
 * same cards turn horizontal and sit in a 2-row swipe strip (Myschool "Take a
 * test" pattern) with the next column peeking in from the right edge.
 */
export default function ExamSimulatorGrid({
  variant = 'start',
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
            className={`er-sim-card er-sim-${exam.key}`}
            href={variant === 'mode' ? `/cbt?mode=${exam.mode}` : simulatorStartHref(exam.key)}
          >
            <span className="er-sim-top">
              <img src={exam.logo} alt="" width={40} height={40} loading="lazy" />
              <span className="er-sim-badge">{exam.mode}</span>
            </span>
            <span className="er-sim-body">
              <strong>{exam.title}</strong>
              <small>{exam.desc}</small>
              <span className="er-sim-foot">
                <span>{exam.meta}</span>
                <span className="er-sim-cta">
                  {variant === 'mode' ? 'Practice' : 'Start Test'} <ArrowRight size={12} />
                </span>
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
