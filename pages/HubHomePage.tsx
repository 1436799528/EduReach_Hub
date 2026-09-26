import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import SectionHead from '../src/components/SectionHead';
import ExamSimulatorGrid from '../src/components/ExamSimulatorGrid';
import { FeaturedNews, NewsRow, TrendingNews } from '../src/components/NewsSections';
import { SkeletonRows } from '../src/components/Skeleton';
import { EDUREACH_WHATSAPP, hubServices } from '../src/data/hubContent';
import { fetchNews, fetchUpcoming, type NewsItem, type UpcomingItem } from '../src/lib/api';

function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function LinkTile({ title, href, external = false }: { title: string; href: string; external?: boolean }) {
  return (
    <a
      className={`er-mini-link ${identityClassFor(title, 'service')}`}
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <CardIdentityMark value={title} type="service" size="sm" />
      <span>{title}</span>
      <ArrowRight size={13} />
    </a>
  );
}

function Deadline({ item }: { item: UpcomingItem }) {
  const date = item.due_at || item.starts_at;
  return (
    <div className="er-deadline">
      <div className="er-date">
        <strong>{date ? new Date(date).getDate() : '—'}</strong>
        <small>{date ? new Date(date).toLocaleDateString('en-NG', { month: 'short' }) : 'Soon'}</small>
      </div>
      <span><small>{item.kind}</small><strong>{item.title}</strong></span>
    </div>
  );
}

const toolTiles = [
  { title: 'Past Question Library', href: '/past-questions' },
  { title: 'Screening Calculator', href: '/screening-calculator' },
  { title: 'Scholarships', href: '/jobs' },
];

export default function HubHomePage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');
  const [feedVersion, setFeedVersion] = useState(0);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [upcomingError, setUpcomingError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    setNewsLoading(true);
    setNewsError('');
    void fetchNews()
      .then((items) => active && setNews(items))
      .catch((value) => active && setNewsError(value instanceof Error ? value.message : 'Unable to load news updates.'))
      .finally(() => active && setNewsLoading(false));
    setUpcomingError('');
    void fetchUpcoming()
      .then((items) => active && setUpcoming(items))
      .catch((value) => active && setUpcomingError(value instanceof Error ? value.message : 'Unable to load upcoming events.'));
    return () => { active = false; };
  }, [feedVersion]);

  return (
    <HubLayout>
      <div className="er-portal">
        <div className="er-container">
          <h1 className="er-visually-hidden">EduReach Hub student services, CBT practice and education updates</h1>
          <form className="er-search" onSubmit={(e) => {
            e.preventDefault();
            if (search.trim()) navigateInApp(`/search?q=${encodeURIComponent(search.trim())}`);
          }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services — NELFUND, result checking, JAMB slips…"
              aria-label="Search services"
            />
            <button type="submit">Search</button>
          </form>

          <a href="/past-questions" className="er-banner">
            <div className="er-banner-art">
              <img src="/news/photos/jamb-cbt.jpg" alt="CBT study centre" />
            </div>
            <div>
              <small>EDUREACH STUDY CENTRE</small>
              <strong>Past Questions &amp; CBT Practice</strong>
              <p>Timed JAMB, WAEC, NECO and Post-UTME practice.</p>
            </div>
            <ArrowRight size={18} />
          </a>

          <section className="er-section">
            <SectionHead title="CBT Simulators" href="/cbt" linkLabel="All question banks" />
            <ExamSimulatorGrid variant="start" showGuides />
          </section>

          <section className="er-section">
            <SectionHead title="Study Tools" href="/screening-calculator" linkLabel="Calculator" />
            <div className="er-test-strip">
              {toolTiles.map((tile) => <LinkTile key={tile.title} title={tile.title} href={tile.href} />)}
            </div>
          </section>

          <section className="er-section">
            <SectionHead title="Featured Updates" href="/news" linkLabel="Noticeboard" />
            <FeaturedNews items={news} />
            {newsError && (
              <div className="er-empty" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span>{newsError}</span>
                <button type="button" className="hub-outline-btn" onClick={() => setFeedVersion((value) => value + 1)} disabled={newsLoading}>Try again</button>
              </div>
            )}
            {!news.length && !newsLoading && !newsError && <div className="er-empty">No news content available yet. Published updates appear here as soon as they are ready.</div>}
          </section>

          <div className="er-two-col">
            <section className="er-section">
              <SectionHead title="Latest Educational News" href="/news" linkLabel="View all" />
              <div className="er-news-list">
                {news.slice(0, 6).map((item) => <NewsRow key={item.id} item={item} />)}
                {!news.length && newsLoading && <SkeletonRows rows={4} label="Loading news" />}
                {!news.length && !newsLoading && !newsError && <div className="er-empty">No news content available yet. Published updates appear here as soon as they are ready.</div>}
              </div>
            </section>

            <div>
              <section className="er-section">
                <SectionHead title="Upcoming events" />
                {upcomingError ? (
                  <div className="er-empty" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <span>{upcomingError}</span>
                    <button type="button" className="hub-outline-btn" onClick={() => setFeedVersion((value) => value + 1)}>Try again</button>
                  </div>
                ) : upcoming.length > 0 ? (
                  <div className="er-deadline-list">
                    {upcoming.slice(0, 6).map((item) => <Deadline key={item.id} item={item} />)}
                  </div>
                ) : (
                  <div className="er-empty">No upcoming events have been published yet.</div>
                )}
              </section>

              <section className="er-section">
                <SectionHead title="Trending" href="/news" linkLabel="More" />
                <TrendingNews items={news} limit={5} />
                {!news.length && !newsLoading && !newsError && <div className="er-empty">Trending stories will appear here once news is published.</div>}
              </section>
            </div>
          </div>

          <section className="er-section">
            <SectionHead title="Student services" href="/services" linkLabel="All services" />
            <div className="er-link-grid">
              {hubServices.map((item) => (
                <LinkTile key={item.slug} title={item.short} href={`/services/apply/${item.slug}`} />
              ))}
              <LinkTile title="Student Support" href={`https://wa.me/${EDUREACH_WHATSAPP}`} external />
            </div>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
