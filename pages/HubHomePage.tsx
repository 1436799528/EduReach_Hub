import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Calculator,
  FileText,
  GraduationCap,
  Laptop,
  PlayCircle,
  School,
  type LucideIcon,
} from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import SectionHead from '../src/components/SectionHead';
import ExamSimulatorGrid from '../src/components/ExamSimulatorGrid';
import SiteSearch from '../src/components/LazySiteSearch';
import { useAuth } from '../src/lib/auth';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { cbtAttemptState } from '../src/lib/dashboardPriority';
import {
  homeAttemptHref,
  homeAttemptLabel,
  readLocalHomeAttempts,
  recentHomeAttempts,
  summarizeHomeActivity,
  type HomeAttempt,
} from '../src/lib/homeActivity';

// The resume card is for signed-in students with an unfinished paper. Loading
// it after the shell keeps a convenience out of the first-paint bundle.
const ContinuePracticeCard = lazy(() => import('../src/components/ContinuePracticeCard'));

const toolLinks: Array<{ title: string; href: string; Icon: LucideIcon }> = [
  { title: 'Screening calculator', href: '/screening-calculator', Icon: Calculator },
  { title: 'CGPA calculator', href: '/tools/cgpa-calculator', Icon: GraduationCap },
  { title: 'School finder', href: '/schools', Icon: School },
];

function shortDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

function subjectCount(attempt: HomeAttempt): number | null {
  for (const raw of [attempt.selected_subjects, attempt.subject_plan]) {
    if (Array.isArray(raw)) return raw.length;
    if (raw && typeof raw === 'object') return Object.keys(raw).length;
  }
  return null;
}

/**
 * UX-7 - the home screen is the product's first screen, not a landing page.
 *
 * It answers, in this order: who am I here (greeting), what can I do now
 * (practice, past questions, My CBT, results), what has already happened
 * (record and recent activity), and which exam am I sitting (catalogue).
 * There is no hero, slogan, proof strip or promotional section; every block is
 * a control the student can act on.
 */
