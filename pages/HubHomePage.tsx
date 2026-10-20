import { userFacingError } from '../lib/errors';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import SectionHead from '../src/components/SectionHead';
import ExamSimulatorGrid from '../src/components/ExamSimulatorGrid';
import { NewsRow } from '../src/components/NewsSections';
import { SkeletonRows } from '../src/components/Skeleton';
import { fetchNews, type NewsItem } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';

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

  return (
    <HubLayout>
      <div className="er-portal">
        <div className="er-container hub-home-container">
          <section className="hub-home-intro">
            <div>
              <span className="hub-eyebrow">CBT practice</span>
              <h1>Practise the exam you are sitting.</h1>
              <p>JAMB, WAEC, NECO and Post-UTME. Choose your subjects, set the number of questions and start a timed paper.</p>
              <div className="hub-home-actions">
                <a className="hub-home-cta" href="/cbt">Start practising <ArrowRight size={14} aria-hidden="true" /></a>
                <a className="hub-home-cta" href="/past-questions">Past questions <ArrowRight size={14} aria-hidden="true" /></a>
              </div>
            </div>
          </section>

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
              ) : news.length ? (
                <div className="hub-home-updates">
                  {news.slice(0, 3).map((item) => <NewsRow key={item.id} item={item} />)}
                </div>
              ) : newsLoading ? (
                <SkeletonRows rows={3} label="Loading updates" />
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
