import { userFacingError } from '../lib/errors';
import { ArrowRight, BookOpen, Download, ExternalLink, FileText, Laptop, Link2Off, MessageCircle, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SkeletonTiles } from '../src/components/Skeleton';
import HubLayout from '../src/components/HubLayout';
import { EmptyState, ErrorState, InlineNotice } from '../src/components/AsyncState';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import FilterPills from '../src/components/FilterPills';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import {
  pastQuestionLibrary,
  studyMaterialLibrary,
  type StudyMaterialRecord,
} from '../src/data/examPreparation';
import { fetchCbtExams, fetchPastQuestionResources, type PastQuestionLibrary } from '../src/lib/api';
import { isSupabaseConfigured } from '../src/lib/supabase';

type Filter = 'ALL' | 'JAMB' | 'WAEC' | 'NECO' | 'Post-UTME';
type LibraryView = 'CBT' | 'MATERIALS';

const filters = [
  { id: 'ALL', label: 'All banks' },
  { id: 'JAMB', label: 'JAMB' },
  { id: 'WAEC', label: 'WAEC' },
  { id: 'NECO', label: 'NECO' },
  { id: 'Post-UTME', label: 'Post-UTME' },
];

type BankGroup = 'JAMB' | 'WAEC' | 'NECO' | 'Post-UTME';

type CbtBankRecord = {
  id: string;
  title: string;
  exam: BankGroup;
  school: string;
  year: string;
  subjects: string;
  description: string;
  href: string;
};

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view')?.toUpperCase();
  const requestedFilter = params.get('exam');
  return {
    search: params.get('q') || '',
    view: requestedView === 'MATERIALS' ? 'MATERIALS' as LibraryView : 'CBT' as LibraryView,
    filter: filters.some((item) => item.id === requestedFilter) ? requestedFilter as Filter : 'ALL' as Filter,
  };
}

function setupKeyForExamBody(value: string): 'jamb' | 'waec' | 'neco' | 'post-utme' | null {
  const normalized = value.toLowerCase();
  if (normalized.includes('post-utme') || normalized.includes('postutme')) return 'post-utme';
  if (normalized.includes('waec')) return 'waec';
  if (normalized.includes('neco')) return 'neco';
  if (normalized.includes('jamb') || normalized.includes('utme')) return 'jamb';
  return null;
}