export default function HubHomePage() {
  const { user, isAuthenticated } = useAuth();
  const [attempts, setAttempts] = useState<HomeAttempt[]>([]);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || !user?.id) {
      setAttempts([]);
      return () => { active = false; };
    }
    if (!isSupabaseConfigured) {
      setAttempts(readLocalHomeAttempts());
      return () => { active = false; };
    }
    void supabase
      .from('cbt_attempts')
      .select('id,status,mode,exam_id,score,selected_subjects,subject_plan,total_questions,created_at,submitted_at,expires_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        // A summary is a convenience, never an error page.
        if (active && !error && Array.isArray(data)) setAttempts(data as HomeAttempt[]);
      });
    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  const summary = useMemo(() => summarizeHomeActivity(attempts), [attempts]);
  const recent = useMemo(() => recentHomeAttempts(attempts, 3), [attempts]);
  const firstName = user?.name?.split(/\s+/)[0] || 'Student';
  const hasRecord = summary.papers > 0 || recent.length > 0;
  const myCbtHref = isAuthenticated ? '/dashboard/cbt' : '/login';
  const resultsHref = isAuthenticated ? '/dashboard/cbt/results' : '/login';

  return (
    <HubLayout>
      <div className="er-portal">
        <div className="er-container hub-home-container er-home-app">
          {/* One h1 for structure and screen readers. The visible greeting is an
              h2 because it is the first section of an application screen. */}
          <h1 className="er-visually-hidden">EduReach Hub CBT practice, past questions and student services</h1>

          <header className="er-home-head">
            <div className="er-home-head-copy">
              <p className="er-home-eyebrow">Home</p>
              <h2 className="er-home-greeting" id="er-home-title">
                {isAuthenticated ? `Welcome back, ${firstName}.` : 'What are you studying for?'}
              </h2>
              <p className="er-home-lede">
                {isAuthenticated
                  ? 'Pick up a paper, check a result, or start a new one.'
                  : 'Practise a timed paper or revise by subject. You can start without an account.'}
              </p>
            </div>
            <div className="er-home-head-search">
              <SiteSearch
                variant="home"
                label="Search services and study resources"
                placeholder="Search services or exams"
              />
            </div>
          </header>

          {/* Four controls, one primary. Position and colour carry the
              hierarchy; none of them needs a whole card. */}
          <section className="er-home-start" aria-label="Start studying">
            <a className="er-home-primary" href="/cbt">
              <span className="er-home-primary-mark" aria-hidden="true"><PlayCircle size={22} /></span>
              <span className="er-home-primary-copy">
                <strong>Start practice</strong>
                <small>Timed paper at exam pace, result saved</small>
              </span>
              <ArrowRight size={18} className="er-home-primary-arrow" aria-hidden="true" />
            </a>
            <div className="er-home-tiles">
              <a className="er-home-tile" href="/past-questions">
                <FileText size={18} aria-hidden="true" />
                <span><strong>Past questions</strong><small>By exam and subject</small></span>
              </a>
              <a className="er-home-tile" href={myCbtHref}>
                <Laptop size={18} aria-hidden="true" />
                <span><strong>My CBT</strong><small>{isAuthenticated ? 'Continue or review' : 'Sign in to continue'}</small></span>
              </a>
              <a className="er-home-tile" href={resultsHref}>
                <BarChart3 size={18} aria-hidden="true" />
                <span><strong>Results</strong><small>Scores and attempts</small></span>
              </a>
            </div>
          </section>

          {isAuthenticated && hasRecord && (
            <section className="er-home-record" aria-label="Your practice record">
              <div><strong>{summary.papers}</strong><span>Papers completed</span></div>
              <div><strong>{summary.averageScore === null ? '—' : `${summary.averageScore}%`}</strong><span>Average score</span></div>
              <div><strong>{summary.bestScore === null ? '—' : `${summary.bestScore}%`}</strong><span>Best score</span></div>
              <div><strong>{summary.subjects || '—'}</strong><span>Subjects practised</span></div>
            </section>
          )}

          {isAuthenticated && (
            <section className="er-section er-home-recent" aria-label="Recent activity">
              <SectionHead title="Recent activity" href="/dashboard/cbt" linkLabel="All results" />
              <Suspense fallback={null}>
                <ContinuePracticeCard />
              </Suspense>
              {recent.length ? (
                <ul className="er-home-activity">
                  {recent.map((attempt) => {
                    const state = cbtAttemptState(attempt);
                    const subjects = subjectCount(attempt);
                    const date = shortDate(attempt.submitted_at || attempt.created_at);
                    const score = typeof attempt.score === 'number' ? Math.round(attempt.score) : null;
                    return (
                      <li key={attempt.id}>
                        <a href={homeAttemptHref(attempt)}>
                          <span className="er-home-activity-mark" aria-hidden="true"><BookOpenCheck size={16} /></span>
                          <span className="er-home-activity-copy">
                            <strong>{homeAttemptLabel(attempt)}</strong>
                            <small>
                              {state === 'active' ? 'In progress' : state === 'expired' ? 'Expired' : date || 'Finished'}
                              {subjects ? ` · ${subjects} ${subjects === 1 ? 'subject' : 'subjects'}` : ''}
                            </small>
                          </span>
                          <span className={`er-home-activity-score${score === null ? ' is-empty' : ''}`}>
                            {score === null ? '—' : `${score}%`}
                          </span>
                          <ArrowRight size={14} aria-hidden="true" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="er-home-empty">
                  No papers yet. Finish a practice test and it will appear here.
                </p>
              )}
            </section>
          )}

          <section className="er-section" aria-label="Choose your exam">
            <SectionHead title="Choose your exam" />
            <ExamSimulatorGrid variant="start" />
          </section>

          <section className="er-section" aria-label="Study tools">
            <SectionHead title="Study tools" />
            <ul className="er-home-tool-list">
              {toolLinks.map(({ title, href, Icon }) => (
                <li key={href}>
                  <a href={href}>
                    <Icon size={16} aria-hidden="true" />
                    <span>{title}</span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
