import { BookOpen, Download, ExternalLink, FileText, Laptop, Link2Off, MessageCircle, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { SkeletonTiles } from '../src/components/Skeleton';
import { ErrorState, InlineNotice } from '../src/components/AsyncState';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import FilterPills from '../src/components/FilterPills';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import {
  studyMaterialLibrary,
  type StudyMaterialRecord,
} from '../src/data/examPreparation';
import { fetchPastQuestionResources, type PastQuestionLibrary } from '../src/lib/api';

type Filter = 'ALL' | 'JAMB' | 'WAEC' | 'NECO' | 'Post-UTME';

const filters = [
  { id: 'ALL', label: 'All exams' },
  { id: 'JAMB', label: 'JAMB' },
  { id: 'WAEC', label: 'WAEC' },
  { id: 'NECO', label: 'NECO' },
  { id: 'Post-UTME', label: 'Post-UTME' },
];

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  const requestedFilter = params.get('exam');
  // Legacy ?view=cbt links are accepted and ignored: interactive practice
  // lives in the CBT simulators (/cbt/setup/*), not in this document library.
  return {
    search: params.get('q') || '',
    filter: filters.some((item) => item.id === requestedFilter) ? requestedFilter as Filter : 'ALL' as Filter,
  };
}

function materialRequestHref(material: StudyMaterialRecord) {
  const message = [
    'Hello EduReach, I want to get study materials.',
    `School / exam: ${material.school}`,
    `Material: ${material.title}`,
    `Material: ${material.availability === 'on-request' ? 'document request' : 'practice access'}`,
    'Please share the available next step.',
  ].join('\n');
  return `https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export default function PastQuestionsPage() {
  const initial = readQuery();
  const [filter, setFilter] = useState<Filter>(initial.filter);
  const [search, setSearch] = useState(initial.search);
  // PQR-1: the document library comes from the server and starts empty. Nothing
  // is claimed here until a verified paper exists.
  const [library, setLibrary] = useState<PastQuestionLibrary | null>(null);
  const [libraryError, setLibraryError] = useState<unknown>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLibraryLoading(true);
    fetchPastQuestionResources()
      .then((payload) => { if (active) setLibrary(payload); })
      .catch((error) => { if (active) setLibraryError(error); })
      .finally(() => { if (active) setLibraryLoading(false); });
    return () => { active = false; };
  }, []);


  const visibleResources = useMemo(() => {
    const list = library?.items || [];
    const query = search.trim().toLowerCase();
    return list.filter((resource) => {
      const matchesFilter = filter === 'ALL' || resource.examBody.toUpperCase().includes(filter.toUpperCase()) || (filter === 'Post-UTME' && resource.examBody.toUpperCase() === 'POST-UTME');
      if (!matchesFilter) return false;
      if (!query) return true;
      return `${resource.title} ${resource.subject || ''} ${resource.course || ''} ${resource.year || ''}`.toLowerCase().includes(query);
    });
  }, [filter, library, search]);

  const materials = useMemo(() => {
    const query = search.trim().toLowerCase();
    return studyMaterialLibrary.filter((record) => {
      const matchesFilter = filter === 'ALL' || record.exam === filter;
      const searchable = `${record.title} ${record.school} ${record.availability} ${record.subjects}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [filter, search]);

  useEffect(() => {
    if (!search.trim()) return;
    const firstId = materials[0]?.id;
    if (!firstId) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`materials-${firstId}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.classList.add('is-search-focus');
      window.setTimeout(() => target?.classList.remove('is-search-focus'), 1800);
    });
  }, [materials, search]);

  useEffect(() => {
    const syncFromUrl = () => {
      const next = readQuery();
      setFilter(next.filter);
      setSearch(next.search);
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  function updateUrl(nextFilter: Filter, nextSearch: string) {
    const params = new URLSearchParams();
    if (nextFilter !== 'ALL') params.set('exam', nextFilter);
    if (nextSearch.trim()) params.set('q', nextSearch.trim());
    const query = params.toString();
    window.history.replaceState({}, '', query ? `/past-questions?${query}` : '/past-questions');
  }

  function changeFilter(value: string) {
    const nextFilter = value as Filter;
    setFilter(nextFilter);
    updateUrl(nextFilter, search);
  }

  function changeSearch(value: string) {
    setSearch(value);
    updateUrl(filter, value);
  }

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '22px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '980px' }}>
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow" style={{ color: '#b14933' }}>Past questions</span>
              <h1>Past questions &amp; study materials</h1>
              <p>Download or open a published paper, or request one that is not online yet. For timed interactive practice, use the <a href="/cbt">CBT simulators</a>.</p>
            </div>
            <BookOpen size={28} color="#b14933" aria-hidden="true" />
          </div>

          <div className="er-library-toolbar">
            <label className="er-library-search">
              <Search size={17} aria-hidden="true" />
              <span className="er-visually-hidden">Search past questions and materials</span>
              <input value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="Search school, exam, subject or material" aria-label="Search past questions and materials" />
            </label>
            <div className="er-library-filter-label"><SlidersHorizontal size={15} /> Filter</div>
            <FilterPills options={filters} active={filter} onChange={changeFilter} ariaLabel="Past question examination filters" />
          </div>

          <div className="er-late-region er-late-region--library">
          <div className="er-resource-block">
              <div className="er-resource-head">
                <div>
                  <span className="hub-eyebrow">Published papers</span>
                  <h2>Document papers and sources</h2>
                </div>
                {library?.coverage?.length ? (
                  <span className="er-type-meta">
                    {library.coverage.length} exam body{library.coverage.length === 1 ? '' : 'ies'} with published papers
                  </span>
                ) : null}
              </div>

              {libraryLoading && <SkeletonTiles tiles={6} label="Loading published papers" />}

              {!libraryLoading && libraryError !== null && (
                <ErrorState
                  error={libraryError}
                  onRetry={() => {
                    setLibraryError(null);
                    setLibraryLoading(true);
                    fetchPastQuestionResources().then(setLibrary).catch(setLibraryError).finally(() => setLibraryLoading(false));
                  }}
                  compact
                />
              )}

              {!libraryLoading && libraryError === null && visibleResources.length > 0 && (
                <ul className="er-resource-list">
                  {visibleResources.map((resource) => (
                    <li key={resource.id}>
                      <div>
                        <strong>{resource.title}</strong>
                        <span className="er-type-meta">
                          {[resource.examBody, resource.subject, resource.course, resource.year].filter(Boolean).join(' · ')}
                          {resource.verifiedAt ? ` · verified ${new Date(resource.verifiedAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}` : ''}
                        </span>
                      </div>
                      {resource.state === 'available' && resource.href && (
                        <span className="er-resource-actions">
                          <a className="hub-primary-btn" href={resource.href} target="_blank" rel="noopener noreferrer">
                            {resource.access === 'download' ? <><Download size={14} /> Download</> : <><FileText size={14} /> Open paper</>}
                          </a>
                        </span>
                      )}
                      {resource.state === 'external' && resource.href && (
                        <span className="er-resource-actions">
                          <a className="hub-outline-btn" href={resource.href} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={14} /> Open on {resource.sourceName || 'the official site'}
                          </a>
                          <span className="er-type-meta">EduReach does not host this paper.</span>
                        </span>
                      )}
                      {resource.state === 'unavailable' && (
                        <span className="er-resource-unavailable"><Link2Off size={15} /> Not openable right now</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {!libraryLoading && libraryError === null && visibleResources.length === 0 && (
                <InlineNotice tone="info" title={library?.configured === false ? 'The document library is not connected yet' : 'No document papers for this selection yet'}>
                  We don't have a past-question paper for this selection yet. This is not a missing file on your side. You can practise with the timed CBT simulators, or ask EduReach to source a paper. Requests are tracked and you will be told when a verified copy is available.
                </InlineNotice>
              )}
          </div>
          </div>

          {!materials.length ? (
              <div className="hub-panel hub-empty">
                <h2>We don't have study materials for this selection yet</h2>
                <p>Try another examination body or school. EduReach will not claim a document that is not configured. Reach out on WhatsApp if you need help sourcing a paper, and we will tell you when a verified copy is available.</p>
                <a className="hub-primary-btn" href={`https://wa.me/${EDUREACH_WHATSAPP}`} target="_blank" rel="noopener noreferrer">Request a paper</a>
              </div>
            ) : (
              <div className="er-material-grid">
                {materials.map((material) => (
                  <a
                    className={`er-material-card er-material-card-link ${identityClassFor(material.exam, 'service')}`}
                    id={`materials-${material.id}`}
                    key={material.id}
                    href={material.cbtHref || materialRequestHref(material)}
                    {...(material.cbtHref ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                  >
                    <div className="er-material-card-top">
                      <CardIdentityMark value={material.exam} type="service" size="sm" />
                      <span className="er-material-formats">{material.availability === 'on-request' ? 'On request' : 'Practice available'}</span>
                    </div>
                    <h2>{material.title}</h2>
                    <span className="er-material-school-static">{material.school}</span>
                    <p>{material.description}</p>
                    <div className="er-library-subjects"><strong>Subjects</strong><span>{material.subjects}</span></div>
                    <span className="er-material-actions">
                      {material.cbtHref
                        ? <span className="hub-primary-btn er-card-cta"><Laptop size={14} /> Practice CBT</span>
                        : <span className="hub-primary-btn er-card-cta"><MessageCircle size={14} /> Request via EduReach</span>}
                    </span>
                  </a>
                ))}
              </div>
            )}
        </div>
      </div>
    </HubLayout>
  );
}
