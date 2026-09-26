import { ArrowRight, Search as SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import { pastQuestionLibrary, studyMaterialLibrary } from '../src/data/examPreparation';
import { simulatorStartHref } from '../src/components/ExamSimulatorGrid';
import type { CatalogExam } from '../src/lib/cbt-config';
import { services } from '../src/data/services';
import { fetchCbtExams, fetchNews, type NewsItem, trackEvent } from '../src/lib/api';

type SearchResult = {
  id: string;
  title: string;
  description: string;
  category: string;
  href: string;
  identity: string;
};

function readQuery() {
  return new URLSearchParams(window.location.search).get('q')?.trim() || '';
}

function staticResults(exams: CatalogExam[]): SearchResult[] {
  const serviceResults = services.map((service) => ({
    id: `service-${service.key}`,
    title: service.title,
    description: service.description,
    category: service.category,
    href: service.route,
    identity: service.key,
  }));
  const examResults = exams.map((exam) => ({
    id: `exam-${exam.id}`,
    title: exam.title,
    description: exam.description || `Practice ${exam.subject || exam.exam_body} questions.`,
    category: 'CBT Practice',
    href: simulatorStartHref(exam.exam_body, exam.id),
    identity: exam.exam_body,
  }));
    const materialResults = studyMaterialLibrary.map((material) => ({
      id: `material-${material.id}`,
      title: material.title,
      description: `${material.school} · ${material.formats.join(', ')} · request through EduReach.`,
      category: 'Past Questions & Materials',
    href: `/past-questions?view=materials&exam=${encodeURIComponent(material.exam)}&q=${encodeURIComponent(material.school)}`,
    identity: material.exam,
  }));
  const cbtResults = pastQuestionLibrary.map((record) => ({
    id: `bank-${record.id}`,
    title: record.title,
    description: `${record.school} · ${record.subjects}`,
    category: 'CBT Question Bank',
    href: record.href,
    identity: record.exam,
  }));
  return [...serviceResults, ...examResults, ...materialResults, ...cbtResults,
    { id: 'screening-calculator', title: 'Screening Calculator', description: 'Plan an admission aggregate with an honest institution-specific reminder.', category: 'Student Tool', href: '/screening-calculator', identity: 'calculator' },
    { id: 'opportunities', title: 'Student Opportunities & Grants', description: 'Browse the configured opportunities catalogue and its honest unavailable states.', category: 'Opportunities', href: '/jobs', identity: 'opportunities' },
    { id: 'news', title: 'News & Updates', description: 'Read verified and clearly labelled student updates.', category: 'Noticeboard', href: '/news', identity: 'news' },
  ];
}

function resultMatches(result: SearchResult, query: string) {
  const value = `${result.title} ${result.description} ${result.category}`.toLowerCase();
  return value.includes(query.toLowerCase());
}

export default function SearchPage() {
  const lastSearchTrackedRef = useRef('');
  const [query, setQuery] = useState(readQuery);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [exams, setExams] = useState<CatalogExam[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    const term = query.trim();
    if (!term || term === lastSearchTrackedRef.current) return;
    const timer = window.setTimeout(() => {
      lastSearchTrackedRef.current = term;
      trackEvent('search', { metadata: { q: term.slice(0, 120) } });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchNews().catch(() => []), fetchCbtExams().catch(() => [])])
      .then(([newsItems, examItems]) => {
        if (!active) return;
        setNews(newsItems);
        setExams(examItems);
        setLoadingNews(false);
      });
    return () => { active = false; };
  }, []);

  const allResults = useMemo<SearchResult[]>(() => [
    ...staticResults(exams),
    ...news.map((item) => ({
      id: `news-${item.id}`,
      title: item.title,
      description: item.summary || item.body.slice(0, 140),
      category: 'News & Updates',
      href: `/news/${encodeURIComponent(item.slug)}`,
      identity: item.category,
    })),
  ], [news, exams]);

  const results = useMemo(() => {
    const normalized = query.trim();
    if (!normalized) return allResults.slice(0, 12);
    return allResults.filter((result) => resultMatches(result, normalized)).slice(0, 40);
  }, [allResults, query]);

  useEffect(() => {
    if (!query.trim() || !results.length) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById('search-result-0');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.classList.add('is-search-focus');
      window.setTimeout(() => target?.classList.remove('is-search-focus'), 1800);
    });
  }, [query, results]);

  useEffect(() => {
    const syncFromUrl = () => setQuery(readQuery());
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = query.trim();
    const path = normalized ? `/search?q=${encodeURIComponent(normalized)}` : '/search';
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  return (
    <HubLayout>
      <main className="hub-page" style={{ padding: '24px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '940px' }}>
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow" style={{ color: '#C85841' }}>EDUREACH SEARCH</span>
              <h1>{query ? `Search results for “${query}”` : 'Search EduReach'}</h1>
              <p>Find a direct destination across services, CBT, past questions, materials, news and opportunities.</p>
            </div>
          </div>

          <form className="er-site-search-page-form" role="search" onSubmit={submit}>
            <SearchIcon size={18} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services, exams, schools, news or materials" aria-label="Search EduReach" autoFocus />
            <button type="submit">Search</button>
          </form>

          {!query.trim() && <p className="er-search-help">Start typing to search the configured catalogue. Results are direct links; no extra intermediary page is inserted.</p>}
          {!results.length && !loadingNews && <div className="hub-panel hub-empty"><h2>No matching result</h2><p>Try JAMB, WAEC, NELFUND, a service name, a school or “materials”.</p></div>}
          {loadingNews && query.trim() && !results.length && <div className="hub-panel hub-empty">Checking news updates…</div>}

          <div className="er-search-results" aria-live="polite">
            {results.map((result, index) => (
              <a id={`search-result-${index}`} className={`er-search-result ${identityClassFor(result.identity, 'content')}`} href={result.href} key={result.id}>
                <CardIdentityMark value={result.identity} type="content" size="sm" />
                <span className="er-search-result-copy">
                  <small>{result.category}</small>
                  <strong>{result.title}</strong>
                  <span>{result.description}</span>
                </span>
                <ArrowRight size={15} />
              </a>
            ))}
          </div>
        </div>
      </main>
    </HubLayout>
  );
}
