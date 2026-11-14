import { userFacingError } from '../lib/errors';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import SectionHead from '../src/components/SectionHead';
import ExamSimulatorGrid from '../src/components/ExamSimulatorGrid';
import { NewsCard } from '../src/components/NewsSections';
import { isArticleCurrent } from '../src/lib/newsFreshness';
import { SkeletonRows } from '../src/components/Skeleton';
import { fetchNews, type NewsItem } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import SiteSearch from '../src/components/LazySiteSearch';

// The resume card is for signed-in students with an unfinished paper. Loading
// it after the shell keeps a convenience out of the first-paint bundle.
const ContinuePracticeCard = lazy(() => import('../src/components/ContinuePracticeCard'));

// The home page is the simulator's front door, not a magazine cover. It keeps
// three things above the fold: what the site is for, the exam a student is
// sitting, and a way in. News sits below the practice tools and shows three
// headlines; anything more belongs on /news.

// The study tools reuse the MySchool link tile that the home page already had
// (er-mini-link + the shared identity mark): same card, same edge, same hover.
// The simulator-first layout changed the order of the page, not the card design.
const toolTiles = [
  { title: 'Past questions', href: '/past-questions' },
  { title: 'Screening calculator', href: '/screening-calculator' },
  { title: 'CGPA calculator', href: '/tools/cgpa-calculator' },
];

// The three main exam bodies live on the home page by name. Keeping this as a
// tiny local list (rather than importing the whole study-material catalogue)
// keeps the home route out of the library data chunk.
const mainExamMaterials = [
  { exam: 'JAMB', title: 'JAMB past questions' },
  { exam: 'WAEC', title: 'WAEC past questions' },
  { exam: 'NECO', title: 'NECO past questions' },
];

function LinkTile({ title, href }: { title: string; href: string }) {
  return (
    <a className={`er-mini-link ${identityClassFor(title, 'service')}`} href={href}>
      <CardIdentityMark value={title} type="service" size="sm" />
      <span>{title}</span>
      <ArrowRight size={13} />
    </a>
  );
}

export default function HubHomePage() {
  const { isAuthenticated } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');
  const [feedVersion, setFeedVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setNewsLoading(true);
    setNewsError('');
    void fetchNews()
      .then((items) => active && setNews(items))
      .catch((value) => active && setNewsError(userFacingError(value, 'Unable to load updates.')))
      .finally(() => active && setNewsLoading(false));
    return () => { active = false; };
  }, [feedVersion]);

  // Only current stories reach the home feed; expired notices are removed, and
  // the newest published items come first.
  const latestNews = news
    .filter(isArticleCurrent)
    .sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime())
    .slice(0, 4);

  return (
    <HubLayout>
      <div className="er-portal">
        <div className="er-container hub-home-container">
          {/* The page keeps one heading for structure and screen readers, as the
              homepage did before the simulator rewrite. The visible title is the
              page bar and the sections below it; there is no promotional hero. */}
          <h1 className="er-visually-hidden">EduReach Hub CBT practice, past questions and student services</h1>

          <SiteSearch
            variant="home"
            label="Search services and study resources"
            placeholder="Search services, subjects, exams or news"
          />

          {/* The study-centre card is one click to the past-question library.
              No start-practice button, no PDF list: the card is the link. */}
          <a href="/past-questions" className="er-banner">
            <div className="er-banner-art">
              <img src="/news/photos/jamb-cbt-banner.webp" alt="CBT study centre" width={160} height={80} loading="lazy" decoding="async" />
            </div>
            <div>
              <small>EDUREACH STUDY CENTRE</small>
              <strong>Past questions &amp; CBT practice</strong>
              <p>Timed JAMB, WAEC, NECO and Post-UTME practice.</p>
            </div>
            <ArrowRight size={18} />
          </a>

          {isAuthenticated && (
            <Suspense fallback={null}>
              <ContinuePracticeCard />
            </Suspense>
          )}

          <section className="er-section">
            <SectionHead title="Choose your exam" />
            <ExamSimulatorGrid variant="start" />
          </section>

          <section className="er-section">
            <SectionHead title="Exam materials" href="/past-questions" linkLabel="All materials" />
            <div className="er-exam-materials">
              {mainExamMaterials.map((material) => (
                <a className="er-exam-material" key={material.exam} href={`/past-questions?exam=${encodeURIComponent(material.exam)}`}>
                  <small>{material.exam}</small>
                  <strong>{material.title}</strong>
                  <span className="er-card-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
                </a>
              ))}
            </div>
          </section>

          <section className="er-section">
            <SectionHead title="Study tools" />
            <div className="er-test-strip">
              {toolTiles.map((tile) => <LinkTile key={tile.title} title={tile.title} href={tile.href} />)}
            </div>
          </section>

          <section className="er-section">
            <SectionHead title="Updates" href="/news" linkLabel="All updates" />
            <div className="er-late-region er-late-region--feed">
              {newsError ? (
                <div className="er-empty" role="alert">
                  <span>{newsError}</span>
                  <button type="button" className="hub-outline-btn" onClick={() => setFeedVersion((value) => value + 1)}>
                    <RefreshCw size={13} /> Try again
                  </button>
                </div>
              ) : latestNews.length ? (
                <div className="er-news-card-grid">
                  {latestNews.map((item) => <NewsCard key={item.id} item={item} />)}
                </div>
              ) : newsLoading ? (
                <SkeletonRows rows={4} label="Loading updates" />
              ) : (
                <div className="er-empty">No updates have been published yet.</div>
              )}
            </div>
          </section>

          <div className="hub-home-footer-callout">
            <div>
              <h2>Need a student service?</h2>
              <p>Check your results, request a JAMB slip or apply for NELFUND.</p>
            </div>
            <a className="hub-outline-btn" href="/services">Browse services <ArrowRight size={13} /></a>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
