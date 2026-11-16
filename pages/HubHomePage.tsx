import { Suspense, lazy } from 'react';
import {
  ArrowRight,
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
import { SkeletonRows } from '../src/components/Skeleton';
import { useAuth } from '../src/lib/auth';

// Keep secondary, data-backed sections out of the initial route chunk.
const HomeNewsSection = lazy(() => import('../src/components/HomeNewsSection'));

const toolLinks: Array<{ title: string; href: string; Icon: LucideIcon }> = [
  { title: 'Screening calculator', href: '/screening-calculator', Icon: Calculator },
  { title: 'CGPA calculator', href: '/tools/cgpa-calculator', Icon: GraduationCap },
  { title: 'School finder', href: '/schools', Icon: School },
];

/** The home screen offers study actions and current public information only. */
export default function HubHomePage() {
  const { isAuthenticated } = useAuth();
  const myCbtHref = isAuthenticated ? '/dashboard/cbt' : '/login';

  return (
    <HubLayout>
      <div className="er-portal">
        <div className="hub-home-container er-home-app">
          <h1 className="er-visually-hidden">EduReach Hub CBT practice, past questions and student services</h1>

          <header className="er-home-head">
            <div className="er-home-head-copy">
              <p className="er-home-eyebrow">Home</p>
              <h2 className="er-home-greeting" id="er-home-title">
                What are you studying for?
              </h2>
              <p className="er-home-lede">
                {isAuthenticated
                  ? 'Choose a practice paper or explore the latest updates.'
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

          <section className="er-home-start" aria-label="Start studying">
            <a className="er-home-primary" href="/cbt">
              <span className="er-home-primary-mark" aria-hidden="true"><PlayCircle size={22} /></span>
              <span className="er-home-primary-copy">
                <strong>Start practice</strong>
                <small>Choose a question bank and build a timed paper</small>
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
                <span><strong>My CBT</strong><small>{isAuthenticated ? 'Your practice papers' : 'Sign in to continue'}</small></span>
              </a>
            </div>
          </section>

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

          <Suspense fallback={(
            <section className="er-section er-home-news" aria-label="Latest news">
              <SectionHead title="Latest news" href="/news" linkLabel="All news" />
              <div className="er-late-region er-late-region--feed">
                <SkeletonRows rows={3} label="Loading latest news" />
              </div>
            </section>
          )}>
            <HomeNewsSection />
          </Suspense>
        </div>
      </div>
    </HubLayout>
  );
}