function bankGroupForExamBody(value: string): Exclude<Filter, 'ALL'> {
  const key = setupKeyForExamBody(value);
  if (key === 'post-utme') return 'Post-UTME';
  if (key === 'waec') return 'WAEC';
  if (key === 'neco') return 'NECO';
  return 'JAMB';
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
  const [view, setView] = useState<LibraryView>(initial.view);
  const [filter, setFilter] = useState<Filter>(initial.filter);
  const [search, setSearch] = useState(initial.search);
  const [banks, setBanks] = useState<CbtBankRecord[] | null>(null);
  const [banksError, setBanksError] = useState('');
  // PQR-1: the document library comes from the server and starts empty. Nothing
  // is claimed here until a verified paper exists.
  const [library, setLibrary] = useState<PastQuestionLibrary | null>(null);
  const [libraryError, setLibraryError] = useState<unknown>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);

  // The CBT tab is database-driven in production: every card maps to a real
  // `cbt_exams` row managed in the Admin CBT console. The static library only
  // renders in an unconfigured local preview (documented dev fallback).
  useEffect(() => {
    let active = true;
    setLibraryLoading(true);
    fetchPastQuestionResources()
      .then((payload) => { if (active) setLibrary(payload); })
      .catch((error) => { if (active) setLibraryError(error); })
      .finally(() => { if (active) setLibraryLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setBanks(pastQuestionLibrary.map((record) => ({ ...record })));
      return;
    }
    fetchCbtExams()
      .then((exams) => {
        if (!active) return;
        setBanks(exams.map((exam) => {
          const setupKey = setupKeyForExamBody(`${exam.exam_body} ${exam.title}`);
          return {
            id: exam.id,
            title: exam.title,
            exam: bankGroupForExamBody(`${exam.exam_body} ${exam.title}`),
            school: exam.exam_body,
            year: 'Practice set',
            subjects: exam.subject,
            description: exam.description || `${exam.exam_body} ${exam.subject} practice bank.`,
            href: setupKey
              ? `/cbt/setup/${setupKey}?exam=${encodeURIComponent(exam.id)}`
              : `/cbt/practice?exam=${encodeURIComponent(exam.id)}`,
          };
        }));
      })
      .catch((value) => {
        if (!active) return;
        setBanks([]);
        setBanksError(userFacingError(value, 'Unable to load the CBT catalogue.'));
      });
    return () => { active = false; };
  }, []);

  const records = useMemo(() => {
    const list = banks || [];
    const query = search.trim().toLowerCase();
    return list.filter((record) => {
      const matchesFilter = filter === 'ALL' || record.exam === filter;
      const searchable = `${record.title} ${record.school} ${record.year} ${record.subjects}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [banks, filter, search]);

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
    const firstId = view === 'CBT' ? records[0]?.id : materials[0]?.id;
    if (!firstId) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`${view.toLowerCase()}-${firstId}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.classList.add('is-search-focus');
      window.setTimeout(() => target?.classList.remove('is-search-focus'), 1800);
    });
  }, [materials, records, search, view]);

  useEffect(() => {
    const syncFromUrl = () => {
      const next = readQuery();
      setView(next.view);
      setFilter(next.filter);
      setSearch(next.search);
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  function updateUrl(nextView: LibraryView, nextFilter: Filter, nextSearch: string) {
    const params = new URLSearchParams();
    if (nextView !== 'CBT') params.set('view', nextView.toLowerCase());
    if (nextFilter !== 'ALL') params.set('exam', nextFilter);
    if (nextSearch.trim()) params.set('q', nextSearch.trim());
    const query = params.toString();
    window.history.replaceState({}, '', query ? `/past-questions?${query}` : '/past-questions');
  }

  function changeView(nextView: LibraryView) {
    setView(nextView);
    updateUrl(nextView, filter, search);
  }

  function changeFilter(value: string) {
    const nextFilter = value as Filter;
    setFilter(nextFilter);
    updateUrl(view, nextFilter, search);
  }

  function changeSearch(value: string) {
    setSearch(value);
    updateUrl(view, filter, value);
  }

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '22px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '980px' }}>
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow" style={{ color: '#b14933' }}>QUESTION LIBRARY</span>
              <h1>Past questions &amp; study materials</h1>
              <p>Choose between timed CBT practice and EduReach material requests. Coverage reflects what is actually configured — unavailable papers are never invented.</p>
            </div>
            <BookOpen size={28} color="#b14933" aria-hidden="true" />
          </div>

          <div className="er-library-tabs" role="tablist" aria-label="Past question formats">
            <button type="button" role="tab" aria-selected={view === 'CBT'} className={view === 'CBT' ? 'active' : ''} onClick={() => changeView('CBT')}>
              <Laptop size={16} /> CBT practice
            </button>
            <button type="button" role="tab" aria-selected={view === 'MATERIALS'} className={view === 'MATERIALS' ? 'active' : ''} onClick={() => changeView('MATERIALS')}>
              <FileText size={16} /> Papers &amp; materials
            </button>
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

          <div className="er-library-note" role="note">
            <strong>{view === 'CBT' ? 'CBT route' : 'Materials route'}</strong>
            <span>
              {view === 'CBT'
                ? 'Choose a configured bank to set your subjects or school before entering the timed hall. The calculator remains inside the CBT experience.'
                : 'Document materials that are not yet available on EduReach open our own request channel — you stay inside EduReach and never get redirected to a third-party reading platform.'}
            </span>
          </div>

          {view === 'CBT' && (
            <div className="er-late-region er-late-region--library">
              {banks === null ? (
                <SkeletonTiles tiles={6} label="Loading question banks" />
              ) : banksError ? (
                <div className="hub-form-error" role="alert">{banksError}</div>
              ) : !records.length ? (
                <div className="hub-panel hub-empty">
                  <h2>{banks.length ? 'No matching CBT bank' : 'No CBT question banks available yet'}</h2>
                  <p>{banks.length ? 'Try a different examination body, school or subject.' : 'Question banks appear here as soon as they are published through the EduReach CBT catalogue.'}</p>
                </div>
              ) : (
                <div className="er-library-grid">
                  {records.map((record) => (
                    <a className={`er-library-card er-library-card-link ${identityClassFor(record.exam, 'service')}`} id={`cbt-${record.id}`} key={record.id} href={record.href}>
                      <div className="er-library-card-top">
                        <CardIdentityMark value={record.exam} type="service" size="sm" />
                        <span>{record.year}</span>
                      </div>
                      <h2>{record.title}</h2>
                      <p className="er-library-school">{record.school}</p>
                      <p>{record.description}</p>
                      <div className="er-library-subjects"><strong>Subjects</strong><span>{record.subjects}</span></div>
                      <span className="hub-primary-btn er-card-cta">Set up CBT <ArrowRight size={14} /></span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          {view === 'MATERIALS' && (
            <div className="er-resource-block">
              <div className="er-resource-head">
                <div>
                  <span className="hub-eyebrow">Published papers</span>
                  <h2>Document papers and sources</h2>
                </div>
                {library?.coverage?.length ? (
                  <span className="er-type-meta">
                    {library.coverage.reduce((sum, row) => sum + Number(row.papers), 0)} verified paper(s) across {library.coverage.length} exam body(ies)
                  </span>
                ) : null}
              </div>

              {libraryLoading && <div className="er-state" role="status"><span className="er-state-icon" aria-hidden="true"><FileText size={20} /></span><div><strong>Checking the library…</strong></div></div>}

              {!libraryLoading && libraryError && (
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

              {!libraryLoading && !libraryError && visibleResources.length > 0 && (
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

              {!libraryLoading && !libraryError && visibleResources.length === 0 && (
                <InlineNotice tone="info" title={library?.configured === false ? 'The document library is not connected yet' : 'No document papers published for this selection yet'}>
                  Nothing has been published here, so there is no paper to open. This is not a missing file on your side. You can practise with the timed CBT bank now, or ask EduReach to source a paper — requests are tracked and you will be told when a verified copy is available.
                </InlineNotice>
              )}
            </div>
          )}

          {view === 'MATERIALS' && (
            !materials.length ? (
              <div className="hub-panel hub-empty"><h2>No matching material route</h2><p>Try another examination body or school. EduReach will not claim a document that is not configured.</p></div>
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
            )
          )}
        </div>
      </div>
    </HubLayout>
  );
}
