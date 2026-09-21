import { ArrowRight, Calculator, ScanSearch, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import SectionHead from '../src/components/SectionHead';
import ExamSimulatorGrid from '../src/components/ExamSimulatorGrid';
import { FeaturedNews, NewsRow, TrendingNews } from '../src/components/NewsSections';
import { services, type ServiceDefinition } from '../src/data/services';
import { fetchNews, fetchUpcoming, type NewsItem, type UpcomingItem } from '../src/lib/api';

const service = (key: string) => services.find((item) => item.key === key);

function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function LinkTile({ title, href }: { title: string; href: string }) {
  return (
    <a className="er-mini-link" href={href}>
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
  { title: 'Past Question Bank', href: '/cbt' },
  { title: 'Screening Calculator', href: '/screening-calculator' },
  { title: 'Track Request', href: '/services/track' },
  { title: 'Scholarships', href: '/scholarships' },
];

export default function HubHomePage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    void fetchNews().then((items) => active && setNews(items)).catch(() => {});
    void fetchUpcoming().then((items) => active && setUpcoming(items)).catch(() => {});
    return () => { active = false; };
  }, []);

  const admission = useMemo(
    () => ['school-finder', 'course-finder', 'admission-requirements', 'admission-consultation'].map(service).filter(Boolean) as ServiceDefinition[],
    [],
  );
  const fundingTools = useMemo(
    () => ['nelfund', 'scholarships', 'school-fees', 'support'].map(service).filter(Boolean) as ServiceDefinition[],
    [],
  );

  return (
    <HubLayout>
      <div className="er-portal">
        <div className="er-container">
          <form className="er-search" onSubmit={(e) => {
            e.preventDefault();
            if (search.trim()) navigateInApp(`/services?q=${encodeURIComponent(search.trim())}`);
          }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schools, courses, JAMB, WAEC, scholarships..."
              aria-label="Search services"
            />
            <button type="submit">Search</button>
          </form>

          <a href="/cbt" className="er-banner">
            <div className="er-banner-art">
              <img src="/news/photos/jamb-cbt.jpg" alt="CBT study centre" />
            </div>
            <div>
              <small>EDUREACH STUDY CENTRE</small>
              <strong>Past Questions &amp; CBT Practice</strong>
              <p>Prepare by examination, subject, school and year.</p>
            </div>
            <ArrowRight size={18} />
          </a>

          <section className="er-section">
            <SectionHead title="CBT Simulators" href="/cbt" linkLabel="Open CBT hall" />
            <ExamSimulatorGrid variant="mode" showGuides />
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
            {!news.length && <div className="er-empty">News updates will appear here.</div>}
          </section>

          <div className="er-two-col">
            <section className="er-section">
              <SectionHead title="Latest Educational News" href="/news" linkLabel="View all" />
              <div className="er-news-list">
                {news.slice(0, 6).map((item) => <NewsRow key={item.id} item={item} />)}
                {!news.length && <div className="er-empty">News updates will appear here.</div>}
              </div>
            </section>

            <div>
              <section className="er-section">
                <SectionHead title="Upcoming" href="/news" linkLabel="Calendar" />
                {upcoming.length > 0 ? (
                  <div className="er-deadline-list">
                    {upcoming.slice(0, 6).map((item) => <Deadline key={item.id} item={item} />)}
                  </div>
                ) : (
                  <div className="er-tool-fallback">
                    <a href="/services/track">
                      <ScanSearch size={16} />
                      <span>Track a request<small>Live status for any reference code</small></span>
                    </a>
                    <a href="/screening-calculator">
                      <Calculator size={16} />
                      <span>Screening calculator<small>Estimate your admission aggregate</small></span>
                    </a>
                    <a href="/cbt">
                      <Trophy size={16} />
                      <span>CBT practice<small>Timed JAMB, WAEC &amp; NECO tests</small></span>
                    </a>
                  </div>
                )}
              </section>

              <section className="er-section">
                <SectionHead title="Trending" href="/news" linkLabel="More" />
                <TrendingNews items={news} limit={5} />
                {!news.length && <div className="er-empty">Trending stories will appear here.</div>}
              </section>
            </div>
          </div>

          <section className="er-section">
            <SectionHead title="Admission &amp; Schools" href="/admission" linkLabel="Explore" />
            <div className="er-link-grid">
              {admission.map((item) => <LinkTile key={item.key} title={item.title} href={item.route} />)}
            </div>
          </section>

          <section className="er-section">
            <SectionHead title="Funding &amp; Support" href="/services" linkLabel="Explore" />
            <div className="er-link-grid">
              {fundingTools.map((item) => <LinkTile key={item.key} title={item.title} href={item.route} />)}
            </div>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
