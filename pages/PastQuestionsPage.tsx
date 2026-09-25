import { ArrowRight, BookOpen, ExternalLink, FileText, Laptop, MessageCircle, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import FilterPills from '../src/components/FilterPills';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import {
  pastQuestionLibrary,
  SCRIBD_HOME_URL,
  studyMaterialLibrary,
  type StudyMaterialRecord,
} from '../src/data/examPreparation';

type Filter = 'ALL' | 'JAMB' | 'WAEC' | 'NECO' | 'Post-UTME';
type LibraryView = 'CBT' | 'MATERIALS';

const filters = [
  { id: 'ALL', label: 'All banks' },
  { id: 'JAMB', label: 'JAMB' },
  { id: 'WAEC', label: 'WAEC' },
  { id: 'NECO', label: 'NECO' },
  { id: 'Post-UTME', label: 'Post-UTME' },
];

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

function materialRequestHref(material: StudyMaterialRecord) {
  const message = [
    'Hello EduReach, I want to get study materials.',
    `School / exam: ${material.school}`,
    `Material: ${material.title}`,
    `Formats: ${material.formats.join(', ')}`,
    'Please share the available next step.',
  ].join('\n');
  return `https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export default function PastQuestionsPage() {
  const initial = readQuery();
  const [view, setView] = useState<LibraryView>(initial.view);
  const [filter, setFilter] = useState<Filter>(initial.filter);
  const [search, setSearch] = useState(initial.search);

  const records = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pastQuestionLibrary.filter((record) => {
      const matchesFilter = filter === 'ALL' || record.exam === filter;
      const searchable = `${record.title} ${record.school} ${record.year} ${record.subjects}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [filter, search]);

  const materials = useMemo(() => {
    const query = search.trim().toLowerCase();
    return studyMaterialLibrary.filter((record) => {
      const matchesFilter = filter === 'ALL' || record.exam === filter;
      const searchable = `${record.title} ${record.school} ${record.formats.join(' ')} ${record.subjects}`.toLowerCase();
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
      <main className="hub-page" style={{ padding: '22px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '980px' }}>
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow" style={{ color: '#C85841' }}>QUESTION LIBRARY</span>
              <h1>Past Questions &amp; Study Materials</h1>
              <p>Choose between timed CBT practice and document/material requests. School coverage is limited to the configured catalogue; unavailable papers are not invented.</p>
            </div>
            <BookOpen size={28} color="#C85841" aria-hidden="true" />
          </div>

          <div className="er-library-tabs" role="tablist" aria-label="Past question formats">
            <button type="button" role="tab" aria-selected={view === 'CBT'} className={view === 'CBT' ? 'active' : ''} onClick={() => changeView('CBT')}>
              <Laptop size={16} /> CBT practice
            </button>
            <button type="button" role="tab" aria-selected={view === 'MATERIALS'} className={view === 'MATERIALS' ? 'active' : ''} onClick={() => changeView('MATERIALS')}>
              <FileText size={16} /> PDF, DOC &amp; materials
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
                : <>School material links open the configured Scribd home source (<a href={SCRIBD_HOME_URL} target="_blank" rel="noopener noreferrer">Scribd</a>). Use <b>Get now</b> to ask EduReach for guided material support on WhatsApp.</>}
            </span>
          </div>

          {view === 'CBT' && (
            !records.length ? (
              <div className="hub-panel hub-empty"><h2>No matching CBT bank</h2><p>Try a different examination body, school or subject.</p></div>
            ) : (
              <div className="er-library-grid">
                {records.map((record) => (
                  <article className={`er-library-card ${identityClassFor(record.exam, 'service')}`} id={`cbt-${record.id}`} key={record.id}>
                    <div className="er-library-card-top">
                      <CardIdentityMark value={record.exam} type="service" size="sm" />
                      <span>{record.year}</span>
                    </div>
                    <h2>{record.title}</h2>
                    <p className="er-library-school">{record.school}</p>
                    <p>{record.description}</p>
                    <div className="er-library-subjects"><strong>Subjects</strong><span>{record.subjects}</span></div>
                    <a className="hub-primary-btn" href={record.href}>Set up CBT <ArrowRight size={14} /></a>
                  </article>
                ))}
              </div>
            )
          )}

          {view === 'MATERIALS' && (
            !materials.length ? (
              <div className="hub-panel hub-empty"><h2>No matching material route</h2><p>Try another examination body or school. EduReach will not claim a document that is not configured.</p></div>
            ) : (
              <div className="er-material-grid">
                {materials.map((material) => (
                  <article className={`er-material-card ${identityClassFor(material.exam, 'service')}`} id={`materials-${material.id}`} key={material.id}>
                    <div className="er-material-card-top">
                      <CardIdentityMark value={material.exam} type="service" size="sm" />
                      <span className="er-material-formats">{material.formats.join(' · ')}</span>
                    </div>
                    <h2>{material.title}</h2>
                    <a className="er-material-school" href={material.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {material.school} <ExternalLink size={13} />
                    </a>
                    <p>{material.description}</p>
                    <div className="er-library-subjects"><strong>Subjects</strong><span>{material.subjects}</span></div>
                    <div className="er-material-actions">
                      <a className="hub-primary-btn" href={materialRequestHref(material)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Get now</a>
                      {material.cbtHref && <a className="hub-outline-btn" href={material.cbtHref}><Laptop size={14} /> CBT</a>}
                    </div>
                  </article>
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </HubLayout>
  );
}
